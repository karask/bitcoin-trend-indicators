# Weekly KK Supertrend — 27 October 2026 batch

Reviewed **27 October 2026**, from the two `TradingView-MoneyLine-39-…-2026-10-27` folders in Downloads. All 78 screenshots are readable; no asset additions or user clarification were needed. There are 20 crypto, 17 stocks and 2 COMEX continuous futures in each folder. Gold and silver are GC1!/SI1!, not spot.

**No production parameters, indicator algorithms, data-source defaults, application database or other indicators were changed.** This calibration review does not claim to have recovered the private MoneyLine formula. Existing unrelated overview and earlier research edits were preserved. No commit, push or deployment was requested or performed.

## Completed-week comparison

Captures were **26 October 23:10–23:15 UTC** (27 October in Athens). The last completed Monday-based week starts **19 October**: crypto through Sunday 25 October; stocks and COMEX through Friday 23 October. The week starting 26 October is incomplete and excluded, even though Monday's US stock session had closed. Full archived history is used to warm up ATR, not only the visible two-year window.

## Result

- Approved class rule: **BTC 10/3; ETH, SOL and BNB 10/2; other crypto, stocks and futures 15/2.** The ≥$50B registered crypto tier remains the existing weekly heuristic, not a freshly measured market-cap threshold.
- App-feed state and trail within 1%: **33/39** (previously 34/39). Same count holds across all three weekly batches reviewed here.
- With diagnostic exchange alternatives: **35/39** latest charts fit. XMR on KuCoin and RAY on Binance resolve two level discrepancies without changing parameters. These USDT alternatives are not assumed identical to composite USD and do not change production sources.
- Flip entry-week matches on **33/39** app feeds, or 34/39 using Binance ADA.
- **Two new bearish flips are reproduced by unchanged 15/2:** QNT and gold. The model flips on the completed week of 19 October; chart entry labels are 26 October for QNT and Sunday 25 October for COMEX gold.

| New bearish flip | ATR/factor | Chart new trail | App new trail | Error |
|---|---|---:|---:|---:|
| QNT | 15/2 | 268.13 | 270.2421 | +0.79% |
| GOLD | 15/2 | 4535.4 | 4538.1458 | +0.06% |

These add two independent examples supporting the standard opposite-band initialization on weekly charts. Daily still has its separate five-close/held-trail identification problem.

## Weekly chart changes since 19 October

| Asset | Previous chart | New chart | Current app replay | Error |
|---|---:|---:|---:|---:|
| XMR | 453.74 | 475.78 | 469.191 | -1.38% |
| QNT | 191.57 | 268.13 | 270.2421 | +0.79% |
| GOOGL | 380.37 | 377.6 | 377.6033 | +0.00% |
| INTC | 125.75 | 119.04 | 119.0408 | +0.00% |
| GOLD | 4123.7 | 4535.4 | 4538.1458 | +0.06% |
| SILVER | 72.31 | 69.42 | 67.1209 | -3.31% |

Six material trail changes. SUI's displayed precision changed 0.7980 → 0.79803, not evidence of a new configuration. Other chart trails are unchanged. Only QNT and gold changed official weekly state.

**TSLA remains officially bearish.** Its screenshot's Bullish 1/1 belongs to the still-forming week of 26 October. Monday's close above 383.88 does not complete a weekly reversal. Do not change its confirmed regime or parameters from that provisional counter.

## Feed and history diagnostics

| Asset | App feed error | Alternate feed | Alternate trail | Error | Flip entry-week right? |
|---|---:|---|---:|---:|---|
| XMR | -1.38% | kucoin USDT | 472.7621 | -0.63% | yes |
| ADA | +0.47% | binance USDT | 0.1651981 | -0.39% | yes |
| HYPE | +0.18% | kucoin USDT | 72.746 | -0.20% | no |
| RAY | -2.02% | binance USDT | 1.6486 | -0.49% | yes |

- XMR's new rising trail is 469.19 on Kraken versus the composite chart's 475.78 (−1.38%), but 472.76 on KuCoin (−0.63%) with unchanged 15/2. A venue difference is a plausible explanation; this does not prove the exact composite construction.
- RAY remains a Kraken-versus-composite difference; Binance is within 0.49%. ADA's Binance flip week matches, whereas Coinbase flips one week earlier. HYPE still has a historical flip-week mismatch on both checked sources despite a close level.
- SPCX and BOT remain short-IPO initialization cases; BMNR's Yahoo history starts at its uplisting and lacks the older OTC warm-up. These are not evidence for three arbitrary new multipliers.
- Silver remains a Yahoo SI=F versus TradingView SI1! contract-roll discrepancy. Full-history revalidation recorded Yahoo's newly revised 23 October near-expiry bar. Retain that provenance instead of attributing all disagreement to ATR settings.

## Compact-family check

A class-wide diagnostic grid tested nine sampled ATR lengths (5, 10, 12, 14, 15, 16, 20, 25, 30) and nine multipliers (1–5 in 0.5 steps): 81 common settings. A match requires correct state, trail within 1% and the chart's flip entry-week in **all three** dated weekly batches (16, 19, 27 October), not just the latest chart. No independent per-asset preset is installed.

| Group | Best shared tested setting | Matching assets | Next setting | Matching assets |
|---|---|---:|---|---:|
| Crypto in 15/2 tier (16) | 15/2 | 12 | 16/2 | 5 |
| Stocks (17) | 15/2 | 14 | 16/2 | 13 |
| Futures (2) | 10/2 | 1 | 12/2 | 1 |

Several futures settings tie on gold and none fits silver; two metals cannot identify a market-cap family. The broadest shared weekly setting remains 15/2 for the other crypto and stocks. Feed-matched level-only coverage is higher than this deliberately stricter state/level/date score. No new small/mid-cap cutoff can be estimated from these screenshots alone; the existing $50B split is an empirical registry heuristic, not a proven universal rule.

## All 39 weekly presets

| Asset | ATR/factor | Chart state | App state | Chart trail | App trail | Error | Entry week right? |
|---|---|---|---|---:|---:|---:|---|
| BTC | 10/3 | bull | bull | 66981.79 | 66861.7728 | -0.18% | yes |
| ETH | 10/2 | bull | bull | 2248.76 | 2244.8047 | -0.18% | yes |
| SOL | 10/2 | bull | bull | 96.43 | 96.1766 | -0.26% | yes |
| DOGE | 15/2 | bear | bear | 0.097192 | 0.0972052 | +0.01% | yes |
| LINK | 15/2 | bull | bull | 11.16 | 11.1209 | -0.35% | yes |
| XMR | 15/2 | bull | bull | 475.78 | 469.191 | -1.38% | yes |
| SUI | 15/2 | bull | bull | 0.79803 | 0.7987026 | +0.08% | yes |
| JUP | 15/2 | bull | bull | 0.2374 | 0.2374562 | +0.02% | yes |
| OP | 15/2 | bear | bear | 0.15406 | 0.1543868 | +0.21% | yes |
| BONK | 15/2 | bear | bear | 0.0000050223000 | 0.0000049789029 | -0.86% | yes |
| ADA | 15/2 | bull | bull | 0.16584 | 0.1666196 | +0.47% | no |
| ATOM | 15/2 | bull | bull | 1.2943 | 1.2895 | -0.37% | yes |
| HYPE | 15/2 | bull | bull | 72.893 | 73.0259 | +0.18% | no |
| DOT | 15/2 | bull | bull | 0.7905 | 0.7935904 | +0.39% | yes |
| BNB | 10/2 | bull | bull | 654.38 | 659.7675 | +0.82% | yes |
| ZEC | 15/2 | bear | bear | 1609.19 | 1615.5006 | +0.39% | yes |
| AVAX | 15/2 | bull | bull | 7.9879 | 7.9957 | +0.10% | yes |
| RAY | 15/2 | bull | bull | 1.6566 | 1.6232 | -2.02% | yes |
| VVV | 15/2 | bear | bear | 32.256 | 32.449 | +0.60% | yes |
| QNT | 15/2 | bear | bear | 268.13 | 270.2421 | +0.79% | yes |
| TSLA | 15/2 | bear | bear | 383.88 | 383.884 | +0.00% | yes |
| GOOGL | 15/2 | bear | bear | 377.6 | 377.6033 | +0.00% | yes |
| NVDA | 15/2 | bull | bull | 204.94 | 204.9442 | +0.00% | yes |
| SPCX | 15/2 | bull | bear | 124.71 | 194.4736 | +55.94% | no |
| MU | 15/2 | bear | bear | 1097.54 | 1097.5369 | -0.00% | yes |
| SNDK | 15/2 | bear | bear | 1808.89 | 1808.8774 | -0.00% | yes |
| BMNR | 15/2 | bull | bull | 20.36 | 19.8458 | -2.53% | no |
| MSTR | 15/2 | bull | bull | 119.72 | 119.7219 | +0.00% | yes |
| CRCL | 15/2 | bull | bull | 62.45 | 62.5007 | +0.08% | yes |
| INTC | 15/2 | bear | bear | 119.04 | 119.0408 | +0.00% | yes |
| MRVL | 15/2 | bull | bull | 218.36 | 218.362 | +0.00% | yes |
| AMD | 15/2 | bull | bull | 514.7 | 514.697 | -0.00% | yes |
| AMZN | 15/2 | bull | bull | 242.65 | 242.6537 | +0.00% | yes |
| META | 15/2 | bull | bull | 626.14 | 625.9207 | -0.04% | yes |
| BOT | 15/2 | bull | bear | 12.75 | 39.8075 | +212.22% | no |
| STRC | 15/2 | bull | bull | 92.9 | 92.9245 | +0.03% | yes |
| PLTR | 15/2 | bull | bull | 163.63 | 163.6348 | +0.00% | yes |
| GOLD | 15/2 | bear | bear | 4535.4 | 4538.1458 | +0.06% | yes |
| SILVER | 15/2 | bear | bear | 69.42 | 67.1209 | -3.31% | no |

## Evidence and reproduction

`observations.json` contains 39 manually read chart levels/states/flip dates with original filenames and SHA-256s. `review.json` holds three dated production replays per asset, the family search and four alternate-feed diagnostics. Daily histories are shared with the daily review, not downloaded again. The alternate fetch makes four sequential read-only requests; it does not seed D1.

Backtest diagnostics retain 52 periods/year, next-session-open execution, 5/15/30-bps costs, same-window buy-and-hold, and rolling four-year windows where sufficient history exists. Incomplete weeks are never backtested. No parameter was chosen by profitability.

Reproduce after the daily fixtures: `node --experimental-strip-types scripts/fetch-kk-october27-alternates.ts --fetch`, `node --experimental-strip-types scripts/research-kk-october27-weekly.ts --search`, then `node scripts/report-kk-october27.mjs`.
