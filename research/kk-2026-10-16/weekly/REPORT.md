# Weekly KK Supertrend: 16 October 2026 chart batch

**Archive:** `TradingView-MoneyLine-39-weekly-charts-2-years-2026-10-16`, 39 weekly charts with two years of history, captured 14:34–14:43 UTC.

**Comparison candles:** completed weeks through the week of 5 October, from the archived October 12 fixtures. The week of 12 October was still forming and is ignored.

**Status:** research only. No preset or code was changed.

## Result: the class rule holds

The 8 October rule (BTC 10/3, crypto ≥ $50B 10/2, everything else 15/2) was scored on all 39 charts.

| Check | App feeds | Best matching feed |
|---|---:|---:|
| State right and Next Flip within 1% | **34 / 39** | **35 / 39** (RAY on Binance) |
| Last flip in the same week | **33 / 39** | **34 / 39** (ADA on Binance) |

- **Exact on stocks.** All 14 stocks with enough history (every stock except SPCX, BOT and BMNR) are within 0.00–0.08%.
- **AMD and PLTR now fit 15/2.** These were the two stock exceptions on 8 October, at multipliers 2.75 and 2.5; both are 0.00% today.
- **No better setting.** I tested 210 settings (ATR length 5–30, multiplier 1–5 in steps of 0.25), requiring both the level within 1% and the flip week to match.
  - Crypto below $50B: 15/2 matches 15 of 16 charts. The next best setting, 14/2, matches 7.
  - Stocks: 15/2 matches 14 of 14. The next best, 14/2, matches 10.
  - 15/2 is the only fitting setting for DOGE, OP, BONK, ADA and DOT.
- **Large caps and BTC.** ETH, SOL and BNB fit 10/2, and BTC fits 10/3, both on level and flip week. These single charts can't single out the ATR length, which was already true on 8 October.

## How the chart dates its flips

The chart's **Last Flip Date** is the week after the close that flipped the trend, and **Last Flip** is that week's open. In other words, it labels the entry week and price.

The model's flip close plus one week equals the chart's date on 33 of 39 charts. The open price matches to the cent on every stock. This is a labelling convention, not a timing difference. Futures weeks are labelled on Sunday, for example 2026-08-23 for the week of 24 August.

## Per-asset detail

| Asset | Rule | State | Chart Next Flip | Rule error | Flip week | Note |
|---|---|---|---:|---:|---|---|
| BTC | 10/3 | bull | 66981.79 | −0.18% | yes | |
| ETH | 10/2 | bull | 2248.76 | −0.18% | yes | |
| SOL | 10/2 | bull | 96.43 | −0.26% | yes | |
| DOGE | 15/2 | bear | 0.097192 | +0.01% | yes | |
| LINK | 15/2 | bull | 11.160 | −0.35% | yes | |
| XMR | 15/2 | bull | 453.74 | −0.34% | yes | |
| SUI | 15/2 | bull | 0.7980 | +0.09% | yes | |
| JUP | 15/2 | bull | 0.2374 | +0.02% | yes | |
| OP | 15/2 | bear | 0.15406 | +0.21% | yes | |
| BONK | 15/2 | bear | 0.0000050223 | −0.86% | yes | |
| ADA | 15/2 | bull | 0.16584 | +0.47% | no | Coinbase flips one week early. Binance ADAUSDT: −0.39%, same week. |
| ATOM | 15/2 | bull | 1.2943 | −0.37% | yes | |
| HYPE | 15/2 | bull | 72.893 | +0.18% | no | Kraken history starts in January 2026. KuCoin (from December 2024): −0.20%, flip one week off. |
| DOT | 15/2 | bull | 0.7905 | +0.39% | yes | |
| BNB | 10/2 | bull | 654.38 | +0.82% | yes | |
| ZEC | 15/2 | bull | 1198.81 | −0.20% | yes | |
| AVAX | 15/2 | bull | 7.988 | +0.10% | yes | |
| RAY | 15/2 | bull | 1.6566 | −2.02% | yes | Kraken feed. Binance RAYUSDT: −0.49%, same week. |
| VVV | 15/2 | bull | 23.258 | −0.53% | yes | |
| QNT | 15/2 | bull | 191.57 | −0.28% | yes | |
| TSLA | 15/2 | bear | 383.88 | 0.00% | yes | |
| GOOGL | 15/2 | bear | 380.37 | 0.00% | yes | |
| NVDA | 15/2 | bull | 204.94 | 0.00% | yes | |
| SPCX | 15/2 | bull | 124.71 | wrong state | no | IPO, see below. |
| MU | 15/2 | bear | 1097.54 | 0.00% | yes | |
| SNDK | 15/2 | bear | 1808.89 | 0.00% | yes | |
| BMNR | 15/2 | bull | 20.36 | −2.53% | no | History, see below. |
| MSTR | 15/2 | bull | 119.72 | 0.00% | yes | |
| CRCL | 15/2 | bull | 62.45 | +0.08% | yes | |
| INTC | 15/2 | bull | 91.44 | 0.00% | yes | |
| MRVL | 15/2 | bull | 218.36 | 0.00% | yes | |
| AMD | 15/2 | bull | 514.70 | 0.00% | yes | |
| AMZN | 15/2 | bull | 242.65 | 0.00% | yes | |
| META | 15/2 | bull | 620.67 | −0.04% | yes | |
| BOT | 15/2 | bull | 12.75 | wrong state | no | IPO, see below. |
| STRC | 15/2 | bull | 92.90 | +0.03% | yes | |
| PLTR | 15/2 | bull | 163.63 | 0.00% | yes | |
| Gold | 15/2 | bull | 4123.7 | −0.10% | yes | |
| Silver | 15/2 | bear | 74.315 | −3.09% | no | Yahoo SI=F contract-roll gaps, known since 9 September. |

## The five misses

- **SPCX and BOT (IPOs, 18 and 22 weeks).** On both, the chart has turned bullish while the model stays bearish.
  - **The rule's numbers are exact.** Once bullish, the 15/2 trail reproduces both charts: SPCX 124.71 (chart 124.71) and BOT 12.75 (chart 12.75).
  - **Two warm-up differences explain the misses:**
    1. **The partial IPO week.** The chart counts it as a bar; the app drops weeks with missing sessions. SPCX matches only with that week included.
    2. **The first flip after warm-up.** The chart shades the first 15 weeks, marks "bearish", then flips bullish within a few weeks. Under standard Supertrend the first bear band (bar midpoint + 2×ATR) sits far above price, so the model can't flip; the band is 47.6 on BOT against closes near 27–30.
  - **A rule that fits both flips:** "after warm-up, the first completed close is the bear trail". It is consistent with both charts but rests on two IPOs.
- **BMNR.** Yahoo's history starts at the June 2025 uplisting, so the mid-2025 spike dominates the ATR seed.
  - The chart's ATR is lower because it also has the older OTC history.
  - Yahoo has no earlier BMNR data, so this can't be reproduced. It is not a parameter problem.
- **Silver.** −3.09% on Yahoo continuous futures, the known contract-roll problem. A spot feed fit 15/2 on 8 October.
- **RAY** is outside 1% only on Kraken. It is −0.49% on Binance.

## Possible follow-ups (not done)

1. **No preset change.** The weekly rule is confirmed and needs no edits.
2. **IPO weekly handling (optional).** Count the partial first trading week for stocks, and adopt the "first close after warm-up" start. This would make SPCX and BOT match today, but it rests on two charts and affects only assets with very short histories.
3. **Flip-date display (optional).** Show the entry week and open beside the flip close, so the app's dates line up with the chart's Last Flip Date.

## Evidence

- `observations.json`: chart readings, with SHA-256 for each image and the fixture each chart was scored on.
- Alternate-feed daily fixtures used only for the feed checks: `ray-binance-daily.json`, `ada-binance-daily.json`, `hype-kucoin-daily.json`.
