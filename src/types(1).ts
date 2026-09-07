import type { Address, Hex } from "viem";

export type PhaseName = "curve" | "swept" | "pool" | "rescued" | "unknown";
export type Verdict = "SIGNAL" | "WATCH" | "NO SIGNAL";

export interface LaunchEvent {
  token: Address;
  curve: Address;
  deployer: Address;
  pairToken: Address;
  blockNumber: bigint;
  graduationThreshold: bigint;
  txHash: Hex;
  logIndex: number;
  seenAtMs: number;
}

export interface Socials {
  twitter: string;
  telegram: string;
  discord: string;
  website: string;
  farcaster: string;
}

export interface BuySample {
  buyer: Address;
  recipient: Address;
  quoteIn: bigint;
  tokensOut: bigint;
  tax: bigint;
  blockNumber: bigint;
  txHash: Hex | null;
}

export interface BuyerMetrics {
  buys: number;
  uniqueBuyers: number;
  uniqueRecipients: number;
  firstWindowBuys: number;
  firstWindowUniqueBuyers: number;
  topRecipientSharePct: number;
  taxedBuys: number;
  recipientMismatches: number;
  totalQuoteIn: bigint;
  totalTokensOut: bigint;
}

export interface DeployerStats {
  launches: number;
  graduated: number;
  onCurve: number;
  firstSeenBlock: bigint | null;
}

export interface CurveMetrics {
  realQuoteReserve: bigint;
  graduationThreshold: bigint;
  fillPct: number;
  sellableTokens: bigint;
  reservedTokens: bigint;
  readyToGraduate: boolean;
  openingTaxBps: bigint | null;
  creatorTaxBps: bigint;
}

export type ClusterKind = "insider" | "bundle" | "clean";

export interface WalletCluster {
  id: string;
  kind: ClusterKind;
  wallets: string[];
  confidence: number; // 0..99
  reasons: string[];
}

export interface ClusterAnalysis {
  totalBuyers: number;
  independent: number;
  clusters: WalletCluster[];
  verdict: string; // e.g. "INSIDER CLUSTER", "LIKELY BUNDLE", "INDEPENDENT DEMAND"
  topConfidence: number;
  signalsUsed: string[]; // which signals had data ("temporal", "co-occurrence", "funding", ...)
}

export interface DeployerDNA {
  deployer: Address;
  launches: number;
  graduated: number;
  gradRatePct: number;
  medianTimeToGradSec: number | null;
  medianEarlyWallets: number | null;
  medianDevBuyPct: number | null;
  medianPeakX: number | null; // requires a price adapter; null when unavailable
  sampleSize: number; // launches with enough recorded detail to profile
  typical: string[]; // synthesized "typical launch" bullets
}

export interface MarketData {
  quoteSymbol: string; // e.g. "HOOD" — pons v2 quotes in the pair token, not ETH
  quoteDecimals: number;
  priceQuote: number | null; // implied spot price, in quote per token
  marketCapQuote: number | null; // fully-diluted, in quote
  liquidityQuote: number; // real quote reserve, in quote
  fillPct: number;
  fillVelocityPct: number | null; // change in fill since last observation
  peakMultiple: number | null; // peak price / first observed price (from history)
}

export interface TradeFlow {
  buyers: number;
  sellers: number;
  buyVolumeQuote: number;
  sellVolumeQuote: number;
  pressure: number | null; // buy volume / sell volume; null when no sells seen
  buysPerMin: number | null;
  windowSeconds: number | null;
  netFlowQuotePerMin: number | null;
}

export interface TapeEntry {
  side: "buy" | "sell";
  wallet: string;
  sizeQuote: number;
  taxed: boolean;
  block: number;
  txHash: string | null;
}

export interface OpportunityRead {
  score: number; // the radar score this is built on
  opportunity: number; // 0..100 opportunity ranking
  position: "EARLY" | "MID" | "LATE";
  acceleration: "HIGH" | "MEDIUM" | "LOW" | "—";
  independentGrowthPct: number | null; // growth of independent buyers across snapshots
  comp: { graduated: number; total: number } | null; // similar historical setups
  tags: string[]; // e.g. "UNUSUALLY EARLY", "COORDINATED — CAUTION"
}

export type LifecycleStage =
  | "LAUNCH"
  | "ACCUMULATION"
  | "ACCELERATION"
  | "GRADUATION"
  | "POOL EXPANSION"
  | "DISTRIBUTION"
  | "DECAY";

export type MomentumSignal = "BUILDING" | "FADING" | "STABLE";
export type RotationLevel = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export interface MomentumIntelligence {
  lifecycle: LifecycleStage;
  signal: MomentumSignal;
  demandQuality: number | null;
  walletRotation: RotationLevel;
  buyPressure: number | null;
  buyerVelocityPct: number | null;
  exitRisk: number | null;
  dataConfidence: number;
}

export interface GraduationRead {
  fillPct: number;
  velocityPctPerMin: number | null;
  etaMinutes: number | null;
  status: "ACCELERATING" | "STEADY" | "STALLED" | "GRADUATED";
}

export interface PoolHealth {
  score: number | null;
  liquidityQuote: number | null;
  liquidityChangePct: number | null;
  buySellPressure: number | null;
  volumeQuote: number | null;
  newWallets: number | null;
  whaleConcentrationPct: number | null;
}

export interface CapitalRotationRead {
  netFlowQuotePerMin: number | null;
  direction: "INFLOW" | "OUTFLOW" | "FLAT" | "UNKNOWN";
  label: "HOT" | "WARM" | "COOL" | "UNKNOWN";
}

export interface RewindPoint {
  tLabel: string; // "T+0", "T+38s", "T+2m14s"
  score: number;
  critical: boolean;
  notes: string[];
  mcQuote: number | null;
}

export interface RewindTimeline {
  symbol: string;
  token: string;
  quoteSymbol: string;
  points: RewindPoint[];
  signalMcQuote: number | null; // MC when the first critical signal fired
  peakMcQuote: number | null;
  peakMultiple: number | null;
}

export interface LaunchProfile {
  event: LaunchEvent;
  name: string;
  symbol: string;
  description: string;
  socials: Socials;
  totalSupply: bigint;
  phase: PhaseName;
  creatorFeeRecipient: Address;
  devBuyWei: bigint | null;
  devTokens: bigint | null;
  launchRecipient: Address | null;
  exemptions: Address[];
  curve: CurveMetrics;
  buyers: BuyerMetrics;
  earlySamples: BuySample[];
  market: MarketData | null;
  flow: TradeFlow | null;
  tape: TapeEntry[];
  deployer: DeployerStats | null;
  clusters: ClusterAnalysis | null;
  dna: DeployerDNA | null;
  opportunity: OpportunityRead | null;
  momentum: MomentumIntelligence | null;
  graduation: GraduationRead | null;
  poolHealth: PoolHealth | null;
  capitalRotation: CapitalRotationRead | null;
  timestamp: number | null;
  fingerprint: string;
  fundingAnalysis: "unavailable" | "available";
  dataGaps: string[];
}

export interface ScoreResult {
  total: number;
  verdict: Verdict;
  reasons: string[];
}
