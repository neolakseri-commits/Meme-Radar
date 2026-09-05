import type { LaunchProfile, ScoreResult } from "./types.js";
import { explorer } from "./chain.js";

const color = (code: string, value: string) => process.env.NO_COLOR ? value : `\x1b[${code}m${value}\x1b[0m`;
const green = (v: string) => color("92", v);
const orange = (v: string) => color("38;5;208", v);
const yellow = (v: string) => color("93", v);
const red = (v: string) => color("91", v);
const muted = (v: string) => color("90", v);
const short = (v: string) => `${v.slice(0, 8)}…${v.slice(-6)}`;
const pct = (v: number) => `${v.toFixed(1)}%`;
const eth = (v: bigint) => `${(Number(v) / 1e18).toFixed(4)} ETH`;
const scoreBar = (n: number) => `${"█".repeat(Math.max(0, Math.round(n / 10)))}${"░".repeat(Math.max(0, 10 - Math.round(n / 10)))}`;
const localTime = (timestamp: number | null) => timestamp ? new Date(timestamp * 1000).toISOString().slice(11, 19) : new Date().toISOString().slice(11, 19);

export function render(profile: LaunchProfile, score: ScoreResult): string {
  const verdict = score.verdict === "SIGNAL" ? orange(score.verdict) : score.verdict === "WATCH" ? yellow(score.verdict) : red(score.verdict);
  const devPct = profile.devBuyWei !== null && profile.devTokens !== null && profile.totalSupply > 0n ? Number((profile.devTokens * 10_000n) / profile.totalSupply) / 100 : null;
  const signalLine = `${localTime(profile.timestamp)}  ${green("$" + (profile.symbol || "?"))}  ${verdict}  score ${String(score.total).padStart(3)}/100  ${muted(profile.phase)}`;
  const lines = [
    signalLine,
    `  ${muted(profile.name || "unnamed token")}  ${muted(short(profile.event.token))}  ${orange(scoreBar(score.total))}`,
    "",
    ...score.reasons.map((r) => r.startsWith("+") ? green(r) : r.startsWith("-") ? red(r) : muted(r)),
    "",
    `  dev buy          ${devPct === null ? "?" : pct(devPct)}${devPct !== null && profile.devBuyWei !== null ? `  ${eth(profile.devBuyWei)}` : ""}`,
    `  curve liquidity  ${pct(profile.curve.fillPct)}  ${eth(profile.curve.realQuoteReserve)} / ${eth(profile.curve.graduationThreshold)}`,
    `  opening tax      ${profile.curve.openingTaxBps === null ? "?" : `${(Number(profile.curve.openingTaxBps) / 100).toFixed(2)}%`}`,
    `  early flow       ${profile.buyers.firstWindowUniqueBuyers} buyers / ${profile.buyers.firstWindowBuys} buys  ·  ${profile.buyers.taxedBuys} taxed`,
    `  supply top       ${pct(profile.buyers.topRecipientSharePct)} to one recipient`,
    `  bundle signal    ${profile.exemptions.length ? `${profile.exemptions.length} exempt wallet(s)` : "none declared"}`,
    `  deployer         ${profile.deployer ? `${profile.deployer.launches} launches / ${profile.deployer.graduated} graduated` : "history unavailable"}`,
    `  funding          ${muted("requires indexer adapter")}`,
    "",
    `  token            ${profile.event.token}`,
    `  links            ${explorer.pons(profile.event.token)}  ${explorer.token(profile.event.token)}`,
  ];
  return lines.join("\n");
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
    buyers: { ...profile.buyers, totalQuoteIn: profile.buyers.totalQuoteIn.toString(), totalTokensOut: profile.buyers.totalTokensOut.toString() },
    curve: { ...profile.curve, realQuoteReserve: profile.curve.realQuoteReserve.toString(), graduationThreshold: profile.curve.graduationThreshold.toString(), sellableTokens: profile.curve.sellableTokens.toString(), reservedTokens: profile.curve.reservedTokens.toString(), openingTaxBps: profile.curve.openingTaxBps?.toString() ?? null, creatorTaxBps: profile.curve.creatorTaxBps.toString() },
    dataGaps: profile.dataGaps,
  });
}
