// Wallet Intelligence Graph.
//
// Turns a flat list of early buyers into linked clusters, so "20 buyers" can be
// read honestly as "20 addresses = 3 coordinated clusters + 5 independents" —
// or confirmed as genuinely broad demand. Every link is explainable.
//
// Signals (each degrades independently when its data source is absent):
//   temporal      — entered within a tight block window
//   funnel        — many buyers routing tokens to one recipient
//   co-occurrence — wallets seen together in prior recorded launches
//   repeat        — wallets that keep buying this deployer's launches
//   funding       — wallets funded from the same source (optional adapter)

import type { Address } from "viem";
import type { BuySample, ClusterAnalysis, ClusterKind, WalletCluster } from "./types.js";
import type { WalletHistory } from "./history.js";

export interface ClusterOptions {
  windowBlocks?: number; // tight co-entry window
  /** wallet(lowercased) -> funding source address (lowercased). Optional. */
  funding?: Map<string, string>;
}

class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    let p = this.parent.get(x) ?? x;
    if (p !== x) {
      p = this.find(p);
      this.parent.set(x, p);
    }
    return p;
  }
  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

const lc = (a: string) => a.toLowerCase();

export function analyzeClusters(
  samples: BuySample[],
  history: WalletHistory | null,
  deployer: Address | string,
  token: Address | string,
  opts: ClusterOptions = {},
): ClusterAnalysis {
  const windowBlocks = opts.windowBlocks ?? 2;
  const funding = opts.funding ?? null;

  // First appearance (block) of each distinct buyer.
  const firstBlock = new Map<string, bigint>();
  const order: string[] = [];
  for (const s of samples) {
    const w = lc(s.buyer);
    if (!firstBlock.has(w)) {
      firstBlock.set(w, s.blockNumber);
      order.push(w);
    } else if (s.blockNumber < firstBlock.get(w)!) {
      firstBlock.set(w, s.blockNumber);
    }
  }
  const buyers = order;
  const total = buyers.length;

  // Recipients that received from a buyer that isn't themselves (funnels).
  const recipientOf = new Map<string, Set<string>>(); // recipient -> buyers
  for (const s of samples) {
    if (lc(s.buyer) !== lc(s.recipient)) {
      const set = recipientOf.get(lc(s.recipient)) ?? new Set<string>();
      set.add(lc(s.buyer));
      recipientOf.set(lc(s.recipient), set);
    }
  }

  const uf = new UnionFind();
  const signalsUsed = new Set<string>();
  const shareFunnel = (a: string, b: string): boolean => {
    for (const set of recipientOf.values()) if (set.has(a) && set.has(b) && set.size >= 3) return true;
    return false;
  };

  // Pairwise linking. Early-buyer counts are small, so O(n^2) is fine.
  for (let i = 0; i < buyers.length; i++) {
    for (let j = i + 1; j < buyers.length; j++) {
      const a = buyers[i];
      const b = buyers[j];
      const sameFunder = Boolean(funding && funding.get(a) && funding.get(a) === funding.get(b));
      if (sameFunder) signalsUsed.add("funding");
      const co = history ? history.coOccurrences(a, b, String(token)) : 0;
      if (co >= 2) signalsUsed.add("co-occurrence");
      const near = firstBlock.get(a)! >= firstBlock.get(b)! - BigInt(windowBlocks) &&
        firstBlock.get(a)! <= firstBlock.get(b)! + BigInt(windowBlocks);
      if (near) signalsUsed.add("temporal");
      const bothRepeat = Boolean(history &&
        history.walletDeployerHits(a, String(deployer), String(token)) >= 1 &&
        history.walletDeployerHits(b, String(deployer), String(token)) >= 1);
      if (bothRepeat) signalsUsed.add("repeat");
      const funnel = shareFunnel(a, b);
      if (funnel) signalsUsed.add("funnel");
      // A tight co-entry only links with corroboration; strong signals link outright.
      if (sameFunder || co >= 2 || funnel || (near && (bothRepeat || co >= 1))) uf.union(a, b);
    }
  }

  // Assemble groups.
  const groups = new Map<string, string[]>();
  for (const w of buyers) {
    const root = uf.find(w);
    const g = groups.get(root) ?? [];
    g.push(w);
    groups.set(root, g);
  }

  const clusters: WalletCluster[] = [];
  let independent = 0;
  let letter = 65; // 'A'

  for (const members of groups.values()) {
    if (members.length < 2) {
      independent++;
      continue;
    }
    const reasons: string[] = [];

    // Same-funder subset size.
    if (funding) {
      const bySource = new Map<string, number>();
      for (const w of members) {
        const src = funding.get(w);
        if (src) bySource.set(src, (bySource.get(src) ?? 0) + 1);
      }
      const [src, n] = [...bySource.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
      if (n >= 2) reasons.push(`${n} funded from ${src.slice(0, 6)}…${src.slice(-4)}`);
    }

    // Repeat buyers of this deployer.
    if (history) {
      const repeat = members.filter((w) => history.walletDeployerHits(w, String(deployer), String(token)) >= 1).length;
      if (repeat >= 2) reasons.push(`${repeat} repeatedly buy this deployer's launches`);
    }

    // Tight co-entry count.
    const blocks = members.map((w) => firstBlock.get(w)!);
    const span = Number((blocks.reduce((m, x) => (x > m ? x : m), 0n) - blocks.reduce((m, x) => (x < m ? x : m), blocks[0])));
    if (span <= windowBlocks) reasons.push(`${members.length} entered within ${Math.max(1, span)} block${span === 1 ? "" : "s"}`);

    // Historical co-occurrences across the cluster.
    if (history) {
      let co = 0;
      for (let i = 0; i < members.length; i++)
        for (let j = i + 1; j < members.length; j++) co += history.coOccurrences(members[i], members[j], String(token));
      if (co > 0) reasons.push(`${co} historical co-occurrence${co === 1 ? "" : "s"}`);
    }

    // Funnel to a shared recipient.
    for (const [rcpt, set] of recipientOf) {
      const inside = members.filter((w) => set.has(w)).length;
      if (inside >= 3) {
        reasons.push(`${inside} route tokens to ${rcpt.slice(0, 6)}…${rcpt.slice(-4)}`);
        break;
      }
    }

    if (!reasons.length) reasons.push(`${members.length} wallets co-entered`);

    // Confidence: weighted blend of the evidence that fired.
    let conf = 0;
    const has = (re: RegExp) => reasons.some((r) => re.test(r));
    if (has(/funded from/)) conf += 40;
    if (has(/co-occurrence/)) conf += 26;
    if (has(/repeatedly buy/)) conf += 18;
    if (has(/entered within/)) conf += 16;
    if (has(/route tokens/)) conf += 18;
    conf = Math.min(99, conf + Math.min(10, members.length));

    const strong = has(/funded from/) || has(/co-occurrence/) || has(/repeatedly buy/);
    const kind: ClusterKind = strong && conf >= 65 ? "insider" : conf >= 45 ? "bundle" : "clean";

    clusters.push({
      id: String.fromCharCode(letter++),
      kind,
      wallets: members,
      confidence: conf,
      reasons,
    });
  }

  clusters.sort((a, b) => b.confidence - a.confidence);
  const topConfidence = clusters[0]?.confidence ?? 0;
  const insider = clusters.find((c) => c.kind === "insider");
  const verdict = insider
    ? "INSIDER CLUSTER"
    : clusters.some((c) => c.kind === "bundle")
      ? "LIKELY BUNDLE"
      : total > 0
        ? "INDEPENDENT DEMAND"
        : "NO DATA";

  return {
    totalBuyers: total,
    independent,
    clusters,
    verdict,
    topConfidence,
    signalsUsed: [...signalsUsed],
  };
}
