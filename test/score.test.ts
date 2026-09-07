import test from "node:test";
import assert from "node:assert/strict";
import type { LaunchProfile } from "../src/types.js";
import { scoreProfile } from "../src/score.js";

const base = (): LaunchProfile => ({
  event: { token: "0x0000000000000000000000000000000000000001", curve: "0x0000000000000000000000000000000000000002", deployer: "0x0000000000000000000000000000000000000003", pairToken: "0x0000000000000000000000000000000000000000", graduationThreshold: 4n, blockNumber: 1n, txHash: "0x" + "11".repeat(32) as `0x${string}`, logIndex: 0, seenAtMs: Date.now() },
  name: "Test", symbol: "TEST", description: "A test token with a meaningful description", socials: { twitter: "https://x.com/test", telegram: "", discord: "", website: "https://test.invalid", farcaster: "" }, totalSupply: 1_000_000_000n * 10n ** 18n, phase: "curve", creatorFeeRecipient: "0x0000000000000000000000000000000000000003", devBuyWei: 1n, devTokens: 30_000_000n * 10n ** 18n, launchRecipient: "0x0000000000000000000000000000000000000003", exemptions: [], curve: { realQuoteReserve: 1n, graduationThreshold: 4n, fillPct: 25, sellableTokens: 1n, reservedTokens: 1n, readyToGraduate: false, openingTaxBps: null, creatorTaxBps: 100n }, buyers: { buys: 14, uniqueBuyers: 14, uniqueRecipients: 14, firstWindowBuys: 14, firstWindowUniqueBuyers: 14, topRecipientSharePct: 2, taxedBuys: 0, recipientMismatches: 0, totalQuoteIn: 1n, totalTokensOut: 1n }, earlySamples: [], market: null, flow: null, tape: [], deployer: { launches: 3, graduated: 3, onCurve: 0, firstSeenBlock: 1n }, clusters: null, dna: null, opportunity: null, momentum: null, graduation: null, poolHealth: null, capitalRotation: null, timestamp: 1, fingerprint: "a", fundingAnalysis: "unavailable", dataGaps: [],
});

test("strong evidence produces a signal", () => { const result = scoreProfile(base()); assert.equal(result.verdict, "SIGNAL"); assert.ok(result.total >= 75); });
test("matching fingerprints are visible as a farm warning", () => { const result = scoreProfile(base(), 2); assert.match(result.reasons.join(" "), /farm/); });
