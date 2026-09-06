// Deployer DNA.
//
// Deployer history already tells you counts. DNA turns those counts into a
// behavioural profile: how often this deployer graduates, how fast, how big the
// early crowd usually is, how much the dev typically buys — and a one-line
// "typical launch" fingerprint you can pattern-match a fresh launch against.

import type { Address } from "viem";
import type { DeployerDNA, DeployerStats } from "./types.js";
import type { WalletHistory } from "./history.js";

// Robinhood Chain block cadence (seconds). Used only to render block spans as
// human time; override via RADAR_BLOCK_SECONDS if the chain retunes.
const BLOCK_SECONDS = Number(process.env.RADAR_BLOCK_SECONDS) > 0 ? Number(process.env.RADAR_BLOCK_SECONDS) : 2;

export function buildDNA(
  deployer: Address,
  stats: DeployerStats | null,
  history: WalletHistory | null,
): DeployerDNA | null {
  const launches = stats?.launches ?? 0;
  if (launches < 2 && !(history && history.deployerRecords(deployer).length >= 2)) return null;

  const agg = history?.deployerAggregate(deployer) ?? {
    count: 0,
    graduated: 0,
    medianGradBlocks: null,
    medianEarlyWallets: null,
    medianDevBuyPct: null,
  };

  const graduated = stats?.graduated ?? agg.graduated;
  const total = Math.max(launches, agg.count);
  const gradRatePct = total > 0 ? Math.round((graduated / total) * 100) : 0;
  const medianTimeToGradSec = agg.medianGradBlocks !== null ? Math.round(agg.medianGradBlocks * BLOCK_SECONDS) : null;

  const typical: string[] = [];
  if (agg.medianDevBuyPct !== null) {
    typical.push(
      agg.medianDevBuyPct === 0
        ? "no dev buy"
        : agg.medianDevBuyPct <= 3
          ? "low dev buy"
          : agg.medianDevBuyPct <= 8
            ? "moderate dev buy"
            : "heavy dev buy",
    );
  }
  if (agg.medianEarlyWallets !== null) {
    const w = Math.round(agg.medianEarlyWallets);
    typical.push(`~${Math.max(1, w - 3)}–${w + 3} early wallets`);
  }
  if (gradRatePct >= 30) typical.push(`graduates ${gradRatePct}% of the time`);
  else if (graduated === 0 && total >= 5) typical.push("rarely graduates");
  if (medianTimeToGradSec !== null) typical.push(`peak window ~${fmtDuration(medianTimeToGradSec)}`);
  if (!typical.length) typical.push("not enough recorded launches to profile yet");

  return {
    deployer,
    launches: total,
    graduated,
    gradRatePct,
    medianTimeToGradSec,
    medianEarlyWallets: agg.medianEarlyWallets !== null ? Math.round(agg.medianEarlyWallets) : null,
    medianDevBuyPct: agg.medianDevBuyPct,
    medianPeakX: null, // honest: peak multiple needs a price adapter we don't ship
    sampleSize: agg.count,
    typical,
  };
}

export function fmtDuration(sec: number): string {
  if (sec < 90) return `${sec}s`;
  const m = Math.round(sec / 60);
  if (m < 90) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h${m % 60 ? `${m % 60}m` : ""}`;
}
