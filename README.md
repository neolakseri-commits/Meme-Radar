# Meme Radar

Terminal intelligence for new pons v2 launches on Robinhood Chain.

Meme Radar is deliberately read-only. It does not hold a key and does not send trades. It listens for new launches, builds an evidence profile, and explains why a token looks unusual.

## Run

Requires Node.js 20+.

```bash
npm install
copy .env.example .env
npm run doctor
npm run hunt
```

Useful commands:

```bash
npm run hunt -- --min-score 70
npm run hunt -- --json --for 300
npm run scan -- 0xTokenAddress
npm run demo
```

The live feed is intentionally terminal-first and read-only:

```text
════════════════════════════════════════════════════════════════════════════
  RADAR  onchain launch intelligence · Robinhood Chain · 4663
  live discovery feed
════════════════════════════════════════════════════════════════════════════
  feed       websocket
  history    400000 blocks
  session    0 launches · 0 signals · 0 watch
────────────────────────────────────────────────────────────────────────────
13:52:34  $TOKEN  SIGNAL  score  87/100  curve
  WILLOW ROAD  0x36fe…2eB9  █████████░

+15 dev buy 2.10%
+10 creator tax 0.00%
+10 14 early buyers
-10 supply concentration 18.0%

  dev buy          2.10%  0.2100 ETH
  curve liquidity  24.8%  2.0060 / 8.0900 ETH
  opening tax      0.19%
  early flow       14 buyers / 16 buys · 2 taxed
  supply top       18.0% to one recipient
```

## What it measures

- launch and deployer history;
- dev buy decoded from the launch transaction when the canonical launch router was used;
- creator tax and current opening tax;
- declared exempt wallets;
- early buy count, unique buyers, buyer speed and recipient mismatches;
- early supply concentration from curve buy events;
- curve fill and graduation proximity;
- repeated launch fingerprints across different deployers;
- explicit data gaps when a public RPC cannot provide native funding traces.

## Honest boundary

Funding-wallet and cross-wallet clustering cannot be inferred reliably from ordinary `eth_call`/`eth_getLogs` alone. Meme Radar exposes this as an adapter boundary instead of inventing labels. A later indexer adapter can populate that evidence without changing the scoring contract.

This project is an independent implementation. It uses public protocol information and is not affiliated with pons or Robinhood.
