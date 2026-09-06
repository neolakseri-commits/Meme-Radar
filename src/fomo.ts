// Quick-trade / FOMO launcher. Every detected token becomes a row of one-click
// buttons that open it across the venues a degen actually uses. Robinhood-Chain
// native venues are wired by default; external FOMO apps (Pump.fun & friends)
// are template-driven so you can point them at whatever front-end you trade on.

import type { Address } from "viem";
import { explorer } from "./chain.js";
import { button, c } from "./theme.js";

export interface FomoApp {
  name: string;
  /** URL template. `{token}` and `{deployer}` are substituted. */
  url: string;
  tone?: (v: string) => string;
}

// Sensible defaults. `{token}` is replaced with the token address.
// Override or extend via RADAR_FOMO_APPS="Name=https://app/{token},Name2=..."
const DEFAULT_APPS: FomoApp[] = [
  { name: "Pump.fun", url: "https://pump.fun/{token}", tone: c.green },
  { name: "FOMO", url: "https://fomo.biz/token/{token}", tone: c.violet },
];

function parseAppsEnv(raw: string | undefined): FomoApp[] {
  if (!raw) return DEFAULT_APPS;
  const apps = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const eq = entry.indexOf("=");
      if (eq < 0) return null;
      return { name: entry.slice(0, eq).trim(), url: entry.slice(eq + 1).trim() } as FomoApp;
    })
    .filter((a): a is FomoApp => Boolean(a && a.name && a.url));
  return apps.length ? apps : DEFAULT_APPS;
}

export const fomoApps: FomoApp[] = parseAppsEnv(process.env.RADAR_FOMO_APPS);

const fill = (url: string, token: Address, deployer: Address): string =>
  url.replace(/\{token\}/g, token).replace(/\{deployer\}/g, deployer);

/**
 * A single "⚡ TRADE" strip of clickable buttons for a token:
 * external FOMO apps first, then the native Robinhood-Chain venues.
 */
export function fomoStrip(token: Address, deployer: Address): string {
  const buttons = [
    ...fomoApps.map((app) => button(fill(app.url, token, deployer), app.name, app.tone ?? c.cyan)),
    button(explorer.pons(token), "Pons", c.brand),
    button(explorer.token(token), "Chart", c.cyan),
    button(explorer.address(deployer), "Deployer", c.muted),
  ];
  return `${c.yellow("⚡ TRADE")}  ${buttons.join(" ")}`;
}
