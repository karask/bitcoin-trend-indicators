# Weekly KK Supertrend: 19 October 2026 chart batch

**Archive:** `TradingView-MoneyLine-39-weekly-charts-2-years-2026-10-19`, 39 weekly charts with two years of history, captured 14:56–15:04 ET (18:56–19:04 UTC).

**Comparison candles:** completed weeks through the week of 12 October, from this batch's daily fixtures (`research/kk-2026-10-19/daily/`). The week of 19 October was still forming and is ignored.

**Status:** research only. No preset or code was changed.

## Result: the class rule holds, and it predicted three new flips

The 8 October rule (BTC 10/3, crypto ≥ $50B 10/2, everything else 15/2) was scored on all 39 charts.

| Check | App feeds | Best matching feed |
|---|---:|---:|
| State right and Next Flip within 1% | **34 / 39** | **35 / 39** (RAY on Binance) |
| Last flip in the same week | **33 / 39** | **34 / 39** (ADA on Binance) |

- **Three new weekly flips are reproduced exactly.** ZEC, VVV and INTC turned bearish on the close of the week of 12 October; the chart dates each one 19 October, the next week's open.
  - The rule gets the flip week right on all three.
  - The new bear trail is within 1% on all three: ZEC +0.39%, VVV +0.60%, INTC 0.00%.

  This is the first weekly evidence for how a new trail starts after a flip. The standard opposite band reproduces it.
- **Other changes since 16 October:** META's bull trail rose 620.67 → 626.14, and the rule matches it (−0.04%). Silver's bear trail fell 74.315 → 72.310. Every other level is unchanged.
- **The misses are the same five as on 16 October:**
  - SPCX and BOT: IPO warm-up;
  - BMNR: short Yahoo history;
  - silver: Yahoo futures contract rolls;
  - RAY: Kraken feed (−0.49% on Binance).

## Per-asset detail

| Asset | Rule | State | Chart Next Flip | Rule error | Flip week | Note |
|---|---|---|---:|---:|---|---|
| BTC | 10/3 | bull | 66981.8 | −0.18% | yes |  |
| ETH | 10/2 | bull | 2248.76 | −0.18% | yes |  |
| SOL | 10/2 | bull | 96.43 | −0.26% | yes |  |
| DOGE | 15/2 | bear | 0.097192 | +0.01% | yes |  |
| LINK | 15/2 | bull | 11.16 | −0.35% | yes |  |
| XMR | 15/2 | bull | 453.74 | −0.34% | yes |  |
| SUI | 15/2 | bull | 0.798 | +0.09% | yes |  |
| JUP | 15/2 | bull | 0.2374 | +0.02% | yes |  |
| OP | 15/2 | bear | 0.15406 | +0.21% | yes |  |
| BONK | 15/2 | bear | 5.0223e-06 | −0.86% | yes |  |
| ADA | 15/2 | bull | 0.16584 | +0.47% | no | Coinbase flips one week early; Binance ADAUSDT −0.39%, same week. |
| ATOM | 15/2 | bull | 1.2943 | −0.37% | yes |  |
| HYPE | 15/2 | bull | 72.893 | +0.18% | no | Kraken history starts January 2026; KuCoin −0.20%, one week off. |
| DOT | 15/2 | bull | 0.7905 | +0.39% | yes |  |
| BNB | 10/2 | bull | 654.38 | +0.82% | yes |  |
| ZEC | 15/2 | bear | 1609.19 | +0.39% | yes | **New bearish flip**, reproduced. |
| AVAX | 15/2 | bull | 7.9879 | +0.10% | yes |  |
| RAY | 15/2 | bull | 1.6566 | −2.02% | yes | Kraken feed; Binance RAYUSDT −0.49%, same week. |
| VVV | 15/2 | bear | 32.256 | +0.60% | yes | **New bearish flip**, reproduced. |
| QNT | 15/2 | bull | 191.57 | −0.28% | yes |  |
| TSLA | 15/2 | bear | 383.88 | +0.00% | yes |  |
| GOOGL | 15/2 | bear | 380.37 | +0.00% | yes |  |
| NVDA | 15/2 | bull | 204.94 | +0.00% | yes |  |
| SPCX | 15/2 | bull | 124.71 | wrong state | no | IPO warm-up (16 October report). |
| MU | 15/2 | bear | 1097.54 | −0.00% | yes |  |
| SNDK | 15/2 | bear | 1808.89 | −0.00% | yes |  |
| BMNR | 15/2 | bull | 20.36 | −2.53% | no | Yahoo history starts at the June 2025 uplisting. |
| MSTR | 15/2 | bull | 119.72 | +0.00% | yes |  |
| CRCL | 15/2 | bull | 62.45 | +0.08% | yes |  |
| INTC | 15/2 | bear | 125.75 | −0.00% | yes | **New bearish flip**, reproduced. |
| MRVL | 15/2 | bull | 218.36 | +0.00% | yes |  |
| AMD | 15/2 | bull | 514.7 | −0.00% | yes |  |
| AMZN | 15/2 | bull | 242.65 | +0.00% | yes |  |
| META | 15/2 | bull | 626.14 | −0.04% | yes | Level rose from 620.67. |
| BOT | 15/2 | bull | 12.75 | wrong state | no | IPO warm-up (16 October report). |
| STRC | 15/2 | bull | 92.9 | +0.03% | yes |  |
| PLTR | 15/2 | bull | 163.63 | +0.00% | yes |  |
| Gold | 15/2 | bull | 4123.7 | −0.10% | yes |  |
| Silver | 15/2 | bear | 72.31 | −3.92% | no | Yahoo SI=F contract-roll gaps. |

The flip week compares the model's flip close plus one week with the chart's Last Flip Date, under the labelling found on 16 October.

## Recommendation

No change. The weekly rule needs no edits. The two optional follow-ups from 16 October still apply: IPO-week handling and showing flip dates in the chart's convention.

## Evidence

- `observations.json`: chart readings, with SHA-256 for each image and the fixture used.
- `ray-binance-daily.json`, `ada-binance-daily.json`, `hype-kucoin-daily.json`: alternate-feed daily candles through 18 October.
