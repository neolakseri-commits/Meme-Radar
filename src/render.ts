import type { LaunchProfile, ScoreResult, Verdict } from "./types.js";
import { explorer } from "./chain.js";
import { config } from "./config.js";
import { c, badge, link, padV, gauge } from "./theme.js";
import { fomoStrip, fomoApps } from "./fomo.js";

const short = (v: string) => `${v.slice(0, 6)}…${v.slice(-4)}`;
const pct = (v: number) => `${v.toFixed(1)}%`;
const eth = (v: bigint) => `${(Number(v) / 1e18).toFixed(3)} ETH`;
const ethc = (v: bigint) => (Number(v) / 1e18).toFixed(2);
const localTime = (timestamp: number | null) =>
  (timestamp ? new Date(timestamp * 1000) : new Date()).toISOString().slice(11, 19);

const WIDTH = 76;

const verdictTone: Record<Verdict, (v: string) => string> = {
  SIGNAL: c.brand,
  WATCH: c.yellow,
  "NO SIGNAL": c.red,
};

const verdictBadge = (v: Verdict): string =>
  v === "SIGNAL" ? badge.signal(v) : v === "WATCH" ? badge.watch(v) : badge.none(v);

// A block bar tinted by verdict — the compact confidence read at a glance.
const scoreBar = (n: number, tone: (v: string) => string): string => {
  const filled = Math.max(0, Math.min(12, Math.round((n / 100) * 12)));
  return tone("█".repeat(filled)) + c.dim("░".repeat(12 - filled));
};

// Color a metric value by whether it reads healthy, cautionary, or dangerous.
const devTone = (p: number | null): string => {
  if (p === null) return c.muted("?");
  const s = `${p.toFixed(2)}%`;
  if (p === 0) return c.red(s);
  if (p <= 6) return c.green(s);
  if (p > 10) return c.red(s);
  return c.yellow(s);
};
const holderTone = (p: number): string => {
  const s = pct(p);
  if (p > 25) return c.red(s);
  if (p > 15) return c.yellow(s);
  return c.green(s);
};

export function render(profile: LaunchProfile, score: ScoreResult): string {
  const v = score.verdict;
  const tone = verdictTone[v];
  const edge = tone("▌");
  const row = (body: string): string => `${edge} ${body}`;

  const devPct =
    profile.devBuyWei !== null && profile.devTokens !== null && profile.totalSupply > 0n
      ? Number((profile.devTokens * 10_000n) / profile.totalSupply) / 100
      : null;

  // ── header ───────────────────────────────────────────────────────────
  const sym = c.bold(c.green("$" + (profile.symbol || "?")));
  const name = c.text(profile.name || "unnamed token");
  const header = `${c.muted(localTime(profile.timestamp))}  ${verdictBadge(v)}  ${sym}  ${scoreBar(
    score.total,
    tone,
  )} ${tone(String(score.total).padStart(3))}${c.dim("/100")}  ${c.dim("·" + profile.phase)}`;

  const tokenLink = link(explorer.token(profile.event.token), short(profile.event.token));
  const nameLine = `${name}  ${c.dim(tokenLink)}`;

  // ── evidence (two columns) ───────────────────────────────────────────
  const colorReason = (r: string): string =>
    r.startsWith("+") ? c.green(r) : r.startsWith("-") ? c.red(r) : c.muted(r);
  const evidence: string[] = [];
  for (let i = 0; i < score.reasons.length; i += 2) {
    const left = padV(colorReason(score.reasons[i]), 37);
    const right = score.reasons[i + 1] ? colorReason(score.reasons[i + 1]) : "";
    evidence.push(row(`${left}${right}`.trimEnd()));
  }

  // ── metric grid (two columns) ────────────────────────────────────────
  const label = (t: string) => c.muted(padV(t, 12));
  const cell = (v1: string) => padV(v1, 25);
  const metric = (l1: string, v1: string, l2: string, v2: string): string =>
    row(`${label(l1)}${cell(v1)}${c.muted(padV(l2, 11))}${v2}`);

  const devVal = `${devTone(devPct)}${
    devPct !== null && profile.devBuyWei !== null ? c.dim(" " + ethc(profile.devBuyWei) + "Ξ") : ""
  }`;
  const fill = profile.curve.fillPct;
  const curveVal = `${c.amber(gauge(fill, 6))} ${c.text(pct(fill))} ${c.dim(
    `${ethc(profile.curve.realQuoteReserve)}/${ethc(profile.curve.graduationThreshold)}Ξ`,
  )}`;
  const taxVal =
    profile.curve.openingTaxBps === null
      ? c.muted("?")
      : c.text(`${(Number(profile.curve.openingTaxBps) / 100).toFixed(2)}%`);
  const deployerVal = profile.deployer
    ? `${c.text(String(profile.deployer.launches))}${c.muted(" launches")} ${c.green(
        String(profile.deployer.graduated),
      )}${c.muted(" grad")}`
    : c.muted("unavailable");
  const flowVal = `${c.text(String(profile.buyers.firstWindowUniqueBuyers))}${c.muted(
    " buyers",
  )} ${c.dim("/ " + profile.buyers.firstWindowBuys + " buys · " + profile.buyers.taxedBuys + " taxed")}`;
  const bundleVal = profile.exemptions.length
    ? c.yellow(`${profile.exemptions.length} exempt`)
    : c.green("none");
  const fundingVal = c.dim("— indexer adapter");

  const grid = [
    metric("dev buy", devVal, "early flow", flowVal),
    metric("curve fill", curveVal, "top holder", holderTone(profile.buyers.topRecipientSharePct)),
    metric("opening tax", taxVal, "bundle", bundleVal),
    metric("deployer", deployerVal, "funding", fundingVal),
  ];

  // ── trade strip ──────────────────────────────────────────────────────
  const trade = config.fomo ? [row(fomoStrip(profile.event.token, profile.event.deployer))] : [];

  const lines = [
    row(header),
    row(nameLine),
    row(""),
    row(c.dim("EVIDENCE")),
    ...evidence,
    row(""),
    ...grid,
    row(""),
    ...trade,
  ];
  return lines.join("\n") + "\n" + tone("▙" + "▄".repeat(WIDTH));
}

export function toJson(profile: LaunchProfile, score: ScoreResult): string {
  return JSON.stringify({
    token: profile.event.token,
    symbol: profile.symbol,
    name: profile.name,
    score: score.total,
    verdict: score.verdict,
    reasons: score.reasons,
    deployer: profile.event.deployer,
    deployerStats: profile.deployer,
    phase: profile.phase,
    creatorTaxBps: profile.curve.creatorTaxBps.toString(),
    devBuyWei: profile.devBuyWei?.toString() ?? null,
    exemptions: profile.exemptions,
    buyers: {
      ...profile.buyers,
      totalQuoteIn: profile.buyers.totalQuoteIn.toString(),
      totalTokensOut: profile.buyers.totalTokensOut.toString(),
    },
    curve: {
      ...profile.curve,
      realQuoteReserve: profile.curve.realQuoteReserve.toString(),
      graduationThreshold: profile.curve.graduationThreshold.toString(),
      sellableTokens: profile.curve.sellableTokens.toString(),
      reservedTokens: profile.curve.reservedTokens.toString(),
      openingTaxBps: profile.curve.openingTaxBps?.toString() ?? null,
      creatorTaxBps: profile.curve.creatorTaxBps.toString(),
    },
    links: {
      pons: explorer.pons(profile.event.token),
      chart: explorer.token(profile.event.token),
      deployer: explorer.address(profile.event.deployer),
      fomo: fomoApps.map((a) => ({
        name: a.name,
        url: a.url.replace(/\{token\}/g, profile.event.token).replace(/\{deployer\}/g, profile.event.deployer),
      })),
    },
    dataGaps: profile.dataGaps,
  });
}
