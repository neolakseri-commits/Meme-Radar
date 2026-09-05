# Limitations and operational notes

Meme Radar reports observable evidence, not certainty. Do not use a score as financial advice or as an automatic trade instruction.

## Current boundaries

- Funding-wallet relationships and bundled-wallet detection need trace/indexer data that is not available from every public RPC.
- Deployer history is only as complete as the configured history source and block window.
- Early buyer breadth describes the observed window, not the entire token lifetime.
- Supply concentration can be understated when transfers or buys happen outside the observation window.
- Curve and liquidity values are point-in-time reads and can change immediately after the report.
- A healthy-looking launch can still be malicious; a low score can simply reflect missing data.
- RPC providers may throttle `eth_getLogs` or return different freshness levels.

## Recommended operating mode

Use `doctor` before a live hunt, keep the tool read-only, and open the explorer transaction links for any launch that matters. Treat every positive result as a prompt for manual verification.

## Roadmap candidates

1. Pluggable indexer interface for funding and wallet clusters.
2. Persisted local observations with timestamps and provider metadata.
3. Replay fixtures from real launch events for regression tests.
4. Confidence separate from score, so missing data is visible at a glance.

