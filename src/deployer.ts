import { parseAbiItem, type Address } from "viem";
import { factoryAbi } from "./abi.js";
import { ADDR, rpc } from "./chain.js";
import { config } from "./config.js";
import type { DeployerStats, LaunchEvent } from "./types.js";

const graduatedEvent = parseAbiItem("event PoolGraduated(address indexed token, uint256 positionId, uint256 tokenAmount, uint256 pairTokenAmount)");
const launchEvent = parseAbiItem("event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)");

export class DeployerIndex {
  private readonly launches = new Map<string, { token: Address; block: bigint }[]>();
  private readonly graduated = new Map<string, bigint>(); // token -> graduation block
  private ready = false;

  async build(blocks = config.historyBlocks): Promise<void> {
    const head = await rpc.getBlockNumber();
    const from = head > BigInt(blocks) ? head - BigInt(blocks) : 0n;
    for (let start = from; start <= head; start += BigInt(config.logChunk)) {
      const to = start + BigInt(config.logChunk) - 1n > head ? head : start + BigInt(config.logChunk) - 1n;
      const [launches, grads] = await Promise.all([
        rpc.getLogs({ address: ADDR.factory, event: launchEvent, fromBlock: start, toBlock: to }),
        rpc.getLogs({ address: ADDR.factory, event: graduatedEvent, fromBlock: start, toBlock: to }),
      ]);
      for (const log of launches) {
        const a = log.args;
        if (!a.deployer || !a.token || log.blockNumber === null) continue;
        const key = a.deployer.toLowerCase();
        const list = this.launches.get(key) ?? [];
        list.push({ token: a.token, block: log.blockNumber });
        this.launches.set(key, list);
      }
      for (const log of grads) if (log.args.token && log.blockNumber !== null) this.graduated.set(log.args.token.toLowerCase(), log.blockNumber);
    }
    this.ready = true;
  }

  note(event: LaunchEvent): void {
    const key = event.deployer.toLowerCase();
    const list = this.launches.get(key) ?? [];
    if (!list.some((item) => item.token.toLowerCase() === event.token.toLowerCase())) list.push({ token: event.token, block: event.blockNumber });
    this.launches.set(key, list);
  }

  stats(deployer: Address, beforeBlock?: bigint): DeployerStats | null {
    if (!this.ready && !this.launches.size) return null;
    const list = (this.launches.get(deployer.toLowerCase()) ?? []).filter((item) => beforeBlock === undefined || item.block < beforeBlock);
    const graduated = list.filter((item) => this.graduated.has(item.token.toLowerCase())).length;
    return { launches: list.length, graduated, onCurve: Math.max(0, list.length - graduated), firstSeenBlock: list.length ? list[0].block : null };
  }

  graduationBlock(token: Address): bigint | null { return this.graduated.get(token.toLowerCase()) ?? null; }
  markGraduated(token: Address, block = 0n): void { this.graduated.set(token.toLowerCase(), block); }
  isReady(): boolean { return this.ready; }
}
