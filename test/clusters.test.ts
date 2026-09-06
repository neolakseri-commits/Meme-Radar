import test from "node:test";
import assert from "node:assert/strict";
import type { Address } from "viem";
import type { BuySample } from "../src/types.js";
import { analyzeClusters } from "../src/clusters.js";
import { WalletHistory } from "../src/history.js";

const A = (n: number): Address => ("0x" + n.toString(16).padStart(40, "0")) as Address;
const B = (buyer: Address, recipient: Address, block: number): BuySample =>
  ({ buyer, recipient, quoteIn: 1n, tokensOut: 1n, tax: 0n, blockNumber: BigInt(block), txHash: null });

test("independent buyers spread over time stay independent", () => {
  const samples = Array.from({ length: 8 }, (_, i) => B(A(0x100 + i), A(0x100 + i), 100 + i * 20));
  const a = analyzeClusters(samples, null, A(0xd), A(0x7), {});
  assert.equal(a.clusters.length, 0);
  assert.equal(a.independent, 8);
  assert.equal(a.verdict, "INDEPENDENT DEMAND");
});

test("shared funder + tight window + funnel form an insider cluster", () => {
  const ring = [A(0x1), A(0x2), A(0x3), A(0x4)];
  const funnel = A(0xdead);
  const funder = A(0xf00d);
  const samples: BuySample[] = [
    ...ring.map((w, i) => B(w, funnel, 100 + (i % 2))),
    ...Array.from({ length: 6 }, (_, i) => B(A(0x200 + i), A(0x200 + i), 130 + i * 15)),
  ];
  const funding = new Map<string, string>(ring.map((r) => [r.toLowerCase(), funder.toLowerCase()]));
  const a = analyzeClusters(samples, null, A(0xd), A(0x7), { funding });
  assert.equal(a.verdict, "INSIDER CLUSTER");
  assert.equal(a.clusters[0].kind, "insider");
  assert.equal(a.clusters[0].wallets.length, 4);
  assert.ok(a.clusters[0].confidence >= 65);
});

test("historical co-occurrence links wallets across launches", () => {
  const h = new WalletHistory(null);
  const [x, y] = [A(0xaa), A(0xbb)];
  for (let i = 0; i < 3; i++)
    h.record({ token: A(0x900 + i), deployer: A(0xd), block: 1000 + i * 100, timestamp: null, graduated: false, gradBlock: null, earlyWallets: [x.toLowerCase(), y.toLowerCase()], devBuyPct: 1, socials: 1, topSharePct: 10 });
  const samples = [B(x, x, 100), B(y, y, 140)]; // far apart in time, but co-occur historically
  const a = analyzeClusters(samples, h, A(0xd), A(0x7), {});
  assert.equal(a.clusters.length, 1);
  assert.equal(a.clusters[0].wallets.length, 2);
});
