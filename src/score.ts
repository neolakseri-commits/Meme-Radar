import type { LaunchProfile, ScoreResult } from "./types.js";

export function scoreProfile(p: LaunchProfile, twins = 0): ScoreResult {
  let score = 50;
  const reasons: string[] = [];
  const add = (points: number, text: string) => { score += points; reasons.push(`${points >= 0 ? "+" : ""}${points} ${text}`); };
  const devPct = p.devBuyWei !== null && p.devTokens !== null && p.totalSupply > 0n ? Number((p.devTokens * 10_000n) / p.totalSupply) / 100 : null;
  if (devPct === null) add(-4, "dev buy unavailable");
  else if (devPct === 0) add(-10, "no dev buy");
  else if (devPct <= 6) add(15, `dev buy ${devPct.toFixed(2)}%`);
  else if (devPct > 10) add(-25, `dev buy ${devPct.toFixed(2)}% is heavy`);
  else add(0, `dev buy ${devPct.toFixed(2)}%`);
  const tax = Number(p.curve.creatorTaxBps);
  if (tax <= 200) add(10, `creator tax ${(tax / 100).toFixed(2)}%`);
  else if (tax > 500) add(-25, `creator tax ${(tax / 100).toFixed(2)}%`);
  else add(-5, `creator tax ${(tax / 100).toFixed(2)}%`);
  const socialCount = Object.values(p.socials).filter(Boolean).length;
  if (socialCount === 0) add(-15, "no socials");
  else add(Math.min(12, socialCount * 4), `${socialCount} social links`);
  if (p.exemptions.length === 0) add(5, "no declared bundle wallets");
  else if (p.exemptions.length <= 3) add(-5, `${p.exemptions.length} exempt wallet(s)`);
  else add(-20, `${p.exemptions.length} exempt wallets`);
  if (p.buyers.firstWindowUniqueBuyers >= 10) add(10, `${p.buyers.firstWindowUniqueBuyers} early buyers`);
  else if (p.buyers.firstWindowUniqueBuyers >= 4) add(5, `${p.buyers.firstWindowUniqueBuyers} early buyers`);
  else add(-4, `only ${p.buyers.firstWindowUniqueBuyers} early buyers`);
  if (p.buyers.topRecipientSharePct > 25) add(-20, `top recipient controls ${p.buyers.topRecipientSharePct.toFixed(1)}% of supply`);
  else if (p.buyers.topRecipientSharePct > 15) add(-10, `supply concentration ${p.buyers.topRecipientSharePct.toFixed(1)}%`);
  else if (p.buyers.topRecipientSharePct > 0) add(5, `supply concentration ${p.buyers.topRecipientSharePct.toFixed(1)}%`);
  if (p.buyers.recipientMismatches > 0) add(-5, `${p.buyers.recipientMismatches} buyer/recipient mismatch(es)`);
  if (p.deployer) {
    if (p.deployer.launches === 0) add(5, "fresh deployer");
    else if (p.deployer.graduated / p.deployer.launches >= 0.3) add(15, `deployer graduated ${p.deployer.graduated}/${p.deployer.launches}`);
    else if (p.deployer.launches >= 5 && p.deployer.graduated === 0) add(-25, `serial deployer: ${p.deployer.launches} launches, none graduated`);
    else add(-5, `deployer ${p.deployer.launches} launches, ${p.deployer.graduated} graduated`);
  }
  if (twins >= 2) add(-25, `${twins + 1} matching fingerprints: likely farm`);
  else if (twins === 1) add(-8, "one matching launch fingerprint");
  if (p.curve.fillPct >= 25 && p.buyers.firstWindowUniqueBuyers >= 10) add(8, `curve fill ${p.curve.fillPct.toFixed(1)}% with broad early flow`);
  const total = Math.max(0, Math.min(100, score));
  return { total, verdict: total >= 75 ? "SIGNAL" : total >= 45 ? "WATCH" : "NO SIGNAL", reasons };
}
