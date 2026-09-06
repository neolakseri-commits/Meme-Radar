import { decodeFunctionData, parseAbiItem, parseEventLogs, type Address, type Hex } from "viem";
import { curveAbi, factoryAbi, routerAbi, tokenAbi } from "./abi.js";
import { ADDR, rpc } from "./chain.js";
import { config } from "./config.js";
import type { BuyerMetrics, BuySample, LaunchEvent, LaunchProfile, Socials, PhaseName } from "./types.js";
import type { DeployerIndex } from "./deployer.js";
import type { WalletHistory } from "./history.js";
import { analyzeClusters } from "./clusters.js";
import { buildDNA } from "./dna.js";
import { computeMarket, computeFlow, buildTape, type SellSample } from "./market.js";

const curveSellEvent = parseAbiItem("event CurveSell(address indexed seller, address indexed recipient, uint256 tokensIn, uint256 quoteOut, uint256 fee, uint256 tax)");

async function earlySells(ev: LaunchEvent): Promise<SellSample[]> {
  const head = await rpc.getBlockNumber();
  const end = ev.blockNumber + BigInt(config.earlyBlocks) < head ? ev.blockNumber + BigInt(config.earlyBlocks) : head;
  const out: SellSample[] = [];
  try {
    for (let start = ev.blockNumber; start <= end; start += BigInt(config.logChunk)) {
      const to = start + BigInt(config.logChunk) - 1n > end ? end : start + BigInt(config.logChunk) - 1n;
      const logs = await rpc.getLogs({ address: ev.curve, event: curveSellEvent, fromBlock: start, toBlock: to });
      for (const log of logs.slice(0, config.maxFirstBuys)) {
        const a = (log as { args: { seller?: Address; quoteOut?: bigint; tax?: bigint }; blockNumber?: bigint }).args;
        if (!a.seller || a.quoteOut === undefined) continue;
        out.push({ seller: a.seller, quoteOut: a.quoteOut, tax: a.tax ?? 0n, block: (log as { blockNumber?: bigint }).blockNumber ?? ev.blockNumber });
      }
    }
  } catch { /* chains without a CurveSell event simply report no sells */ }
  return out;
}

async function quoteMeta(pairToken: Address): Promise<{ symbol: string; decimals: number }> {
  if (pairToken.toLowerCase() === ADDR.zero.toLowerCase()) return { symbol: "ETH", decimals: 18 };
  const p = { address: pairToken, abi: tokenAbi } as const;
  const [symbol, decimals] = await Promise.all([
    rpc.readContract({ ...p, functionName: "symbol" }).catch(() => "HOOD"),
    rpc.readContract({ ...p, functionName: "decimals" }).catch(() => 18),
  ]);
  return { symbol: String(symbol), decimals: Number(decimals) };
}

const emptySocials = (): Socials => ({ twitter: "", telegram: "", discord: "", website: "", farcaster: "" });
const phaseName = (n: number): PhaseName => (["curve", "swept", "pool", "rescued"] as const)[n] ?? "unknown";
const curveBuyEvent = parseAbiItem("event CurveBuy(address indexed buyer, address indexed recipient, uint256 quoteIn, uint256 tokensOut, uint256 fee, uint256 tax)");

async function launchTransaction(ev: LaunchEvent): Promise<{ devBuyWei: bigint | null; devTokens: bigint | null; recipient: Address | null; exemptions: Address[] }> {
  try {
    const tx = await rpc.getTransaction({ hash: ev.txHash });
    const decoded = decodeFunctionData({ abi: routerAbi, data: tx.input });
    if (decoded.functionName !== "launchAndBuy") return { devBuyWei: null, devTokens: null, recipient: null, exemptions: [] };
    const args = decoded.args as readonly [unknown, bigint, Address, bigint, bigint, Address, Address[]];
    let devTokens: bigint | null = null;
    try {
      const receipt = await rpc.getTransactionReceipt({ hash: ev.txHash });
      const parsed = parseEventLogs({ abi: routerAbi, logs: receipt.logs, eventName: "Launched" });
      const first = parsed[0];
      devTokens = first?.args.tokensReceived ?? null;
    } catch { /* launch transaction may use another route */ }
    return { devBuyWei: args[3], devTokens, recipient: args[5], exemptions: args[6] ?? [] };
  } catch {
    return { devBuyWei: null, devTokens: null, recipient: null, exemptions: [] };
  }
}

async function earlyBuys(ev: LaunchEvent): Promise<BuySample[]> {
  const head = await rpc.getBlockNumber();
  const end = ev.blockNumber + BigInt(config.earlyBlocks) < head ? ev.blockNumber + BigInt(config.earlyBlocks) : head;
  const out: BuySample[] = [];
  for (let start = ev.blockNumber; start <= end; start += BigInt(config.logChunk)) {
    const to = start + BigInt(config.logChunk) - 1n > end ? end : start + BigInt(config.logChunk) - 1n;
    const logs = await rpc.getLogs({ address: ev.curve, event: curveBuyEvent, fromBlock: start, toBlock: to });
    for (const log of logs.slice(0, config.maxFirstBuys)) {
      const a = (log as { args: { buyer?: Address; recipient?: Address; quoteIn?: bigint; tokensOut?: bigint; tax?: bigint }; blockNumber?: bigint; transactionHash?: Hex }).args;
      if (!a.buyer || !a.recipient || a.quoteIn === undefined || a.tokensOut === undefined) continue;
      out.push({ buyer: a.buyer, recipient: a.recipient, quoteIn: a.quoteIn, tokensOut: a.tokensOut, tax: a.tax ?? 0n, blockNumber: (log as { blockNumber?: bigint }).blockNumber ?? ev.blockNumber, txHash: (log as { transactionHash?: Hex }).transactionHash ?? null });
    }
  }
  return out;
}

function buyerMetrics(buys: BuySample[], totalSupply: bigint, early: boolean): BuyerMetrics {
  const buyerSet = new Set(buys.map((b) => b.buyer.toLowerCase()));
  const recipientSet = new Set(buys.map((b) => b.recipient.toLowerCase()));
  const balances = new Map<string, bigint>();
  let quote = 0n, tokens = 0n, taxed = 0, mismatches = 0;
  for (const b of buys) {
    quote += b.quoteIn; tokens += b.tokensOut;
    balances.set(b.recipient.toLowerCase(), (balances.get(b.recipient.toLowerCase()) ?? 0n) + b.tokensOut);
    if (b.tax > 0n) taxed++;
    if (b.buyer.toLowerCase() !== b.recipient.toLowerCase()) mismatches++;
  }
  const top = [...balances.values()].sort((a, b) => (a > b ? -1 : a < b ? 1 : 0))[0] ?? 0n;
  const topSharePct = totalSupply > 0n ? Number((top * 10_000n) / totalSupply) / 100 : 0;
  return { buys: buys.length, uniqueBuyers: buyerSet.size, uniqueRecipients: recipientSet.size, firstWindowBuys: early ? buys.length : 0, firstWindowUniqueBuyers: early ? buyerSet.size : 0, topRecipientSharePct: topSharePct, taxedBuys: taxed, recipientMismatches: mismatches, totalQuoteIn: quote, totalTokensOut: tokens };
}

export interface EnrichContext {
  index?: DeployerIndex;
  history?: WalletHistory;
  /** Optional adapter: resolve wallet(lowercased) -> funding source (lowercased). */
  fundingResolver?: (wallets: string[]) => Promise<Map<string, string>>;
}

export async function enrichLaunch(ev: LaunchEvent, ctx: DeployerIndex | EnrichContext = {}): Promise<LaunchProfile> {
  // Back-compat: callers may still pass a DeployerIndex directly.
  const context: EnrichContext = ctx && "stats" in ctx ? { index: ctx as DeployerIndex } : (ctx as EnrichContext);
  const index = context.index;
  const history = context.history ?? null;
  const f = { address: ADDR.factory, abi: factoryAbi } as const;
  const t = { address: ev.token, abi: tokenAbi } as const;
  const c = { address: ev.curve, abi: curveAbi } as const;
  const [record, name, symbol, totalSupply, info, reserve, realQuote, sellable, reserved, threshold, creatorTax, ready, graduated, launchBlock, txInfo, buys] = await Promise.all([
    rpc.readContract({ ...f, functionName: "getLaunchedToken", args: [ev.token] }),
    rpc.readContract({ ...t, functionName: "name" }).catch(() => "?"),
    rpc.readContract({ ...t, functionName: "symbol" }).catch(() => "?"),
    rpc.readContract({ ...t, functionName: "totalSupply" }).catch(() => 1_000_000_000n * 10n ** 18n),
    rpc.readContract({ ...t, functionName: "getTokenInfo" }).catch(() => null),
    rpc.readContract({ ...c, functionName: "getReserves" }).catch(() => [0n, 0n] as const),
    rpc.readContract({ ...c, functionName: "realQuoteReserve" }).catch(() => 0n),
    rpc.readContract({ ...c, functionName: "sellableTokens" }).catch(() => 0n),
    rpc.readContract({ ...c, functionName: "reservedTokens" }).catch(() => 0n),
    rpc.readContract({ ...c, functionName: "graduationThreshold" }).catch(() => ev.graduationThreshold),
    rpc.readContract({ ...c, functionName: "creatorTaxBps" }).catch(() => 0n),
    rpc.readContract({ ...c, functionName: "readyToGraduate" }).catch(() => false),
    rpc.readContract({ ...c, functionName: "graduated" }).catch(() => false),
    rpc.readContract({ ...c, functionName: "launchedAt" }).catch(() => 0n),
    launchTransaction(ev),
    earlyBuys(ev),
  ]);
  const socials = info ? (info as readonly [Address, string, string, Socials])[3] : emptySocials();
  const stats = index?.stats(ev.deployer, ev.blockNumber) ?? null;
  const allBuys = buyerMetrics(buys, totalSupply as bigint, true);
  const fillPct = Number(threshold as bigint) > 0 ? Math.min(100, Number(((realQuote as bigint) * 10_000n) / (threshold as bigint)) / 100) : 0;
  const recordObj = record as { creatorFeeRecipient: Address; phase: number; pairToken: Address; creatorTaxBps: number };
  const tx = txInfo as { devBuyWei: bigint | null; devTokens: bigint | null; recipient: Address | null; exemptions: Address[] };
  let openingTaxBps: bigint | null = null;
  try { openingTaxBps = await rpc.readContract({ ...c, functionName: "currentSnipeTaxBps", args: [tx.recipient ?? ev.deployer] }); } catch { /* some routes do not expose this getter */ }
  const fingerprint = [tx.devBuyWei?.toString() ?? "?", String(Number(creatorTax as bigint)), Object.values(socials).filter(Boolean).map((s) => s.toLowerCase()).sort().join(","), String(tx.exemptions.length)].join("|");
  // Optional funding-source resolution (Blockscout adapter, off by default).
  let funding: Map<string, string> | null = null;
  if (context.fundingResolver) {
    const wallets = [...new Set(buys.map((b) => b.buyer.toLowerCase()))];
    funding = await context.fundingResolver(wallets).catch(() => null);
  }

  const gaps: string[] = [];
  if (!funding) gaps.push("funding-source links need a funding adapter (set RADAR_FUNDING=on)");
  if (!tx.devBuyWei) gaps.push("dev buy could not be decoded from this launch transaction route");

  // Wallet Intelligence Graph + Deployer DNA.
  const clusters = analyzeClusters(buys, history, ev.deployer, ev.token, { funding: funding ?? undefined });
  const dna = buildDNA(ev.deployer, stats, history);

  // Live market read (price / mcap / liquidity in the quote token), trade flow,
  // and the tape — the things a trader actually acts on.
  const [sells, qMeta, tokenDecRaw] = await Promise.all([
    earlySells(ev),
    quoteMeta(ev.pairToken),
    rpc.readContract({ ...t, functionName: "decimals" }).catch(() => 18),
  ]);
  const tokenDecimals = Number(tokenDecRaw);
  const [quoteReserve, tokenReserve] = (reserve as readonly [bigint, bigint]) ?? [0n, 0n];
  const qn = Number(quoteReserve) / 10 ** qMeta.decimals;
  const tn = Number(tokenReserve) / 10 ** tokenDecimals;
  const priceNow = tn > 0 && qn > 0 ? qn / tn : null;
  const peakMultiple = history ? history.observePrice(ev.token, priceNow) : null;
  const firstFill = history?.firstFill(ev.token) ?? null;
  const fillVelocityPct = firstFill !== null ? Number((fillPct - firstFill).toFixed(2)) : null;
  const market = computeMarket({
    quoteReserve, tokenReserve, realQuoteReserve: realQuote as bigint, totalSupply: totalSupply as bigint,
    quoteSymbol: qMeta.symbol, quoteDecimals: qMeta.decimals, tokenDecimals, fillPct, fillVelocityPct, peakMultiple,
  });
  const flow = computeFlow(buys, sells, qMeta.decimals, null);
  const tape = buildTape(buys, sells, qMeta.decimals, 6);

  // Compound the intelligence: remember this launch for future co-occurrence /
  // repeat-buyer / DNA analysis.
  if (history) {
    const devPct = tx.devBuyWei !== null && tx.devTokens !== null && (totalSupply as bigint) > 0n
      ? Number(((tx.devTokens as bigint) * 10_000n) / (totalSupply as bigint)) / 100
      : null;
    const gBlock = index?.graduationBlock(ev.token) ?? null;
    history.record({
      token: ev.token,
      deployer: ev.deployer,
      block: Number(ev.blockNumber),
      timestamp: launchBlock ? Number(launchBlock as bigint) : null,
      graduated: Boolean(graduated) || gBlock !== null,
      gradBlock: gBlock !== null ? Number(gBlock) : null,
      earlyWallets: [...new Set(buys.map((b) => b.buyer.toLowerCase()))],
      devBuyPct: devPct,
      socials: Object.values(socials).filter(Boolean).length,
      topSharePct: allBuys.topRecipientSharePct,
      fillPct,
    });
    history.save();
  }

  return {
    event: ev,
    name: name as string,
    symbol: symbol as string,
    description: info ? String((info as readonly [Address, string, string, Socials])[2] ?? "") : "",
    socials,
    totalSupply: totalSupply as bigint,
    phase: (graduated ? "pool" : ready ? "curve" : phaseName(recordObj.phase)) as PhaseName,
    creatorFeeRecipient: recordObj.creatorFeeRecipient,
    devBuyWei: tx.devBuyWei,
    devTokens: tx.devTokens,
    launchRecipient: tx.recipient,
    exemptions: tx.exemptions,
    curve: { realQuoteReserve: realQuote as bigint, graduationThreshold: threshold as bigint, fillPct, sellableTokens: sellable as bigint, reservedTokens: reserved as bigint, readyToGraduate: Boolean(ready), openingTaxBps, creatorTaxBps: creatorTax as bigint },
    buyers: allBuys,
    earlySamples: buys,
    market,
    flow,
    tape,
    deployer: stats,
    clusters,
    dna,
    opportunity: null, // filled by the CLI once the score is known
    timestamp: launchBlock ? Number(launchBlock as bigint) : null,
    fingerprint,
    fundingAnalysis: funding ? "available" : "unavailable",
    dataGaps: gaps,
  };
}
