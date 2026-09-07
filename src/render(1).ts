import type { CapitalRotationRead, ClusterAnalysis, DeployerDNA, GraduationRead, LaunchProfile, MarketData, MomentumIntelligence, OpportunityRead, PoolHealth, RewindTimeline, ScoreResult, TapeEntry, Verdict, WalletCluster } from "./types.js";
import { explorer } from "./chain.js";
import { config } from "./config.js";
import { c, badge, link, padV, gauge } from "./theme.js";
import { fomoStrip, fomoApps } from "./fomo.js";
import { fmtDuration } from "./dna.js";

const shortAddr = (v: string) => `${v.slice(0, 6)}…${v.slice(-4)}`;

// Compact number: 1234 → 1.2K, 2_200_000 → 2.2M.
function fmtNum(n: number, dp = 2): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + "K";
  if (abs > 0 && abs < 0.001) return n.toExponential(1);
  return n.toFixed(dp);
}

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

const clusterTone = (k: WalletCluster["kind"]): ((v: string) => string) =>
  k === "insider" ? c.red : k === "bundle" ? c.yellow : c.green;

const clusterBadge = (a: ClusterAnalysis): string =>
  a.verdict === "INSIDER CLUSTER"
    ? badge.danger(a.verdict)
    : a.verdict === "LIKELY BUNDLE"
      ? badge.watch(a.verdict)
      : a.verdict === "INDEPENDENT DEMAND"
        ? badge.live(a.verdict)
        : c.muted(a.verdict);

// ── Wallet Intelligence Graph ──────────────────────────────────────────
function renderClusters(a: ClusterAnalysis, row: (b: string) => string): string[] {
  if (a.totalBuyers === 0) return [];
  const linked = a.clusters.length;
  const summary =
    `${c.text(String(a.totalBuyers))}${c.muted(" buyers")} ${c.dim("→")} ` +
    `${linked ? c.text(String(linked)) : c.muted("0")}${c.muted(linked === 1 ? " cluster" : " clusters")} ` +
    `${c.dim("·")} ${c.text(String(a.independent))}${c.muted(" independent")}`;
  const out = [row(`${c.dim("WALLET GRAPH")}  ${summary}  ${clusterBadge(a)}`)];
  for (const cl of a.clusters) {
    const tone = clusterTone(cl.kind);
    out.push(
      row(
        `${tone("▸")} ${tone(c.bold(cl.id))}  ${tone(cl.kind.toUpperCase())} ${tone(cl.confidence + "%")}` +
          `  ${c.muted(cl.wallets.length + " wallets")}`,
      ),
    );
    cl.reasons.forEach((reason, i) => {
      const branch = i === cl.reasons.length - 1 ? "└" : "├";
      out.push(row(`  ${c.dim(branch)} ${c.muted(reason)}`));
    });
  }
  return out;
}

// ── Deployer DNA ───────────────────────────────────────────────────────
function renderDNA(d: DeployerDNA, row: (b: string) => string): string[] {
  const short = (v: string) => `${v.slice(0, 6)}…${v.slice(-4)}`;
  const gradTone = d.gradRatePct >= 30 ? c.green : d.gradRatePct > 0 ? c.yellow : c.red;
  const stat = (n: string, v: string) => `${c.text(v)}${c.muted(" " + n)}`;
  const line2 =
    `${stat("launches", String(d.launches))}  ` +
    `${gradTone(String(d.graduated))}${c.muted(" grad")} ${gradTone(`(${d.gradRatePct}%)`)}  ` +
    `${d.medianTimeToGradSec !== null ? stat("med→grad", fmtDuration(d.medianTimeToGradSec)) : c.dim("med→grad —")}  ` +
    `${d.medianEarlyWallets !== null ? stat("med wallets", String(d.medianEarlyWallets)) : c.dim("med wallets —")}  ` +
    `${d.medianDevBuyPct !== null ? stat("med dev", d.medianDevBuyPct.toFixed(1) + "%") : c.dim("med dev —")}`;
  return [
    row(`${c.dim("DEPLOYER DNA")}  ${c.muted(short(d.deployer))}`),
    row(line2),
    row(`${c.muted("typical")}  ${c.violet(d.typical.join(c.dim(" · ")))}`),
  ];
}

// ── live market read ───────────────────────────────────────────────────
function renderMarket(m: MarketData, row: (b: string) => string): string {
  const price = m.priceQuote !== null ? `${c.text(fmtNum(m.priceQuote, 6))} ${c.muted(m.quoteSymbol)}` : c.muted("—");
  const mc = m.marketCapQuote !== null ? `${c.text(fmtNum(m.marketCapQuote))} ${c.muted(m.quoteSymbol)}` : c.muted("—");
  const liq = `${c.text(fmtNum(m.liquidityQuote))} ${c.muted(m.quoteSymbol)}`;
  const vel = m.fillVelocityPct !== null && m.fillVelocityPct !== 0
    ? m.fillVelocityPct > 0 ? c.green(` ▲+${m.fillVelocityPct}`) : c.red(` ▼${m.fillVelocityPct}`)
    : "";
  const peak = m.peakMultiple !== null ? `  ${c.muted("peak")} ${c.violet(m.peakMultiple.toFixed(1) + "×")}` : "";
  return row(
    `${c.dim("MARKET")}  ${c.muted("price")} ${price}  ${c.muted("mcap")} ${mc}  ${c.muted("liq")} ${liq}  ${c.muted("fill")} ${c.text(m.fillPct.toFixed(1) + "%")}${vel}${peak}`,
  );
}

// ── opportunity read ───────────────────────────────────────────────────
function renderOpportunity(o: OpportunityRead, row: (b: string) => string): string[] {
  const oppTone = o.opportunity >= 70 ? c.brand : o.opportunity >= 45 ? c.yellow : c.muted;
  const posTone = o.position === "EARLY" ? c.green : o.position === "MID" ? c.yellow : c.muted;
  const accTone = o.acceleration === "HIGH" ? c.green : o.acceleration === "MEDIUM" ? c.yellow : c.muted;
  const growth = o.independentGrowthPct !== null
    ? `  ${c.muted("indep")} ${o.independentGrowthPct >= 0 ? c.green("+" + o.independentGrowthPct + "%") : c.red(o.independentGrowthPct + "%")}`
    : "";
  const comps = o.comp ? `  ${c.muted("comps")} ${c.text(o.comp.graduated + "/" + o.comp.total)}${c.muted(" grad")}` : "";
  const head = row(
    `${c.dim("OPPORTUNITY")}  ${oppTone(c.bold(String(o.opportunity)))}${c.dim("/100")}  ${posTone(o.position)}  ${c.muted("accel")} ${accTone(o.acceleration)}${growth}${comps}`,
  );
  if (!o.tags.length) return [head];
  const tagTone = (t: string) => (t.includes("CAUTION") ? c.red : t === "UNUSUALLY EARLY" ? c.brand : c.green);
  return [head, row(`  ${o.tags.map((t) => tagTone(t)("⟐ " + t)).join(c.dim("  "))}`)];
}

// ── the tape ───────────────────────────────────────────────────────────
function renderTape(tape: TapeEntry[], quoteSymbol: string, row: (b: string) => string): string[] {
  if (!tape.length) return [];
  const out = [row(c.dim("THE TAPE"))];
  for (const e of tape) {
    const side = e.side === "buy" ? c.green("▲ buy ") : c.red("▼ sell");
    const size = `${c.text(fmtNum(e.sizeQuote, 3))} ${c.muted(quoteSymbol)}`;
    const tag = e.txHash ? link(explorer.tx(e.txHash), shortAddr(e.wallet)) : shortAddr(e.wallet);
    out.push(row(`  ${side}  ${padV(size, 16)} ${c.dim(tag)}${e.taxed ? c.yellow(" taxed") : ""}`));
  }
  return out;
}

function formatFlow(value: number | null, symbol: string): string {
  if (value === null || !Number.isFinite(value)) return c.muted("—");
  const prefix = value > 0 ? "+" : "";
  return `${value >= 0 ? c.green(prefix + fmtNum(value, 2)) : c.red(fmtNum(value, 2))} ${c.muted(symbol + "/min")}`;
}

function renderMomentum(m: MomentumIntelligence, row: (b: string) => string): string[] {
  const signal = m.signal === "BUILDING" ? c.green("BUILDING ▲") : m.signal === "FADING" ? c.red("FADING ▼") : c.yellow("STABLE →");
  const rotation = m.walletRotation === "HIGH" ? c.green(m.walletRotation) : m.walletRotation === "MEDIUM" ? c.yellow(m.walletRotation) : c.muted(m.walletRotation);
  const demand = m.demandQuality === null ? c.muted("—") : c.text(`${m.demandQuality}/100`);
  const pressure = m.buyPressure === null ? c.muted("—") : c.text(`${m.buyPressure.toFixed(1)}x`);
  const velocity = m.buyerVelocityPct === null ? c.muted("—") : m.buyerVelocityPct >= 0 ? c.green(`+${m.buyerVelocityPct}%`) : c.red(`${m.buyerVelocityPct}%`);
  const exit = m.exitRisk === null ? c.muted("—") : m.exitRisk >= 60 ? c.red(`${m.exitRisk}/100`) : m.exitRisk >= 30 ? c.yellow(`${m.exitRisk}/100`) : c.green(`${m.exitRisk}/100`);
  return [
    row(c.brand(c.bold("MOMENTUM INTELLIGENCE"))),
    row(`${c.muted("lifecycle")} ${c.violet(c.bold(m.lifecycle))}    ${c.muted("signal")} ${signal}`),
    row(`${c.muted("demand quality")} ${demand}    ${c.muted("wallet rotation")} ${rotation}`),
    row(`${c.muted("buy pressure")} ${pressure}        ${c.muted("buyer velocity")} ${velocity}`),
    row(`${c.muted("exit risk")} ${exit}             ${c.dim("data confidence")} ${c.text(m.dataConfidence + "/100")}`),
  ];
}

function renderGraduation(g: GraduationRead, quoteSymbol: string, row: (b: string) => string): string[] {
  const velocity = g.velocityPctPerMin === null
    ? c.muted("velocity —")
    : g.velocityPctPerMin >= 0
      ? c.green(`↑ +${g.velocityPctPerMin.toFixed(2)}%/min`)
      : c.red(`↓ ${g.velocityPctPerMin.toFixed(2)}%/min`);
  const eta = g.etaMinutes === null ? c.muted("ETA —") : g.etaMinutes < 1 ? c.green("ETA <1m") : c.text(`ETA ~${Math.ceil(g.etaMinutes)}m`);
  const status = g.status === "GRADUATED" ? c.green("GRADUATED") : g.status === "ACCELERATING" ? c.brand("ACCELERATING") : g.status === "STALLED" ? c.red("STALLED") : c.yellow("STEADY");
  return [
    row(c.brand(c.bold("⚡ GRADUATION RADAR"))),
    row(`${c.text(padV("fill", 12))}${c.text(g.fillPct.toFixed(1) + "%")}  ${velocity}  ${eta}  ${status}`),
    row(`${c.dim("quote")} ${c.muted(quoteSymbol)}  ${c.dim("estimate uses persisted snapshots; first read stays unknown")}`),
  ];
}

function renderPoolHealth(h: PoolHealth, quoteSymbol: string, row: (b: string) => string): string[] {
  const score = h.score === null ? c.muted("—") : h.score >= 75 ? c.green(`${h.score}/100`) : h.score >= 45 ? c.yellow(`${h.score}/100`) : c.red(`${h.score}/100`);
  const liq = h.liquidityQuote === null ? c.muted("—") : c.text(`${fmtNum(h.liquidityQuote)} ${quoteSymbol}`);
  const pressure = h.buySellPressure === null ? c.muted("—") : c.text(`${h.buySellPressure.toFixed(1)}x`);
  const wallets = h.newWallets === null ? c.muted("—") : c.text(`+${h.newWallets}`);
  const whale = h.whaleConcentrationPct === null ? c.muted("—") : h.whaleConcentrationPct > 25 ? c.red(h.whaleConcentrationPct.toFixed(1) + "%") : c.text(h.whaleConcentrationPct.toFixed(1) + "%");
  const liqDelta = h.liquidityChangePct === null
    ? c.muted("—")
    : h.liquidityChangePct >= 0
      ? c.green(`+${h.liquidityChangePct.toFixed(1)}%`)
      : c.red(`${h.liquidityChangePct.toFixed(1)}%`);
  return [
    row(c.brand(c.bold("💧 POOL HEALTH")) + `  ${score}`),
    row(`${c.muted("liquidity")} ${liq}  ${c.muted("buy/sell")} ${pressure}  ${c.muted("new wallets")} ${wallets}`),
    row(`${c.muted("volume")} ${h.volumeQuote === null ? c.muted("—") : c.text(fmtNum(h.volumeQuote) + " " + quoteSymbol)}  ${c.muted("whale concentration")} ${whale}  ${c.muted("liquidity delta")} ${liqDelta}`),
  ];
}

function renderCapitalRotation(r: CapitalRotationRead, quoteSymbol: string, row: (b: string) => string): string[] {
  const flow = r.netFlowQuotePerMin === null ? c.muted("—") : formatFlow(r.netFlowQuotePerMin, quoteSymbol);
  const label = r.label === "HOT" ? c.brand("HOT") : r.label === "WARM" ? c.yellow("WARM") : r.label === "COOL" ? c.red("COOL") : c.muted("UNKNOWN");
  return [row(`${c.brand(c.bold("🔄 CAPITAL ROTATION"))}  ${flow}  ${label}`)];
}

// ── REWIND timeline (standalone view) ──────────────────────────────────
export function renderRewind(t: RewindTimeline | null): string {
  if (!t || !t.points.length)
    return c.muted("  no timeline recorded yet — scan this token a few times (or let hunt watch it), then rewind.");
  const tone = c.brand;
  const edge = tone("▌");
  const row = (b: string) => `${edge} ${b}`;
  const lines = [row(`${c.brand("🚀")} ${c.bold(c.green("$" + t.symbol))}   ${c.dim("REWIND")}`), row("")];
  for (const p of t.points) {
    if (p.critical) {
      lines.push(row(`${c.text(padV(p.tLabel, 10))} ${badge.danger("⚡ CRITICAL SIGNAL")}`));
      for (const n of p.notes) lines.push(row(`   ${c.dim("•")} ${c.text(n)}`));
    } else {
      const mc = p.mcQuote !== null ? c.dim(`   ${fmtNum(p.mcQuote)} ${t.quoteSymbol} MC`) : "";
      lines.push(row(`${c.muted(padV(p.tLabel, 10))} ${c.muted("score")} ${c.text(String(p.score))}${mc}`));
    }
  }
  lines.push(row(""));
  const sig = t.signalMcQuote !== null ? `${c.muted("MC at signal")} ${c.text(fmtNum(t.signalMcQuote) + " " + t.quoteSymbol)}` : "";
  const peak = t.peakMcQuote !== null ? `   ${c.muted("peak")} ${c.violet(fmtNum(t.peakMcQuote) + " " + t.quoteSymbol)}` : "";
  const mult = t.peakMultiple !== null ? `   ${c.green(t.peakMultiple.toFixed(1) + "×")}` : "";
  lines.push(row(`${sig}${peak}${mult}`));
  return lines.join("\n") + "\n" + tone("▙" + "▄".repeat(WIDTH));
}

// ── opportunity leaderboard (standalone view) ──────────────────────────
export function renderBoard(items: { profile: LaunchProfile; read: OpportunityRead }[], top = 10): string {
  const out = [c.dim("  OPPORTUNITIES  ") + c.muted("ranked by opportunity, best first")];
  items.slice(0, top).forEach((it, i) => {
    const o = it.read;
    const oppTone = o.opportunity >= 70 ? c.brand : o.opportunity >= 45 ? c.yellow : c.muted;
    const posTone = o.position === "EARLY" ? c.green : o.position === "MID" ? c.yellow : c.muted;
    const sym = c.bold(c.green("$" + (it.profile.symbol || "?")));
    const comps = o.comp ? `${c.muted("comps ")}${c.text(o.comp.graduated + "/" + o.comp.total)}` : c.dim("comps —");
    const tag = o.tags[0] ? oppTone(o.tags[0]) : "";
    out.push(
      `  ${c.dim("#" + (i + 1))} ${padV(sym, 22)} ${c.muted("opp")} ${oppTone(padV(String(o.opportunity), 3))} ` +
        `${posTone(padV(o.position, 5))} ${c.muted("accel ")}${padV(o.acceleration, 7)} ${comps}  ${tag}`,
    );
  });
  return out.join("\n");
}

export function renderRotation(items: LaunchProfile[], top = 10): string {
  const rows = items
    .filter((p) => p.capitalRotation?.netFlowQuotePerMin !== null && p.capitalRotation?.netFlowQuotePerMin !== undefined)
    .sort((a, b) => (b.capitalRotation?.netFlowQuotePerMin ?? 0) - (a.capitalRotation?.netFlowQuotePerMin ?? 0))
    .slice(0, top);
  const out = [c.brand(c.bold("  🔄 CAPITAL ROTATION")), c.dim("  observed net flow across the current launch window")];
  if (!rows.length) {
    out.push(c.muted("  no timed flow observations yet — run hunt/backfill more than once"));
    return out.join("\n");
  }
  for (const p of rows) {
    const rotation = p.capitalRotation!;
    const flow = formatFlow(rotation.netFlowQuotePerMin, p.market?.quoteSymbol ?? "HOOD");
    const tone = rotation.label === "HOT" ? c.brand : rotation.label === "WARM" ? c.yellow : c.red;
    out.push(`  ${padV(c.bold(c.green("$" + (p.symbol || "?"))), 14)} ${padV(flow, 24)} ${tone(rotation.label)}`);
  }
  return out.join("\n");
}

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

  const qsym = profile.market?.quoteSymbol ?? "HOOD";
  const devVal = `${devTone(devPct)}${
    devPct !== null && profile.devBuyWei !== null ? c.dim(" " + ethc(profile.devBuyWei) + " " + qsym) : ""
  }`;
  const fill = profile.curve.fillPct;
  const curveVal = `${c.amber(gauge(fill, 6))} ${c.text(pct(fill))}`;
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
  const pressureVal = profile.flow
    ? (() => {
        const p = profile.flow.pressure;
        const ratio = p === null ? c.dim("buys only") : (p >= 1 ? c.green(p.toFixed(1) + "× buy") : c.red((1 / p).toFixed(1) + "× sell"));
        return `${ratio} ${c.dim(`${profile.flow.buyers}b/${profile.flow.sellers}s`)}`;
      })()
    : c.dim("—");

  const grid = [
    metric("dev buy", devVal, "early flow", flowVal),
    metric("curve fill", curveVal, "top holder", holderTone(profile.buyers.topRecipientSharePct)),
    metric("opening tax", taxVal, "bundle", bundleVal),
    metric("deployer", deployerVal, "pressure", pressureVal),
  ];

  // ── market, opportunity, graph, DNA, tape ────────────────────────────
  const marketLine = profile.market ? [renderMarket(profile.market, row)] : [];
  const oppBlock = profile.opportunity ? renderOpportunity(profile.opportunity, row) : [];
  const graph = profile.clusters ? renderClusters(profile.clusters, row) : [];
  const dnaLines = profile.dna ? renderDNA(profile.dna, row) : [];
  const tapeLines = renderTape(profile.tape, profile.market?.quoteSymbol ?? "HOOD", row);
  const momentumLines = profile.momentum ? renderMomentum(profile.momentum, row) : [];
  const graduationLines = profile.graduation ? renderGraduation(profile.graduation, qsym, row) : [];
  const poolLines = profile.poolHealth ? renderPoolHealth(profile.poolHealth, qsym, row) : [];
  const rotationLines = profile.capitalRotation ? renderCapitalRotation(profile.capitalRotation, qsym, row) : [];

  // ── trade strip ──────────────────────────────────────────────────────
  const trade = config.fomo ? [row(fomoStrip(profile.event.token, profile.event.deployer))] : [];

  const lines = [
    row(header),
    row(nameLine),
    ...(marketLine.length ? marketLine : []),
    ...(oppBlock.length ? [row(""), ...oppBlock] : []),
    ...(momentumLines.length ? [row(""), ...momentumLines] : []),
    ...(graduationLines.length ? [row(""), ...graduationLines] : []),
    ...(poolLines.length ? [row(""), ...poolLines] : []),
    ...(rotationLines.length ? [row(""), ...rotationLines] : []),
    row(""),
    row(c.dim("EVIDENCE")),
    ...evidence,
    row(""),
    ...grid,
    ...(graph.length ? [row(""), ...graph] : []),
    ...(dnaLines.length ? [row(""), ...dnaLines] : []),
    ...(tapeLines.length ? [row(""), ...tapeLines] : []),
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
    momentum: profile.momentum,
    graduation: profile.graduation,
    poolHealth: profile.poolHealth,
    capitalRotation: profile.capitalRotation,
  });
}
