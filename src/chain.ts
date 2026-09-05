import { createPublicClient, defineChain, http, webSocket, type Address, type PublicClient } from "viem";
import { config } from "./config.js";

export const ADDR = {
  factory: "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e" as Address,
  launchRouter: "0xe33E9E479dF8802cb0866d5d05258bEc4cF62948" as Address,
  zero: "0x0000000000000000000000000000000000000000" as Address,
};

export const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl] } },
  blockExplorers: { default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" } },
});

export const rpc: PublicClient = createPublicClient({
  chain: robinhood,
  transport: http(config.rpcUrl, { timeout: 20_000, retryCount: 2 }),
});

export const wsRpc: PublicClient | null = config.wsUrl
  ? createPublicClient({ chain: robinhood, transport: webSocket(config.wsUrl, { reconnect: true }) })
  : null;

export const explorer = {
  token: (a: Address) => `https://robinhoodchain.blockscout.com/token/${a}`,
  address: (a: Address) => `https://robinhoodchain.blockscout.com/address/${a}`,
  tx: (h: string) => `https://robinhoodchain.blockscout.com/tx/${h}`,
  pons: (a: Address) => `https://www.ponsfamily.com/token/${a}`,
};
