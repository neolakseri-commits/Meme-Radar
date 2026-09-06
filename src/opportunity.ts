// Opportunity Ranking.
//
// A token score answers "how clean is this launch?". A trader also needs
// "is this an unusually good spot to be early?". Opportunity blends the score
// with *earliness*, *demand acceleration*, *independence of that demand*, the
// deployer's graduation habit, and how comparable historical setups resolved.

import type { LaunchProfile, OpportunityRead } from "./types.js";
import type { WalletHistory } from "./history.js";

export function buildOpportunity(
  profile: LaunchProfile,
  score: number,
  history: WalletHistory | null,
): OpportunityRead {
  const fill = profile.curve.fillPct;
  const position: OpportunityRead["position"] = fill < 25 ? "EARLY" : fill < 60 ? "MID" : "LATE";

  // Demand acceleration from the snapshot series (independent-buyer growth).
  let independentGrowthPct: number | null = null;
  let acceleration: OpportunityRead["acceleration"] = "—";
  if (history) {
    const snaps = history.getSnapshots(profile.event.token);
    if (snaps.length >= 2) {
      const first = snaps[0].indepBuyers || 1;
      const last = snaps[snaps.length - 1].indepBuyers;
      independentGrowthPct = Math.round(((last - first) / first) * 100);
      acceleration =
        independentGrowthPct >= 150 ? "HIGH" : independentGrowthPct >= 40 ? "MEDIUM" : "LOW";
    }
  }

  // Independent demand right now (clusters remove fake breadth).
  const indepNow = profile.clusters
    ? profile.clusters.independent
    : profile.buyers.firstWindowUniqueBuyers;
  const insider = profile.clusters?.clusters.some((c) => c.kind === "insider") ?? false;

  // How comparable historical setups performed.
  const comp = history
    ? history.similarSetups(
        {
          earlyWallets: profile.buyers.firstWindowUniqueBuyers,
          devBuyPct: devPct(profile),
          topSharePct: profile.buyers.topRecipientSharePct,
        },
        profile.event.token,
      )
    : null;
  const compRate = comp && comp.total >= 3 ? comp.graduated / comp.total : null;

  // Opportunity 0..100.
  let opp = score * 0.5; // grounded in the honest score
  opp += position === "EARLY" ? 18 : position === "MID" ? 6 : -6; // being early is the edge
  opp += acceleration === "HIGH" ? 18 : acceleration === "MEDIUM" ? 8 : 0;
  opp += Math.min(12, indepNow); // real breadth
  if (insider) opp -= 22; // manufactured demand kills the opportunity
  if (compRate !== null) opp += Math.round((compRate - 0.3) * 40); // comps vs a 30% base rate
  if (profile.dna && profile.dna.gradRatePct >= 30) opp += 6;
  const opportunity = Math.max(0, Math.min(100, Math.round(opp)));

  const tags: string[] = [];
  if (position === "EARLY" && opportunity >= 65) tags.push("UNUSUALLY EARLY");
  if (acceleration === "HIGH") tags.push("ACCELERATING");
  if (insider) tags.push("COORDINATED — CAUTION");
  else if (indepNow >= 10) tags.push("BROAD DEMAND");
  if (compRate !== null && compRate >= 0.5) tags.push("STRONG COMPS");

  return {
    score,
    opportunity,
    position,
    acceleration,
    independentGrowthPct,
    comp: comp && comp.total > 0 ? comp : null,
    tags,
  };
}

function devPct(p: LaunchProfile): number | null {
  return p.devBuyWei !== null && p.devTokens !== null && p.totalSupply > 0n
    ? Number((p.devTokens * 10_000n) / p.totalSupply) / 100
    : null;
}

/** Rank a batch of reads for a leaderboard (highest opportunity first). */
export function rankOpportunities(
  items: { profile: LaunchProfile; read: OpportunityRead }[],
): { profile: LaunchProfile; read: OpportunityRead }[] {
  return [...items].sort((a, b) => b.read.opportunity - a.read.opportunity);
}
