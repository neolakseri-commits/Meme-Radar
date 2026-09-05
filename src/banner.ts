const paint = (code: string, value: string) => process.env.NO_COLOR ? value : `\x1b[${code}m${value}\x1b[0m`;

const glyphs: Record<string, string[]> = {
  M: ["█   █", "██ ██", "█ █ █", "█   █", "█   █"],
  E: ["█████", "█    ", "████ ", "█    ", "█████"],
  R: ["████ ", "█   █", "████ ", "█ █  ", "█  ██"],
  A: [" ███ ", "█   █", "█████", "█   █", "█   █"],
  D: ["████ ", "█   █", "█   █", "█   █", "████ "],
};

function wordmark(): string[] {
  return Array.from({ length: 5 }, (_, row) => "  " + "MEME RADAR".split("").map((letter) => letter === " " ? "   " : glyphs[letter][row]).join(" "));
}

export function radarBanner(mode: "hunt" | "backfill"): string {
  const orange = (v: string) => paint("38;5;208", v);
  const violet = (v: string) => paint("38;5;213", v);
  const dim = (v: string) => paint("38;5;244", v);
  const line = orange("═".repeat(76));
  return [
    "",
    ...wordmark().map(orange),
    "",
    `  ${violet("RADAR")}  ${dim("onchain launch intelligence · Robinhood Chain · 4663")}`,
    `  ${dim(mode === "hunt" ? "live discovery feed" : "historical backfill")}`,
    `  ${line}`,
  ].join("\n");
}

export function radarHeader(args: { transport: string; history: string; launches: number; signals: number; watching: number }): string {
  const dim = (v: string) => paint("38;5;244", v);
  const bright = (v: string) => paint("97", v);
  return [
    `  ${bright("feed")}       ${args.transport}`,
    `  ${bright("history")}    ${args.history}`,
    `  ${bright("session")}    ${args.launches} launches  ·  ${args.signals} signals  ·  ${args.watching} watch`,
    `  ${dim("────────────────────────────────────────────────────────────────────────────")}`,
  ].join("\n");
}
