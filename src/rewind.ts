// REWIND.
//
// The radar sees every launch from block zero. REWIND replays what it saw for a
// token over time — score climbing, the moment a critical signal fired, the
// market cap at that moment, and the eventual peak — so a trader can study (or
// prove) the setup that preceded a run.

import type { RewindPoint, RewindTimeline } from "./types.js";
import type { Snapshot, WalletHistory } from "./history.js";

function offsetLabel(sec: number): string {
  if (sec <= 0) return "T+0";
  if (sec < 90) return `T+${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `T+${m}m${s ? `${s}s` : ""}`;
  const h = Math.floor(m / 60);
  return `T+${h}h${m % 60 ? `${m % 60}m` : ""}`;
}

export function buildRewind(
  token: string,
  symbol: string,
  quoteSymbol: string,
  history: WalletHistory,
): RewindTimeline | null {
  const snaps = history.getSnapshots(token);
  if (!snaps.length) return null;
  const t0 = snaps[0].ts;

  let firstCriticalIdx = -1;
  const points: RewindPoint[] = snaps.map((s, i): RewindPoint => {
    const critical = s.critical && firstCriticalIdx === -1 ? ((firstCriticalIdx = i), true) : false;
    const notes: string[] = [];
    if (critical) {
      notes.push(`${s.indepBuyers} independent buyers`);
      const prev = i > 0 ? snaps[i - 1] : null;
      if (prev && prev.indepBuyers > 0) {
        const vel = Math.round(((s.indepBuyers - prev.indepBuyers) / prev.indepBuyers) * 100);
        if (vel > 0) notes.push(`buyer velocity +${vel}%`);
      }
      if (prev && s.concentration < prev.concentration) notes.push("concentration falling");
    }
    return { tLabel: offsetLabel(s.ts - t0), score: s.score, critical, notes, mcQuote: s.mcQuote };
  });

  const mcs = snaps.map((s) => s.mcQuote).filter((x): x is number => x !== null);
  const peakMcQuote = mcs.length ? Math.max(...mcs) : null;
  const signalMcQuote = firstCriticalIdx >= 0 ? snaps[firstCriticalIdx].mcQuote : null;

  return {
    symbol,
    token,
    quoteSymbol,
    points,
    signalMcQuote,
    peakMcQuote,
    peakMultiple: history.peakMultiple(token),
  };
}

export type { Snapshot };
