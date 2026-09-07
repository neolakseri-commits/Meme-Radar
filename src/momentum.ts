import type {
  CapitalRotationRead,
  GraduationRead,
  LaunchProfile,
  LifecycleStage,
  MomentumIntelligence,
  PoolHealth,
} from "./types.js";
import type { WalletHistory } from "./history.js";

const clamp = (n: number, min = 0, max = 100): number => Math.max(min, Math.min(max, Math.round(n)));

function latestVelocity(profile: LaunchProfile, history: WalletHistory | null): number | null {
  if (!history) return null;
  const snapshots = history.getSnapshots(profile.event.token);
  if (snapshots.length < 2) return null;
  const last = snapshots[snapshots.length - 1];
  const prev = snapshots[snapshots.length - 2];
  const minutes = (last.ts - prev.ts) / 60;
  if (minutes <= 0) return null;
  return Number(((last.fillPct - prev.fillPct) / minutes).toFixed(2));
}

export function buildGraduation(profile: LaunchProfile, history: WalletHistory | null): GraduationRead {
  if (profile.phase === "pool") {
    return { fillPct: 100, velocityPctPerMin: 0, etaMinutes: 0, status: "GRADUATED" };
  }
  const fillPct = profile.curve.fillPct;
  const velocityPctPerMin = latestVelocity(profile, history);
  const etaMinutes = velocityPctPerMin !== null && velocityPctPerMin > 0
    ? Number(((100 - fillPct) / velocityPctPerMin).toFixed(1))
    : null;
  const status = fillPct >= 99
    ? "ACCELERATING"
    : velocityPctPerMin !== null && velocityPctPerMin > 0.5
      ? "ACCELERATING"
      : velocityPctPerMin !== null && velocityPctPerMin > 0
        ? "STEADY"
        : "STALLED";
  return { fillPct, velocityPctPerMin, etaMinutes, status };
}

function lifecycle(profile: LaunchProfile, graduation: GraduationRead, exitRisk: number | null): LifecycleStage {
  if (profile.phase === "pool") {
    if (exitRisk !== null && exitRisk >= 65) return "DECAY";
    if (profile.flow?.pressure !== null && profile.flow?.pressure !== undefined && profile.flow.pressure < 0.85) return "DISTRIBUTION";
    return "POOL EXPANSION";
  }
  if (graduation.fillPct >= 90) return "GRADUATION";
  if (graduation.status === "ACCELERATING" || profile.opportunity?.acceleration === "HIGH") return "ACCELERATION";
  if (graduation.fillPct >= 15 || profile.buyers.firstWindowUniqueBuyers >= 4) return "ACCUMULATION";
  return "LAUNCH";
}

export function buildPoolHealth(profile: LaunchProfile, history: WalletHistory | null): PoolHealth | null {
  if (profile.phase !== "pool") return null;
  const market = profile.market;
  const flow = profile.flow;
  const whale = profile.buyers.topRecipientSharePct;
  const available = [market?.liquidityQuote, flow?.pressure, flow?.buyVolumeQuote, flow?.buyers, whale].filter((v) => v !== null && v !== undefined).length;
  if (!available) return { score: null, liquidityQuote: null, liquidityChangePct: null, buySellPressure: null, volumeQuote: null, newWallets: null, whaleConcentrationPct: null };
  const snapshots = history?.getSnapshots(profile.event.token) ?? [];
  // `decorate` records the current observation immediately before building
  // intelligence, so compare against the snapshot before the latest one.
  const priorSnapshot = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;
  const priorLiquidity = priorSnapshot?.liquidityQuote ?? null;
  const currentLiquidity = market?.liquidityQuote ?? null;
  const liquidityChangePct = priorLiquidity !== null && currentLiquidity !== null && priorLiquidity > 0
    ? Number((((currentLiquidity - priorLiquidity) / priorLiquidity) * 100).toFixed(1))
    : null;
  let score = 50;
  if ((flow?.pressure ?? 0) >= 1.5) score += 18;
  else if ((flow?.pressure ?? 0) < 1) score -= 18;
  if ((flow?.buyers ?? 0) >= 10) score += 14;
  if (whale > 25) score -= 20;
  else if (whale > 15) score -= 8;
  if ((market?.liquidityQuote ?? 0) > 0) score += 10;
  return {
    score: clamp(score),
    liquidityQuote: market?.liquidityQuote ?? null,
    liquidityChangePct,
    buySellPressure: flow?.pressure ?? null,
    volumeQuote: flow ? flow.buyVolumeQuote + flow.sellVolumeQuote : null,
    newWallets: flow?.buyers ?? null,
    whaleConcentrationPct: whale,
  };
}

export function buildMomentum(profile: LaunchProfile, history: WalletHistory | null): MomentumIntelligence {
  const total = profile.clusters?.totalBuyers ?? profile.buyers.firstWindowUniqueBuyers;
  const independent = profile.clusters?.independent ?? profile.buyers.firstWindowUniqueBuyers;
  const demandQuality = total > 0 ? clamp((independent / total) * 100 - Math.max(0, profile.buyers.recipientMismatches - 1) * 4 - (profile.buyers.topRecipientSharePct > 25 ? 15 : 0)) : null;
  const growth = profile.opportunity?.independentGrowthPct ?? null;
  const walletRotation = growth !== null && growth >= 100 || independent >= 10
    ? "HIGH"
    : growth !== null && growth >= 40 || independent >= 5
      ? "MEDIUM"
      : total > 0 ? "LOW" : "UNKNOWN";
  const pressure = profile.flow?.pressure ?? null;
  const velocity = profile.opportunity?.independentGrowthPct ?? null;
  const exitRisk = total > 0
    ? clamp(profile.buyers.topRecipientSharePct * 1.2 + (pressure !== null && pressure < 1 ? 35 : 0) + (profile.clusters?.topConfidence ?? 0) * 0.35 + (profile.phase === "pool" && pressure !== null && pressure < 1 ? 15 : 0))
    : null;
  const graduation = buildGraduation(profile, history);
  const stage = lifecycle(profile, graduation, exitRisk);
  const signal = stage === "ACCELERATION" || stage === "GRADUATION" || stage === "POOL EXPANSION"
    ? "BUILDING"
    : stage === "DISTRIBUTION" || stage === "DECAY"
      ? "FADING"
      : "STABLE";
  const dataConfidence = clamp(
    [total > 0, pressure !== null, profile.market !== null, profile.clusters !== null, profile.opportunity !== null, history !== null]
      .filter(Boolean).length * 16.66,
  );
  return {
    lifecycle: stage,
    signal,
    demandQuality,
    walletRotation,
    buyPressure: pressure,
    buyerVelocityPct: velocity,
    exitRisk,
    dataConfidence,
  };
}

export function buildCapitalRotation(profile: LaunchProfile): CapitalRotationRead {
  const net = profile.flow?.netFlowQuotePerMin ?? null;
  if (net === null) return { netFlowQuotePerMin: null, direction: "UNKNOWN", label: "UNKNOWN" };
  const direction = net > 0.01 ? "INFLOW" : net < -0.01 ? "OUTFLOW" : "FLAT";
  const label = direction === "INFLOW" && (profile.flow?.pressure ?? 0) >= 2 ? "HOT" : direction === "INFLOW" ? "WARM" : direction === "OUTFLOW" ? "COOL" : "UNKNOWN";
  return { netFlowQuotePerMin: net, direction, label };
}

export interface IntelligenceBundle {
  momentum: MomentumIntelligence;
  graduation: GraduationRead;
  poolHealth: PoolHealth | null;
  capitalRotation: CapitalRotationRead;
}

export function buildIntelligence(profile: LaunchProfile, history: WalletHistory | null): IntelligenceBundle {
  const momentum = buildMomentum(profile, history);
  return {
    momentum,
    graduation: buildGraduation(profile, history),
    poolHealth: buildPoolHealth(profile, history),
    capitalRotation: buildCapitalRotation(profile),
  };
}
