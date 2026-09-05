import { parseAbiItem, type Address, type Hex, type Log } from "viem";
import { factoryAbi } from "./abi.js";
import { ADDR, rpc, wsRpc } from "./chain.js";
import { config } from "./config.js";
import type { LaunchEvent } from "./types.js";

export const TOKEN_LAUNCHED = parseAbiItem("event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)");
export type LaunchLog = Log<bigint, number, false, typeof TOKEN_LAUNCHED, true>;

function asEvent(log: LaunchLog): LaunchEvent | null {
  if (!log.transactionHash || log.blockNumber === null || log.logIndex === null) return null;
  const a = log.args;
  if (!a.token || !a.curve || !a.deployer || !a.pairToken) return null;
  return { token: a.token, curve: a.curve, deployer: a.deployer, pairToken: a.pairToken, graduationThreshold: a.graduationThreshold ?? 0n, blockNumber: log.blockNumber, txHash: log.transactionHash, logIndex: log.logIndex, seenAtMs: Date.now() };
}

export async function recentLaunches(blocks: bigint): Promise<LaunchEvent[]> {
  const head = await rpc.getBlockNumber();
  const from = head > blocks ? head - blocks : 0n;
  const out: LaunchEvent[] = [];
  for (let start = from; start <= head; start += BigInt(config.logChunk)) {
    const to = start + BigInt(config.logChunk) - 1n > head ? head : start + BigInt(config.logChunk) - 1n;
    const logs = await rpc.getLogs({ address: ADDR.factory, event: TOKEN_LAUNCHED, fromBlock: start, toBlock: to });
    for (const log of logs) { const ev = asEvent(log as LaunchLog); if (ev) out.push(ev); }
  }
  return out.sort((a, b) => Number(a.blockNumber - b.blockNumber) || a.logIndex - b.logIndex);
}

export async function findLaunch(token: Address): Promise<LaunchEvent | null> {
  const head = await rpc.getBlockNumber();
  for (const window of [500_000n, 2_000_000n, 8_000_000n, 32_000_000n]) {
    const from = head > window ? head - window : 0n;
    const logs = await rpc.getLogs({ address: ADDR.factory, event: TOKEN_LAUNCHED, args: { token }, fromBlock: from, toBlock: head });
    if (logs.length) return asEvent(logs[logs.length - 1] as LaunchLog);
    if (from === 0n) break;
  }
  return null;
}

export function watchLaunches(onLaunch: (event: LaunchEvent) => void, opts: { pollMs?: number } = {}): () => void {
  const seen = new Set<string>();
  let stopped = false;
  let polling = false;
  let last = 0n;
  let timer: NodeJS.Timeout | undefined;

  const dispatch = (log: LaunchLog) => {
    const key = `${log.transactionHash}:${log.logIndex}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (seen.size > 20_000) seen.delete(seen.values().next().value as string);
    const ev = asEvent(log);
    if (ev) onLaunch(ev);
  };

  const poll = async () => {
    if (stopped || !polling) return;
    try {
      const head = await rpc.getBlockNumber();
      if (last === 0n) last = head - 1n;
      if (head > last) {
        const from = last + 1n;
        const to = head - from > 2_000n ? from + 2_000n : head;
        const logs = await rpc.getLogs({ address: ADDR.factory, event: TOKEN_LAUNCHED, fromBlock: from, toBlock: to });
        logs.forEach((log) => dispatch(log as LaunchLog));
        last = to;
      }
    } catch (error) {
      console.error(`poll warning: ${(error as Error).message.split("\n")[0]}`);
    } finally {
      if (!stopped && polling) timer = setTimeout(() => void poll(), opts.pollMs ?? config.pollMs);
    }
  };

  if (wsRpc) {
    const unwatch = wsRpc.watchEvent({ address: ADDR.factory, event: TOKEN_LAUNCHED, onLogs: (logs) => logs.forEach((log) => dispatch(log as LaunchLog)), onError: (error) => console.error(`websocket warning: ${error.message}`) });
    return () => { stopped = true; unwatch(); if (timer) clearTimeout(timer); };
  }

  polling = true;
  timer = setTimeout(() => void poll(), 0);
  return () => { stopped = true; polling = false; if (timer) clearTimeout(timer); };
}
