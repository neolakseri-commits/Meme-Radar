# Getting started

## 1. Install

Use Node.js 20 or newer.

```bash
npm install
cp .env.example .env
```

On Windows PowerShell:

```powershell
npm install
Copy-Item .env.example .env
```

The default configuration is read-only and does not contain wallet credentials.

## 2. Configure the RPC

Open `.env` and set:

```env
ROBINHOOD_RPC_URL=https://your-rpc-endpoint
ROBINHOOD_CHAIN_ID=4663
```

The RPC endpoint must support normal JSON-RPC reads and log queries. A paid endpoint is not required for the offline demo, but it may be needed for a fast live scan.

## 3. Verify the environment

```bash
npm run doctor
```

Then run the deterministic local report:

```bash
npm run demo
```

## 4. Run a live hunt

```bash
npm run hunt
```

For a short smoke test:

```bash
npm run hunt -- --no-history --for 60
```

## 5. Scan one token

```bash
npm run scan -- 0xTokenAddress
```

The address must be a token launched through the supported Robinhood Chain launch flow. Use `--json` when piping a report to another local tool.

## Common problems

| Symptom | Meaning | What to do |
| --- | --- | --- |
| `HTTP request failed` | RPC is unavailable or blocked | check the URL, network, and provider quota |
| no launches found | the chosen window has no matching events | increase the block/window range |
| missing history | no local/indexer history is configured | treat the history signal as unknown |
| demo works, hunt fails | the code is fine but live access is not configured | configure `.env`, then rerun `doctor` |

