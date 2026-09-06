import { loadEnvFile } from "node:process";

try { loadEnvFile(".env"); } catch { /* .env is optional */ }

const positiveInt = (name: string, fallback: number): number => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

export const config = {
  rpcUrl: process.env.RPC_URL?.trim() || "https://rpc.mainnet.chain.robinhood.com",
  wsUrl: process.env.RPC_WS_URL?.trim() === "off" ? "" : (process.env.RPC_WS_URL?.trim() || "wss://robinhood-rpc.publicnode.com"),
  pollMs: positiveInt("RADAR_POLL_MS", 500),
  historyBlocks: positiveInt("RADAR_HISTORY_BLOCKS", 400_000),
  earlyBlocks: positiveInt("RADAR_EARLY_BLOCKS", 600),
  logChunk: positiveInt("RADAR_LOG_CHUNK", 25_000),
  maxFirstBuys: positiveInt("RADAR_MAX_FIRST_BUYS", 1_000),
  // Show the ⚡ TRADE quick-action strip (Pump.fun / FOMO apps + native venues).
  fomo: process.env.RADAR_FOMO?.trim().toLowerCase() !== "off",
  // Persistent wallet/launch memory for cluster + Deployer DNA intelligence.
  historyFile: process.env.RADAR_HISTORY_FILE?.trim() === "off" ? null : (process.env.RADAR_HISTORY_FILE?.trim() || ".meme-radar-history.json"),
  // Resolve funding sources via Blockscout (extra HTTP per wallet). Off by default.
  funding: process.env.RADAR_FUNDING?.trim().toLowerCase() === "on",
};
