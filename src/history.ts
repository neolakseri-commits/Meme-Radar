// Lightweight append-only memory of launches the radar has already profiled.
// It is what lets a later launch say "these 4 wallets keep showing up together"
// and lets Deployer DNA describe a deployer's habits. Persisted as JSON so the
// intelligence compounds across sessions; degrades gracefully to empty.

import { readFileSync, writeFileSync } from "node:fs";
import type { Address } from "viem";

export interface LaunchRecord {
  token: string;
  deployer: string;
  block: number;
  timestamp: number | null;
  graduated: boolean;
  gradBlock: number | null;
  earlyWallets: string[]; // lowercased unique early buyers
  devBuyPct: number | null;
  socials: number;
  topSharePct: number;
  fillPct?: number;
}

// A point-in-time observation of a token, appended as the radar re-sees it.
// The series is what powers REWIND and buyer-velocity / acceleration signals.
export interface Snapshot {
  ts: number; // unix seconds
  block: number;
  score: number;
  fillPct: number;
  indepBuyers: number; // independent (non-clustered) early buyers
  concentration: number; // top recipient share %
  mcQuote: number | null; // fully-diluted market cap, in the quote token
  critical: boolean; // radar considered this a signal
}

const lc = (a: string): string => a.toLowerCase();
const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

interface Persisted {
  records: LaunchRecord[];
  snapshots: Record<string, Snapshot[]>;
  prices: Record<string, { first: number; max: number }>;
}

export class WalletHistory {
  private records: LaunchRecord[] = [];
  private readonly byWallet = new Map<string, Set<string>>(); // wallet -> token set
  private readonly seen = new Set<string>(); // token keys already recorded
  private readonly snapshots = new Map<string, Snapshot[]>(); // token -> series
  private readonly prices = new Map<string, { first: number; max: number }>(); // token -> price extremes
  private dirty = false;

  constructor(private readonly path: string | null = null) {
    if (path) this.load();
  }

  private load(): void {
    if (!this.path) return;
    try {
      const raw = JSON.parse(readFileSync(this.path, "utf8")) as Persisted | LaunchRecord[];
      const data: Persisted = Array.isArray(raw)
        ? { records: raw, snapshots: {}, prices: {} }
        : { records: raw.records ?? [], snapshots: raw.snapshots ?? {}, prices: raw.prices ?? {} };
      for (const r of data.records) this.ingest(r);
      for (const [k, v] of Object.entries(data.snapshots)) this.snapshots.set(k, v);
      for (const [k, v] of Object.entries(data.prices)) this.prices.set(k, v);
    } catch {
      /* first run, missing or corrupt file — start empty */
    }
  }

  save(): void {
    if (!this.path || !this.dirty) return;
    try {
      const data: Persisted = {
        records: this.records,
        snapshots: Object.fromEntries(this.snapshots),
        prices: Object.fromEntries(this.prices),
      };
      writeFileSync(this.path, JSON.stringify(data));
      this.dirty = false;
    } catch {
      /* read-only fs is fine; history simply won't persist */
    }
  }

  private ingest(r: LaunchRecord): void {
    const key = lc(r.token);
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.records.push(r);
    for (const w of r.earlyWallets) {
      const set = this.byWallet.get(w) ?? new Set<string>();
      set.add(key);
      this.byWallet.set(w, set);
    }
  }

  record(r: LaunchRecord): void {
    if (this.seen.has(lc(r.token))) return;
    this.ingest({ ...r, token: lc(r.token), deployer: lc(r.deployer), earlyWallets: r.earlyWallets.map(lc) });
    this.dirty = true;
  }

  size(): number {
    return this.records.length;
  }

  /** How many past launches wallet `w` appears in (excluding `exceptToken`). */
  walletLaunchCount(w: string, exceptToken?: string): number {
    const set = this.byWallet.get(lc(w));
    if (!set) return 0;
    return exceptToken ? [...set].filter((t) => t !== lc(exceptToken)).length : set.size;
  }

  /** Past launches (excluding one) where both wallets appear together. */
  coOccurrences(a: string, b: string, exceptToken?: string): number {
    const sa = this.byWallet.get(lc(a));
    const sb = this.byWallet.get(lc(b));
    if (!sa || !sb) return 0;
    let n = 0;
    for (const t of sa) if (t !== lc(exceptToken ?? "") && sb.has(t)) n++;
    return n;
  }

  /** How many of this deployer's past launches wallet `w` bought into. */
  walletDeployerHits(w: string, deployer: string, exceptToken?: string): number {
    const set = this.byWallet.get(lc(w));
    if (!set) return 0;
    let n = 0;
    for (const r of this.records) {
      if (r.deployer === lc(deployer) && r.token !== lc(exceptToken ?? "") && set.has(r.token)) n++;
    }
    return n;
  }

  // ── time-series (REWIND / acceleration) ────────────────────────────────
  snapshot(token: string, s: Snapshot): void {
    const key = lc(token);
    const series = this.snapshots.get(key) ?? [];
    const last = series[series.length - 1];
    // De-dupe near-identical consecutive reads (same block, same score).
    if (last && last.block === s.block && last.score === s.score && last.indepBuyers === s.indepBuyers) return;
    series.push(s);
    if (series.length > 240) series.shift();
    this.snapshots.set(key, series);
    this.dirty = true;
  }

  getSnapshots(token: string): Snapshot[] {
    return this.snapshots.get(lc(token)) ?? [];
  }

  /** Record a price observation; returns the running peak multiple (max/first). */
  observePrice(token: string, price: number | null): number | null {
    if (price === null || !(price > 0)) return this.peakMultiple(token);
    const key = lc(token);
    const p = this.prices.get(key) ?? { first: price, max: price };
    p.max = Math.max(p.max, price);
    this.prices.set(key, p);
    this.dirty = true;
    return p.first > 0 ? p.max / p.first : null;
  }

  peakMultiple(token: string): number | null {
    const p = this.prices.get(lc(token));
    return p && p.first > 0 ? p.max / p.first : null;
  }

  /** Earliest recorded fill % for a token (for fill velocity). */
  firstFill(token: string): number | null {
    const s = this.snapshots.get(lc(token));
    return s && s.length ? s[0].fillPct : null;
  }

  /**
   * How comparable historical launches performed. A "similar setup" matches on
   * early-crowd size, dev-buy weight, and concentration bands. Used by the
   * Opportunity read ("12 / 19 reached graduation").
   */
  similarSetups(
    sample: { earlyWallets: number; devBuyPct: number | null; topSharePct: number },
    exceptToken?: string,
  ): { graduated: number; total: number } {
    let total = 0;
    let graduated = 0;
    for (const r of this.records) {
      if (exceptToken && r.token === lc(exceptToken)) continue;
      const walletsClose = Math.abs(r.earlyWallets.length - sample.earlyWallets) <= 4;
      const devClose =
        sample.devBuyPct === null || r.devBuyPct === null
          ? true
          : Math.abs(r.devBuyPct - sample.devBuyPct) <= 2;
      const concClose = Math.abs(r.topSharePct - sample.topSharePct) <= 10;
      if (walletsClose && devClose && concClose) {
        total++;
        if (r.graduated) graduated++;
      }
    }
    return { graduated, total };
  }

  deployerRecords(deployer: Address | string): LaunchRecord[] {
    return this.records.filter((r) => r.deployer === lc(String(deployer)));
  }

  /** Aggregated deployer facts used by Deployer DNA. */
  deployerAggregate(deployer: Address | string): {
    count: number;
    graduated: number;
    medianGradBlocks: number | null;
    medianEarlyWallets: number | null;
    medianDevBuyPct: number | null;
  } {
    const rs = this.deployerRecords(deployer);
    const gradBlocks = rs
      .filter((r) => r.graduated && r.gradBlock !== null)
      .map((r) => r.gradBlock! - r.block);
    return {
      count: rs.length,
      graduated: rs.filter((r) => r.graduated).length,
      medianGradBlocks: median(gradBlocks),
      medianEarlyWallets: median(rs.map((r) => r.earlyWallets.length).filter((n) => n > 0)),
      medianDevBuyPct: median(rs.map((r) => r.devBuyPct).filter((x): x is number => x !== null)),
    };
  }
}
