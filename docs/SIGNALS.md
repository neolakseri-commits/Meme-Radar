# Signals and scoring

Meme Radar is a triage tool. The score ranks what deserves a closer look; it does not predict price and it never places an order.

## Score bands

| Score | Label | Interpretation |
| ---: | --- | --- |
| 80–100 | strong signal | multiple independent positive observations |
| 60–79 | investigate | useful evidence, but meaningful uncertainty remains |
| 40–59 | neutral | too mixed or incomplete to prioritize |
| 0–39 | weak signal | obvious risk, missing evidence, or no differentiator |

## Evidence used today

| Evidence | Positive direction | Negative direction |
| --- | --- | --- |
| Creator allocation | creator position is visible and not extreme | very large or suspicious concentration |
| Buyer breadth | multiple early buyers with distinct addresses | one/few wallets dominate the window |
| Curve progress | healthy activity without an abnormal tax state | opening tax or curve state is outside configured bounds |
| Deployer record | previous launches and graduations are visible | repeated launches without healthy outcomes |
| Linked-wallet warning | no repeated wallet fingerprint found | matching fingerprints are visible |

The implementation keeps the reasons next to the score so a user can disagree with the heuristic and still inspect the underlying facts.

## What “unknown” means

Unknown is not the same as safe. If a provider does not expose traces, funding relationships, or enough historical events, Meme Radar prints a limitation instead of manufacturing a signal.

## Extending the model

Add a new signal only if it has:

1. a deterministic data source;
2. a clear positive and negative interpretation;
3. a bounded contribution to the score;
4. a test covering missing and adversarial input;
5. a human-readable explanation in the renderer.

