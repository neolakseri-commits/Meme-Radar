// Terminal styling primitives: truecolor palette, badges, clickable links,
// and width-aware padding that accounts for invisible escape sequences.

const noColor = (): boolean => Boolean(process.env.NO_COLOR);

// Some terminals set TERM=dumb or lack truecolor; we stay on 24-bit by default
// (every modern trader terminal supports it) but honour NO_COLOR completely.
const fg = (r: number, g: number, b: number, v: string): string =>
  noColor() ? v : `\x1b[38;2;${r};${g};${b}m${v}\x1b[0m`;
const bg = (r: number, g: number, b: number, fr: number, fg2: number, fb: number, v: string): string =>
  noColor() ? v : `\x1b[48;2;${r};${g};${b}m\x1b[38;2;${fr};${fg2};${fb}m${v}\x1b[0m`;
const sgr = (code: string, v: string): string => (noColor() ? v : `\x1b[${code}m${v}\x1b[0m`);

// Brand + trader-terminal palette.
export const c = {
  brand: (v: string) => fg(255, 155, 66, v), // #ff9b42
  amber: (v: string) => fg(255, 177, 92, v), // #ffb15c
  green: (v: string) => fg(74, 222, 128, v), // #4ade80
  red: (v: string) => fg(255, 92, 92, v), // #ff5c5c
  yellow: (v: string) => fg(255, 210, 63, v), // #ffd23f
  violet: (v: string) => fg(192, 124, 255, v), // #c07cff
  cyan: (v: string) => fg(79, 209, 255, v), // #4fd1ff
  text: (v: string) => fg(232, 226, 218, v), // #e8e2da
  muted: (v: string) => fg(138, 128, 118, v), // #8a8076
  dim: (v: string) => fg(86, 80, 73, v), // #565049
  bold: (v: string) => sgr("1", v),
};

// Solid, high-contrast badge — the block that reads like a physical tag in the
// competitor terminals. Dark ink on a bright fill.
export const badge = {
  signal: (v: string) => c.bold(bg(255, 155, 66, 20, 16, 12, ` ${v} `)),
  watch: (v: string) => c.bold(bg(255, 210, 63, 30, 26, 12, ` ${v} `)),
  none: (v: string) => c.bold(bg(120, 110, 102, 18, 16, 14, ` ${v} `)),
  live: (v: string) => c.bold(bg(74, 222, 128, 12, 24, 16, ` ${v} `)),
  danger: (v: string) => c.bold(bg(255, 92, 92, 24, 12, 12, ` ${v} `)),
};

// OSC 8 hyperlink — turns any label into a clickable "button" in iTerm2,
// WezTerm, Kitty, Windows Terminal, GNOME Terminal, etc. Degrades to plain
// text elsewhere. Suppressed under NO_COLOR / when hyperlinks are disabled.
export function link(url: string, label: string): string {
  if (noColor() || process.env.RADAR_NO_HYPERLINKS) return label;
  return `\x1b]8;;${url}\x1b\\${label}\x1b]8;;\x1b\\`;
}

// A clickable pill styled like a button: [ Label ].
export function button(url: string, label: string, tone: (v: string) => string = c.cyan): string {
  return c.dim("[") + tone(link(url, label)) + c.dim("]");
}

const ANSI = /\x1b\[[0-9;]*m/g;
const OSC8 = /\x1b\]8;;[^\x07\x1b]*(?:\x07|\x1b\\)/g;

/** Visible width of a string, ignoring SGR colors and OSC 8 link wrappers. */
export function vlen(s: string): number {
  return s.replace(OSC8, "").replace(ANSI, "").length;
}

/** Pad the visible content on the right to `width` columns. */
export function padV(s: string, width: number): string {
  const gap = width - vlen(s);
  return gap > 0 ? s + " ".repeat(gap) : s;
}

/** A horizontal gauge like ▰▰▰▱▱ for a 0..100 value. */
export function gauge(pct: number, cells = 8): string {
  const filled = Math.max(0, Math.min(cells, Math.round((pct / 100) * cells)));
  return "▰".repeat(filled) + "▱".repeat(cells - filled);
}
