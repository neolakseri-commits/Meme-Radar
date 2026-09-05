# Architecture

Meme Radar is split into a small read pipeline:

```text
RPC / launch events
        │
        ▼
 launch discovery ──► token + curve reads
        │                       │
        └──────────┬────────────┘
                   ▼
          evidence enrichment
                   │
                   ▼
            explainable score
                   │
                   ▼
          terminal / JSON output
```

## Modules

| Module | Responsibility |
| --- | --- |
| `src/cli.ts` | command-line entrypoint and options |
| `src/config.ts` | environment and safe defaults |
| `src/chain.ts` | RPC client and contract reads |
| `src/launches.ts` | launch discovery and block windows |
| `src/enrich.ts` | token, curve, buyers, and concentration evidence |
| `src/deployer.ts` | deployer history interface and fallback behavior |
| `src/score.ts` | deterministic scoring rules |
| `src/render.ts` | orange terminal cards and JSON serialization |
| `src/banner.ts` | project identity shown in the terminal |

## Safety boundary

The runtime uses public chain reads. There is no signer, private-key parser, transaction builder, swap route, or balance-spending path in the product. A future execution feature would need to be a separate, explicitly reviewed module.

## Provider boundary

The core pipeline intentionally separates chain reads from enrichment. This makes it possible to add an indexer adapter for funding graphs and wallet clusters without changing the scoring or terminal presentation.

