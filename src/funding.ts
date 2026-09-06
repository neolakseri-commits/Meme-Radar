// Optional funding-source adapter.
//
// Resolves each wallet's first funder (the address that sent it its first
// incoming transfer) via the chain's Blockscout instance. When many early
// buyers share one funder, that is the strongest "insider cluster" signal.
//
// Off by default: it makes one HTTP request per wallet, so enable with
// RADAR_FUNDING=on and expect the hunt to run a little slower. Failures are
// swallowed — the graph simply falls back to its on-chain signals.

const BASE = process.env.RADAR_BLOCKSCOUT?.trim() || "https://robinhoodchain.blockscout.com";

async function firstFunder(wallet: string): Promise<string | null> {
  try {
    const url = `${BASE}/api/v2/addresses/${wallet}/transactions?filter=to`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const body = (await res.json()) as { items?: { from?: { hash?: string }; timestamp?: string }[] };
    const items = body.items ?? [];
    if (!items.length) return null;
    // API returns newest-first; the earliest incoming tx is the funder.
    const earliest = items[items.length - 1];
    const from = earliest.from?.hash;
    return from ? from.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** Resolve funders for a set of wallets with bounded concurrency. */
export async function blockscoutFunding(wallets: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const queue = [...new Set(wallets.map((w) => w.toLowerCase()))];
  const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
    for (;;) {
      const w = queue.shift();
      if (!w) return;
      const src = await firstFunder(w);
      if (src) out.set(w, src);
    }
  });
  await Promise.all(workers);
  return out;
}
