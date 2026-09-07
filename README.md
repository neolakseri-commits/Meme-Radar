<div align="center">

<img src="assets/meme-radar-icon.svg" width="112" alt="Meme Radar icon" />

# MEME RADAR

### Onchain launch intelligence for Robinhood Chain

<img src="assets/meme-radar-banner.svg" alt="Meme Radar — onchain launch intelligence" />

<p>
  <a href="https://github.com/neolakseri-commits/Meme-Radar/actions"><img src="https://img.shields.io/github/actions/workflow/status/neolakseri-commits/Meme-Radar/ci.yml?label=checks&style=flat-square" alt="checks" /></a>
  <img src="https://img.shields.io/badge/mode-read--only-ff9b42?style=flat-square" alt="read-only" />
  <img src="https://img.shields.io/badge/runtime-Node%2020%2B-ff9b42?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/chain-Robinhood%204663-ff9b42?style=flat-square" alt="Robinhood Chain" />
  <img src="https://img.shields.io/badge/license-MIT-ff9b42?style=flat-square" alt="MIT license" />
</p>

<p><strong>Find the unusual launch. Read the evidence. Decide for yourself.</strong></p>

</div>

## What it does

Meme Radar watches Robinhood Chain launches and turns the first observable activity into a compact, explainable profile. It is a local terminal tool for research and triage — it does not trade, custody funds, or ask for a private key.

| Question | Evidence | Terminal answer |
| --- | --- | --- |
| Is this launch unusual? | launch state, curve, tax, early flow | `SCORE 87/100` |
| Is the deployer experienced? | prior launches and graduations | `deployer history` |
| Is the early demand broad? | first curve buys and unique buyers | `14 independent buyers` |
| Is supply concentrated? | creator buy and observed early wallets | `18% concentration` |
| Does it resemble a farm? | repeated deployer and wallet fingerprints | `farm warning` |

The output is deliberately evidence-first. A score is only useful when the reasons underneath it are visible.

## Quick start

```bash
npm install
cp .env.example .env
npm run doctor
npm run hunt
```

PowerShell:

```powershell
npm install
Copy-Item .env.example .env
npm run doctor
npm run hunt
```

Run the offline demo without RPC access:

```bash
npm run demo
```

Inspect one token directly:

```bash
npm run scan -- 0xTokenAddress
```

## Commands

| Command | Purpose | Network |
| --- | --- | --- |
| `npm run demo` | Render a realistic sample report | no |
| `npm run doctor` | Check RPC connectivity and configured chain | yes |
| `npm run hunt` | Follow new launches and print scored profiles | yes |
| `npm run scan -- <address>` | Enrich and score one token | yes |
| `npm run backfill` | Profile a recent window, then rank it as an **opportunity board** | yes |
| `npm run dev -- rewind <address>` | **REWIND** — replay what the radar saw for a token over time | yes |
| `npm run typecheck` | Validate TypeScript without emitting files | no |
| `npm test` | Run scoring and behavior tests | no |

Useful options:

```bash
npm run hunt -- --no-history --for 60
npm run hunt -- --no-fomo          # hide the quick-trade strip
npm run backfill -- --blocks 100
npm run rotation -- --blocks 2000 # rank launches by observed net flow
npm run scan -- 0xTokenAddress --json
```

## Momentum intelligence

Every enriched launch now gets a compact lifecycle read instead of a score
alone:

```text
MOMENTUM INTELLIGENCE
lifecycle ACCELERATION    signal BUILDING ▲
demand quality 92/100    wallet rotation HIGH
buy pressure 2.7x        buyer velocity +183%
exit risk 14/100          data confidence 100/100
```

The same card can show a `GRADUATION RADAR` with fill velocity and ETA, a
`POOL HEALTH` panel after graduation, and observed `CAPITAL ROTATION` in the
quote asset. A first observation is allowed to say `—`; the tool does not
invent a rate before it has two timed snapshots.

Lifecycle labels are:

```text
LAUNCH → ACCUMULATION → ACCELERATION → GRADUATION
       → POOL EXPANSION → DISTRIBUTION → DECAY
```

Use `npm run rotation` for a compact cross-launch flow ranking. It is based on
the currently observed window, not a claim about lifetime market flow.

## Quick trade (Pump.fun / FOMO)

Every card ends with a `⚡ TRADE` strip that turns the detected token into
one-click **buttons** — clickable in any terminal that supports hyperlinks
(iTerm2, WezTerm, Kitty, Windows Terminal, GNOME Terminal, and more):

```text
⚡ TRADE  [Pump.fun] [FOMO] [Pons] [Chart] [Deployer]
```

The native Robinhood-Chain venues (Pons, Blockscout chart, deployer page) are
always wired. The external FOMO apps are template-driven, so you can point them
at whatever front-end you actually trade on:

| Variable | Effect |
| --- | --- |
| `RADAR_FOMO=off` / `--no-fomo` | Hide the quick-trade strip entirely |
| `RADAR_FOMO_APPS` | Custom apps, `Name=url` comma-separated. `{token}` and `{deployer}` are substituted |
| `RADAR_NO_HYPERLINKS=1` | Keep the button labels but disable clickable links |
| `NO_COLOR=1` | Plain, monochrome output for logs and pipes |

```bash
# Wire your own FOMO front-ends
RADAR_FOMO_APPS="Pump.fun=https://pump.fun/{token},Bolt=https://bolt.xyz/t/{token}" npm run hunt
```

The `--json` output also includes a `links` object with the resolved Pons,
chart, deployer, and FOMO URLs for downstream automation.

## Opportunity Ranking

A score answers *"how clean is this launch?"*. A trader also needs *"is this an
unusually good spot to be early?"*. Each card carries an **opportunity read**,
and `backfill` prints a ranked **opportunity board**:

```text
OPPORTUNITIES  ranked by opportunity, best first
#1 $DOG    opp 100  EARLY  accel HIGH    comps 12/19  UNUSUALLY EARLY
#2 $MOON   opp 78   MID    accel MEDIUM  comps 12/19  BROAD DEMAND
#3 $CAT    opp 49   LATE   accel LOW     comps 12/19
#4 $RUG    opp 47   EARLY  accel LOW     comps 12/19  COORDINATED — CAUTION
```

Opportunity blends the honest score with **earliness** (curve fill), **demand
acceleration** (independent-buyer growth across snapshots), **independence** of
that demand (clusters remove fake breadth), the deployer's graduation habit, and
how **comparable historical setups** resolved (`comps 12/19` = 12 of 19 similar
past launches graduated). `UNUSUALLY EARLY` flags a strong setup still under 25%
filled; `COORDINATED — CAUTION` fires when the breadth is a cluster, not a crowd.

## REWIND

The radar sees every launch from block zero. `rewind <token>` replays what it saw
over time — score climbing, the moment a critical signal fired, the market cap at
that moment, and the eventual peak:

```text
🚀 $WILLOW   REWIND
T+0        score 42   9.0K HOOD MC
T+38s      score 61   14.0K HOOD MC
T+2m14s    ⚡ CRITICAL SIGNAL
   • 23 independent buyers
   • buyer velocity +283%
   • concentration falling
T+22m      score 62   2.2M HOOD MC

MC at signal 18.4K HOOD   peak 2.2M HOOD   122.2×
```

The timeline is built from the snapshot series the radar records as it re-sees a
token, so it fills in the more you run `hunt` / `scan`. Great for studying (or
proving) the setup that preceded a run.

## Live market read & the tape

Every card leads with a market line and ends with the tape — priced in the pair
token (**HOOD**), the way pons actually quotes, not ETH:

```text
MARKET  price 1.2e-5 HOOD  mcap 18.4K HOOD  liq 25.02 HOOD  fill 24.8% ▲+2.1  peak 122.2×
...
THE TAPE
  ▲ buy   0.100 HOOD   0x…2001
  ▼ sell  0.500 HOOD   0x…2003 taxed
```

Price and market cap are the implied spot from the curve reserves; `▲+2.1` is
fill momentum since the last look; buy/sell **pressure** appears in the metric
grid (`2.0× buy 14b/2s`).

## Wallet Intelligence Graph

`20 buyers` is a number. It is not intelligence. The graph reads the early
crowd and tells you whether that demand is *real* or *manufactured* — grouping
addresses into coordinated clusters, each link explained:

```text
WALLET GRAPH  14 buyers → 1 cluster · 10 independent   INSIDER CLUSTER
▸ A  INSIDER 99%  4 wallets
  ├ 4 funded from 0x0000…f00d
  ├ 4 repeatedly buy this deployer's launches
  ├ 4 entered within 2 blocks
  ├ 24 historical co-occurrences
  └ 4 route tokens to 0x0000…dead
```

Five independent signals, each degrading on its own when its source is absent:

| Signal | What it catches |
| --- | --- |
| **temporal** | wallets entering within a tight block window |
| **funnel** | many buyers routing tokens to one recipient |
| **co-occurrence** | wallets seen together across prior recorded launches |
| **repeat** | wallets that keep buying this deployer's launches |
| **funding** | wallets funded from the same source *(optional adapter)* |

Verdicts: **INSIDER CLUSTER** (coordinated, high confidence), **LIKELY BUNDLE**
(coordinated, lower confidence), **INDEPENDENT DEMAND** (genuinely broad). The
cluster verdict also feeds the score.

Co-occurrence, repeat, and DNA all draw on a small **persistent memory** of
launches the radar has already profiled (`.meme-radar-history.json`), so the
intelligence compounds the longer you run it. Funding-source linking is the one
signal that needs an external lookup — enable it with `RADAR_FUNDING=on` (it
resolves each early buyer's first funder via Blockscout).

## Deployer DNA

Deployer history gives counts; DNA turns them into a behavioural fingerprint you
can pattern-match a fresh launch against:

```text
DEPLOYER DNA  0x0000…d000
47 launches  9 grad (19%)  38m med→grad  9 med wallets  1.2% med dev
typical  low dev buy · ~6–12 early wallets · peak window ~38m
```

`med→grad`, `med wallets`, and `med dev` are medians over the launches the radar
has recorded for that deployer; peak-multiple is intentionally left blank until a
price adapter is wired, rather than guessed.

## Example

```text
▌ 06:56:07   SIGNAL   $WILLOW  ████████████ 100/100  ·curve
▌ WILLOW ROAD MENLO PARK  0x36fe…2eB9
▌
▌ EVIDENCE
▌ +15 dev buy 2.10%                    +10 creator tax 0.00%
▌ +8 2 social links                    +5 no declared bundle wallets
▌ +10 14 early buyers                  -10 supply concentration 18.0%
▌ +15 deployer graduated 3/3
▌
▌ dev buy     2.10% 0.21Ξ              early flow 14 buyers / 16 buys · 2 taxed
▌ curve fill  ▰▱▱▱▱▱ 24.8% 2.01/8.09Ξ  top holder 18.0%
▌ opening tax 0.19%                    bundle     none
▌ deployer    3 launches 3 grad        funding    — indexer adapter
▌
▌ ⚡ TRADE  [Pump.fun] [FOMO] [Pons] [Chart] [Deployer]
▙▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
```

In a real terminal the left edge, badge, gauge, and metric values are colour-
coded by verdict (orange = signal, yellow = watch, red = no signal), and the
`⚡ TRADE` buttons are clickable. The exact fields depend on what the chain
exposes for the launch and the configured observation window. Missing evidence
is shown as missing; it is not silently converted into a positive signal.

## Signal model

| Signal | Why it matters | Current implementation |
| --- | --- | --- |
| Creator buy | A meaningful creator position changes launch risk | canonical launch transaction when available |
| Early buyers | Breadth is more informative than a single large buy | decoded curve buy events |
| Supply concentration | Detects a launch dominated by a small set of wallets | observed early transfer/buy window |
| Tax and curve state | A high opening tax or unusual curve state can invalidate a setup | factory and token reads |
| Deployer history | Serial launches and graduations provide context | local history/index adapter |
| Wallet fingerprints | Repeated funding or synchronized wallets can indicate farming | warning only when adapter data exists |

Scoring rules are readable and intentionally conservative. See [`docs/SIGNALS.md`](docs/SIGNALS.md) for the current weights and caveats.

## Project layout

```text
MemeRadar/
├─ assets/       GitHub hero banner and project icon
├─ docs/         getting started, signals, architecture, limitations
├─ src/          CLI, chain reads, enrichment, scoring, rendering
├─ test/         deterministic scoring tests
├─ .env.example  safe configuration template
├─ LICENSE       MIT license
└─ README.md     product overview and operating guide
```

## Design principles

- **Read-only by default.** No wallet, signer, swap, or custody code.
- **Explainable output.** Every score is accompanied by positive and negative reasons.
- **Honest uncertainty.** Unsupported evidence is reported as unavailable.
- **Terminal-first.** The tool is useful over SSH, in a local shell, or alongside another trading workflow.
- **Small surface area.** The first version favors a reliable observer over a noisy dashboard.

## Limitations

This is an intelligence prototype, not a guarantee of safety or profit. Funding-wallet clusters, full historical deployer graphs, and richer liquidity analytics require a dedicated indexer or trace provider. Early concentration is limited to the observation window. RPC availability and event indexing can also affect freshness.

Read [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md) before using live output.

## Development

```bash
npm run typecheck
npm test
npm run build
npm run demo
```

The CI workflow runs these checks on Node 20 and Node 22. Generated `dist/`, `node_modules/`, local caches, and `.env` files are intentionally ignored by Git.

## License

MIT — see [`LICENSE`](LICENSE).

<div align="center">
  <sub>Built for research on Robinhood Chain. Never treat a score as financial advice.</sub>
</div>
