import { Command } from "commander";
import { isAddress, getAddress, type Address } from "viem";
import { ADDR, rpc } from "./chain.js";
import { config } from "./config.js";
import { DeployerIndex } from "./deployer.js";
import { enrichLaunch } from "./enrich.js";
import { findLaunch, recentLaunches, watchLaunches } from "./launches.js";
import { radarBanner, radarHeader } from "./banner.js";
import { render, toJson } from "./render.js";
import { scoreProfile } from "./score.js";
import type { LaunchProfile } from "./types.js";

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

async function show(profile: LaunchProfile, json: boolean, minScore: number): Promise<void> {
  const twins = matchingTwins(profile);
  const result = scoreProfile(profile, twins);
  if (result.total < minScore) return;
  console.log(json ? toJson(profile, result) : render(profile, result));
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
  const profile: LaunchProfile = {
    event: { token: "0x36fe8F9989dE6b168bAE2B3AEf2A989712F2eB9", curve: "0x0000000000000000000000000000000000000002", deployer: "0x0000000000000000000000000000000000000003", pairToken: ADDR.zero, graduationThreshold: 8_090_000000000000000n, blockNumber: 1n, txHash: "0x" + "11".repeat(32) as `0x${string}`, logIndex: 0, seenAtMs: Date.now() },
    name: "WILLOW ROAD MENLO PARK", symbol: "WILLOW", description: "demo profile", socials: { twitter: "https://x.com/willow", telegram: "", discord: "", website: "https://willow.invalid", farcaster: "" }, totalSupply: 1_000_000_000n * 10n ** 18n, phase: "curve", creatorFeeRecipient: "0x0000000000000000000000000000000000000003", devBuyWei: 210_000_000_000_000_000n, devTokens: 21_000_000n * 10n ** 18n, launchRecipient: "0x0000000000000000000000000000000000000003", exemptions: [], curve: { realQuoteReserve: 2_006_000_000_000_000_000n, graduationThreshold: 8_090_000_000_000_000_000n, fillPct: 24.8, sellableTokens: 1n, reservedTokens: 1n, readyToGraduate: false, openingTaxBps: 19n, creatorTaxBps: 0n }, buyers: { buys: 16, uniqueBuyers: 14, uniqueRecipients: 14, firstWindowBuys: 16, firstWindowUniqueBuyers: 14, topRecipientSharePct: 18, taxedBuys: 2, recipientMismatches: 0, totalQuoteIn: 1n, totalTokensOut: 1n }, deployer: { launches: 3, graduated: 3, onCurve: 0, firstSeenBlock: 1n }, timestamp: Math.floor(Date.now() / 1000), fingerprint: "demo", fundingAnalysis: "unavailable", dataGaps: [],
  };
  console.log(radarBanner("hunt"));
  console.log(radarHeader({ transport: "offline demo", history: "not loaded", launches: 1, signals: 1, watching: 0 }));
  void show(profile, false, 0);
});

program.command("scan <token>").description("build an evidence profile for one token").option("--json", "emit JSON").action(async (tokenArg: string, opts: { json?: boolean }) => {
  const ev = await findLaunch(address(tokenArg));
  if (!ev) throw new Error("TokenLaunched event not found");
  if (!index.isReady()) await index.build();
  index.note(ev);
  await show(await enrichLaunch(ev, index), Boolean(opts.json), 0);
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
    void enrichLaunch(ev, index).then((profile) => show(profile, Boolean(opts.json), Number(opts.minScore))).catch((error: Error) => console.error(`enrichment warning: ${error.message.split("\n")[0]}`));
  });
  const duration = opts.for ? Number(opts.for) * 1000 : 0;
  const timer = duration > 0 ? setTimeout(() => { stop(); process.exit(0); }, duration) : undefined;
  process.on("SIGINT", () => { stop(); if (timer) clearTimeout(timer); process.exit(0); });
});

program.command("backfill").description("profile recent launches once").option("--blocks <n>", "lookback blocks", String(config.historyBlocks)).option("--json", "emit JSON lines").action(async (opts: { blocks: string; json?: boolean }) => {
  await index.build(Number(opts.blocks));
  console.log(radarBanner("backfill"));
  for (const ev of await recentLaunches(BigInt(opts.blocks))) {
    index.note(ev);
    await show(await enrichLaunch(ev, index), Boolean(opts.json), 0);
  }
});

program.parseAsync(process.argv).catch((error: Error) => { console.error(`error: ${error.message.split("\n")[0]}`); process.exitCode = 1; });
