import { decodeFunctionData, parseAbiItem, parseEventLogs, type Address, type Hex } from "viem";
import { curveAbi, factoryAbi, routerAbi, tokenAbi } from "./abi.js";
import { ADDR, rpc } from "./chain.js";
import { config } from "./config.js";
import type { BuyerMetrics, BuySample, LaunchEvent, LaunchProfile, Socials, PhaseName } from "./types.js";
import type { DeployerIndex } from "./deployer.js";

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

export async function enrichLaunch(ev: LaunchEvent, index?: DeployerIndex): Promise<LaunchProfile> {
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
  const gaps: string[] = ["native funding traces and cross-wallet clusters require an indexer adapter"];
  if (!tx.devBuyWei) gaps.push("dev buy could not be decoded from this launch transaction route");
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
    deployer: stats,
    timestamp: launchBlock ? Number(launchBlock as bigint) : null,
    fingerprint,
    fundingAnalysis: "unavailable",
    dataGaps: gaps,
  };
}
