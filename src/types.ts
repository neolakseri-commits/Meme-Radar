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
  deployer: DeployerStats | null;
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
