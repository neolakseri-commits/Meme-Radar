import { Command } from "commander";
import { isAddress, getAddress, type Address } from "viem";
import { ADDR, rpc } from "./chain.js";
import { config } from "./config.js";
import { DeployerIndex } from "./deployer.js";
import { enrichLaunch } from "./enrich.js";
import { findLaunch, recentLaunches, watchLaunches } from "./launches.js";
import { radarBanner, radarHeader } from "./banner.js";
import { render, toJson, renderRewind, renderBoard } from "./render.js";
import { scoreProfile } from "./score.js";
import { WalletHistory } from "./history.js";
import { analyzeClusters } from "./clusters.js";
import { buildDNA } from "./dna.js";
import { buildOpportunity, rankOpportunities } from "./opportunity.js";
import { buildRewind } from "./rewind.js";
import { computeFlow, buildTape, type SellSample } from "./market.js";
import { blockscoutFunding } from "./funding.js";
import type { BuySample, DeployerStats, LaunchProfile, OpportunityRead } from "./types.js";

const program = new Command();
program.name("meme-radar").description("Terminal intelligence radar for pons v2 launches on Robinhood Chain").version("0.1.0");
program.option("--no-fomo", "hide the quick-trade (Pump.fun / FOMO) action strip");
program.on("option:no-fomo", () => { config.fomo = false; });

const address = (value: string): Address => {
  if (!isAddress(value)) throw new Error(`invalid address: ${value}`);
  return getAddress(value);
};

const recentFingerprints: LaunchProfile[] = [];
const index = new DeployerIndex();
const history = new WalletHistory(config.historyFile);
const enrichCtx = () => ({ index, history, fundingResolver: config.funding ? blockscoutFunding : undefined });

function matchingTwins(profile: LaunchProfile): number {
  const now = profile.timestamp ?? Math.floor(Date.now() / 1000);
  for (let i = recentFingerprints.length - 1; i >= 0; i--) {
    const then = recentFingerprints[i].timestamp ?? now;
    if (now - then > 30 * 60) recentFingerprints.splice(i, 1);
  }
  const twins = recentFingerprints.filter((item) => item.fingerprint === profile.fingerprint && item.event.deployer.toLowerCase() !== profile.event.deployer.toLowerCase()).length;
  recentFingerprints.push(profile);
  return twins;
}

function recordSnapshot(profile: LaunchProfile, score: number, critical: boolean): void {
  const indep = profile.clusters ? profile.clusters.independent : profile.buyers.firstWindowUniqueBuyers;
  history.snapshot(profile.event.token, {
    ts: Math.floor(Date.now() / 1000),
    block: Number(profile.event.blockNumber),
    score,
    fillPct: profile.curve.fillPct,
    indepBuyers: indep,
    concentration: profile.buyers.topRecipientSharePct,
    mcQuote: profile.market?.marketCapQuote ?? null,
    critical,
  });
  history.save();
}

async function show(profile: LaunchProfile, json: boolean, minScore: number): Promise<OpportunityRead | null> {
  const twins = matchingTwins(profile);
  const result = scoreProfile(profile, twins);
  if (result.total < minScore) return null;
  recordSnapshot(profile, result.total, result.verdict === "SIGNAL");
  profile.opportunity = buildOpportunity(profile, result.total, history);
  console.log(json ? toJson(profile, result) : render(profile, result));
  return profile.opportunity;
}

program.command("doctor").description("check RPC and Pons factory").action(async () => {
  console.log(`meme-radar  rpc ${config.rpcUrl}`);
  console.log(`websocket   ${config.wsUrl || "off"}`);
  console.log(`factory     ${ADDR.factory}`);
  try {
    const [chainId, block] = await Promise.all([rpc.getChainId(), rpc.getBlockNumber()]);
    if (chainId !== 4663) throw new Error(`unexpected chain id ${chainId}; expected 4663`);
    console.log(`status      OK · chain ${chainId} · block ${block}`);
  } catch (error) {
    console.error(`status      FAIL · ${(error as Error).message.split("\n")[0]}`);
    console.error("hint        check RPC_URL, network access, or set a private RPC endpoint");
    process.exitCode = 1;
  }
});

program.command("demo").description("show a sample radar card without network access").action(() => {
  // Deterministic sample addresses.
  const A = (n: number): Address => ("0x" + n.toString(16).padStart(40, "0")) as Address;
  const token = "0x36fe8F9989dE6b168bAE2B3AEf2A989712F2eB9" as Address;
  const deployer = A(0x0d000);
  const funder = A(0xf00d); // shared funding source for the insider ring
  const recipient = A(0xdead); // shared funnel recipient
  const ring = [A(0x1001), A(0x1002), A(0x1003), A(0x1004)]; // coordinated wallets
  const indep = Array.from({ length: 10 }, (_, i) => A(0x2000 + i));

  // Seed prior launches so co-occurrence / repeat / DNA signals are real.
  const demoHistory = new WalletHistory(null);
  for (let i = 0; i < 9; i++) {
    const block = 1000 + i * 5000;
    const graduated = i < 3;
    demoHistory.record({
      token: A(0x9000 + i), deployer, block, timestamp: block,
      graduated, gradBlock: graduated ? block + 1140 : null, // ~38m at 2s blocks
      // the ring co-occurs in the first 4 past launches; the rest are unrelated fresh wallets
      earlyWallets: [...(i < 4 ? ring.map((r) => r.toLowerCase()) : []), ...Array.from({ length: 5 + (i % 6) }, (_, k) => A(0x30000 + i * 100 + k).toLowerCase())],
      devBuyPct: [0.9, 1.1, 1.2, 1.3, 1.2, 0.8, 1.4, 1.0, 1.2][i], socials: 2, topSharePct: 15 + i,
    });
  }

  // Current launch: 4 coordinated + 10 independent buyers (16 buys, 14 unique).
  const B = (buyer: Address, rcpt: Address, block: number): BuySample =>
    ({ buyer, recipient: rcpt, quoteIn: 10n ** 17n, tokensOut: 10n ** 24n, tax: 0n, blockNumber: BigInt(block), txHash: null });
  const samples: BuySample[] = [
    B(ring[0], recipient, 100), B(ring[1], recipient, 100), B(ring[2], recipient, 101), B(ring[3], recipient, 102),
    ...indep.map((w, i) => B(w, w, 105 + i * 12)),
    B(indep[0], indep[0], 260), B(indep[1], indep[1], 275), // two follow-up buys → 16 total
  ];
  const funding = new Map<string, string>(ring.map((r) => [r.toLowerCase(), funder.toLowerCase()]));

  const stats: DeployerStats = { launches: 47, graduated: 9, onCurve: 38, firstSeenBlock: 1n };
  const clusters = analyzeClusters(samples, demoHistory, deployer, token, { funding });
  const dna = buildDNA(deployer, stats, demoHistory);

  // A couple of sells so the tape and buy/sell pressure are populated.
  const demoSells: SellSample[] = [
    { seller: indep[3], quoteOut: 5n * 10n ** 17n, tax: 0n, block: 250n },
    { seller: ring[0], quoteOut: 3n * 10n ** 17n, tax: 1n, block: 255n },
  ];
  const QDEC = 18;
  const market = {
    quoteSymbol: "HOOD", quoteDecimals: QDEC, priceQuote: 0.0000121, marketCapQuote: 18_400,
    liquidityQuote: 25.02, fillPct: 24.8, fillVelocityPct: 2.1, peakMultiple: null as number | null,
  };
  const flow = computeFlow(samples, demoSells, QDEC, null);
  const tape = buildTape(samples, demoSells, QDEC, 6);

  // Seed the time-series so Opportunity acceleration + REWIND are real.
  const t0 = Math.floor(Date.now() / 1000) - 1320;
  const snaps: [number, number, number, number, number, number, boolean][] = [
    // dt, score, fill, indep, conc, mc, critical
    [0, 42, 6, 3, 44, 9_000, false],
    [38, 61, 12, 6, 30, 14_000, false],
    [134, 78, 18, 23, 18, 18_400, true],
    [1320, 62, 58, 41, 16, 2_200_000, false],
  ];
  for (const [dt, score, fill, indep2, conc, mc, critical] of snaps)
    demoHistory.snapshot(token, { ts: t0 + dt, block: 100 + dt, score, fillPct: fill, indepBuyers: indep2, concentration: conc, mcQuote: mc, critical });
  demoHistory.observePrice(token, 9);
  demoHistory.observePrice(token, 1100); // → ~122× peak
  market.peakMultiple = demoHistory.peakMultiple(token);

  const profile: LaunchProfile = {
    event: { token, curve: A(0x0002), deployer, pairToken: ADDR.zero, graduationThreshold: 8_090_000000000000000n, blockNumber: 100n, txHash: "0x" + "11".repeat(32) as `0x${string}`, logIndex: 0, seenAtMs: Date.now() },
    name: "WILLOW ROAD MENLO PARK", symbol: "WILLOW", description: "demo profile", socials: { twitter: "https://x.com/willow", telegram: "", discord: "", website: "https://willow.invalid", farcaster: "" }, totalSupply: 1_000_000_000n * 10n ** 18n, phase: "curve", creatorFeeRecipient: deployer, devBuyWei: 210_000_000_000_000_000n, devTokens: 21_000_000n * 10n ** 18n, launchRecipient: deployer, exemptions: [], curve: { realQuoteReserve: 2_006_000_000_000_000_000n, graduationThreshold: 8_090_000_000_000_000_000n, fillPct: 24.8, sellableTokens: 1n, reservedTokens: 1n, readyToGraduate: false, openingTaxBps: 19n, creatorTaxBps: 0n }, buyers: { buys: 16, uniqueBuyers: 14, uniqueRecipients: 11, firstWindowBuys: 16, firstWindowUniqueBuyers: 14, topRecipientSharePct: 18, taxedBuys: 2, recipientMismatches: 4, totalQuoteIn: 1n, totalTokensOut: 1n }, earlySamples: samples, market, flow, tape, deployer: stats, clusters, dna, opportunity: null, timestamp: Math.floor(Date.now() / 1000), fingerprint: "demo", fundingAnalysis: "available", dataGaps: [],
  };
  const result = scoreProfile(profile, 0);
  profile.opportunity = buildOpportunity(profile, result.total, demoHistory);

  console.log(radarBanner("hunt"));
  console.log(radarHeader({ transport: "offline demo", history: `${demoHistory.size()} launches`, launches: 1, signals: 1, watching: 1 }));
  console.log(render(profile, result));
  console.log("");
  console.log(renderRewind(buildRewind(token, profile.symbol, "HOOD", demoHistory)));
});

program.command("scan <token>").description("build an evidence profile for one token").option("--json", "emit JSON").action(async (tokenArg: string, opts: { json?: boolean }) => {
  const ev = await findLaunch(address(tokenArg));
  if (!ev) throw new Error("TokenLaunched event not found");
  if (!index.isReady()) await index.build();
  index.note(ev);
  await show(await enrichLaunch(ev, enrichCtx()), Boolean(opts.json), 0);
});

program.command("hunt").description("listen for launches and print evidence profiles").option("--json", "emit JSON lines").option("--min-score <n>", "hide lower scores", "0").option("--no-history", "skip deployer history").option("--for <seconds>", "stop after a duration").action(async (opts: { json?: boolean; minScore: string; history: boolean; for?: string }) => {
  if (opts.history !== false) {
    console.log("building deployer history…");
    await index.build();
    console.log(`deployer history ready (${config.historyBlocks} blocks)`);
  }
  console.log(radarBanner("hunt"));
  console.log(radarHeader({ transport: config.wsUrl ? "websocket" : `polling ${config.pollMs}ms`, history: opts.history === false ? "disabled" : `${config.historyBlocks} blocks`, launches: 0, signals: 0, watching: 0 }));
  const stop = watchLaunches((ev) => {
    index.note(ev);
    void enrichLaunch(ev, enrichCtx()).then((profile) => show(profile, Boolean(opts.json), Number(opts.minScore))).catch((error: Error) => console.error(`enrichment warning: ${error.message.split("\n")[0]}`));
  });
  const duration = opts.for ? Number(opts.for) * 1000 : 0;
  const timer = duration > 0 ? setTimeout(() => { stop(); process.exit(0); }, duration) : undefined;
  process.on("SIGINT", () => { stop(); if (timer) clearTimeout(timer); process.exit(0); });
});

program.command("backfill").description("profile recent launches once, then rank them as opportunities").option("--blocks <n>", "lookback blocks", String(config.historyBlocks)).option("--json", "emit JSON lines").option("--top <n>", "leaderboard size", "10").action(async (opts: { blocks: string; json?: boolean; top: string }) => {
  await index.build(Number(opts.blocks));
  console.log(radarBanner("backfill"));
  const board: { profile: LaunchProfile; read: OpportunityRead }[] = [];
  for (const ev of await recentLaunches(BigInt(opts.blocks))) {
    index.note(ev);
    const profile = await enrichLaunch(ev, enrichCtx());
    const read = await show(profile, Boolean(opts.json), 0);
    if (read) board.push({ profile, read });
  }
  if (!opts.json && board.length) {
    console.log("");
    console.log(renderBoard(rankOpportunities(board), Number(opts.top)));
  }
});

program.command("rewind <token>").description("replay what the radar saw for a token over time").action(async (tokenArg: string) => {
  const addr = address(tokenArg);
  const ev = await findLaunch(addr);
  if (!ev) throw new Error("TokenLaunched event not found");
  if (!index.isReady()) await index.build();
  index.note(ev);
  const profile = await enrichLaunch(ev, enrichCtx());
  const result = scoreProfile(profile, 0);
  recordSnapshot(profile, result.total, result.verdict === "SIGNAL");
  console.log(radarBanner("hunt"));
  console.log(renderRewind(buildRewind(addr, profile.symbol, profile.market?.quoteSymbol ?? "HOOD", history)));
});

program.parseAsync(process.argv).catch((error: Error) => { console.error(`error: ${error.message.split("\n")[0]}`); process.exitCode = 1; });
