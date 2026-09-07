import { c, badge, padV, vlen } from "./theme.js";

const glyphs: Record<string, string[]> = {
  M: ["█▄ ▄█", "█ ▀ █", "█   █", "█   █", "▀   ▀"],
  E: ["█████", "█▄▄  ", "█▀▀  ", "█▄▄▄ ", "▀▀▀▀▀"],
  R: ["████ ", "█   █", "████ ", "█  █ ", "▀   ▀"],
  A: ["▄███▄", "█   █", "█████", "█   █", "▀   ▀"],
  D: ["████ ", "█   █", "█   █", "█   █", "▀▀▀▀ "],
};

function wordmark(): string[] {
  return Array.from({ length: 5 }, (_, row) =>
    "  " +
    "MEME RADAR"
      .split("")
      .map((letter) => (letter === " " ? "   " : glyphs[letter][row]))
      .join(" "),
  );
}

const WIDTH = 76;

export function radarBanner(mode: "hunt" | "backfill"): string {
  const rule = c.dim("═".repeat(WIDTH));
  const modeTag = mode === "hunt" ? badge.live("LIVE") : c.violet("BACKFILL");
  const rows = wordmark();
  return [
    "",
    // Gradient-feel wordmark: brand orange fading into amber toward the base.
    ...rows.map((r, i) => (i < 3 ? c.brand(r) : c.amber(r))),
    "",
    `  ${modeTag}  ${c.violet("MOMENTUM DESK")}  ${c.muted("Robinhood Chain · 4663 · read-only intelligence")}`,
    `  ${c.dim(mode === "hunt" ? "watching launches, flow and lifecycle — evidence over hype" : "profiling launches, flow and lifecycle from chain history")}`,
    `  ${c.brand("SIGNALS")} ${c.dim("·")} ${c.text("momentum")}   ${c.brand("FLOW")} ${c.dim("·")} ${c.text("graduation")}   ${c.brand("RISK")} ${c.dim("·")} ${c.text("wallet graph")}`,
    `  ${rule}`,
  ].join("\n");
}

export function radarHeader(args: {
  transport: string;
  history: string;
  launches: number;
  signals: number;
  watching: number;
}): string {
  const cell = (label: string, value: string): string => `${c.brand(label)} ${c.text(value)}`;
  const stats =
    `${cell("feed", args.transport)}   ${cell("history", args.history)}   ` +
    `${c.green(String(args.launches))} ${c.muted("launches")}  ${c.brand(String(args.signals))} ${c.muted("signals")}  ${c.yellow(String(args.watching))} ${c.muted("watch")}`;
  const bar = padV(`  ${stats}`, WIDTH + 2);
  return [bar, `  ${c.dim("─".repeat(WIDTH))}`].join("\n");
}

// exported for tests / reuse
export const bannerWidth = WIDTH;
export const _vlen = vlen;

