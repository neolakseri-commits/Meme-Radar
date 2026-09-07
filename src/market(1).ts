// Live market read for a pons v2 bonding curve.
//
// pons quotes in its pair token (HOOD on Robinhood Chain), NOT native ETH — so
// every figure here is denominated in that token and labelled with its symbol.
// Price is the implied spot from the curve reserves; market cap is fully diluted.

import type { BuySample, MarketData, TapeEntry, TradeFlow } from "./types.js";

const toNum = (v: bigint, decimals: number): number => Number(v) / 10 ** decimals;

export interface SellSample {
  seller: string;
  quoteOut: bigint;
  tax: bigint;
  block: bigint;
}

export function computeMarket(args: {
  quoteReserve: bigint;
  tokenReserve: bigint;
  realQuoteReserve: bigint;
  totalSupply: bigint;
  quoteSymbol: string;
  quoteDecimals: number;
  tokenDecimals: number;
  fillPct: number;
  fillVelocityPct: number | null;
  peakMultiple: number | null;
}): MarketData {
  const q = toNum(args.quoteReserve, args.quoteDecimals);
  const t = toNum(args.tokenReserve, args.tokenDecimals);
  const price = t > 0 && q > 0 ? q / t : null;
  const supply = toNum(args.totalSupply, args.tokenDecimals);
  return {
    quoteSymbol: args.quoteSymbol,
    quoteDecimals: args.quoteDecimals,
    priceQuote: price,
    marketCapQuote: price !== null ? price * supply : null,
    liquidityQuote: toNum(args.realQuoteReserve, args.quoteDecimals),
    fillPct: args.fillPct,
    fillVelocityPct: args.fillVelocityPct,
    peakMultiple: args.peakMultiple,
  };
}

export function computeFlow(
  buys: BuySample[],
  sells: SellSample[],
  quoteDecimals: number,
  windowSeconds: number | null,
): TradeFlow {
  const buyers = new Set(buys.map((b) => b.buyer.toLowerCase())).size;
  const sellers = new Set(sells.map((s) => s.seller.toLowerCase())).size;
  const buyVol = buys.reduce((n, b) => n + toNum(b.quoteIn, quoteDecimals), 0);
  const sellVol = sells.reduce((n, s) => n + toNum(s.quoteOut, quoteDecimals), 0);
  const pressure = sellVol > 0 ? buyVol / sellVol : null;
  const buysPerMin = windowSeconds && windowSeconds > 0 ? (buys.length / windowSeconds) * 60 : null;
  const netFlowQuotePerMin = windowSeconds && windowSeconds > 0
    ? ((buyVol - sellVol) / windowSeconds) * 60
    : null;
  return { buyers, sellers, buyVolumeQuote: buyVol, sellVolumeQuote: sellVol, pressure, buysPerMin, windowSeconds, netFlowQuotePerMin };
}

export function buildTape(
  buys: BuySample[],
  sells: SellSample[],
  quoteDecimals: number,
  limit = 6,
): TapeEntry[] {
  const entries: TapeEntry[] = [
    ...buys.map((b): TapeEntry => ({
      side: "buy",
      wallet: b.buyer.toLowerCase(),
      sizeQuote: toNum(b.quoteIn, quoteDecimals),
      taxed: b.tax > 0n,
      block: Number(b.blockNumber),
      txHash: b.txHash,
    })),
    ...sells.map((s): TapeEntry => ({
      side: "sell",
      wallet: s.seller.toLowerCase(),
      sizeQuote: toNum(s.quoteOut, quoteDecimals),
      taxed: s.tax > 0n,
      block: Number(s.block),
      txHash: null,
    })),
  ];
  return entries.sort((a, b) => b.block - a.block).slice(0, limit);
}

