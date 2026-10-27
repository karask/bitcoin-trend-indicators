# Daily KK Supertrend — 24 October 2026 screenshots

Reviewed on **25 October 2026**. Source: `TradingView-MoneyLine-39-daily-charts-6-months-2026-10-24` in Downloads.

**39 daily charts: 20 crypto, 17 stocks, 2 COMEX futures. All readable; none skipped and no new assets required.** The gold and silver charts remain GC1!/SI1! futures, not spot. Captures were approximately 09:03–09:22 UTC on Saturday 24 October. All comparisons use completed candles through **23 October**; the forming Saturday crypto candle is used only to check the displayed pending count, never the official signal or backtest.

**Production presets changed: none.** This is a research review. Weekly KK, other indicators, production databases, and the existing uncommitted October 22 review and overview edits were not changed. No commit, push or deployment was requested or performed.

## Findings

- Current daily presets match the latest official state for **36/39** charts; BONK, TSLA and BOT remain wrong-state cases.
- Current daily presets match both state and trail within 1% on **22/39** latest charts.
- Across the eight October batches (3, 5, 9, 12, 16, 19, 22, 24), **20/39** current presets keep every scored state and level within 1%, down from **24/39** before this batch. QNT, GOOGL, META and silver drop out. Silver has seven scored references because its October 3 target was unavailable. This is a level/state statistic, NOT a claim that all historical flip dates match.
- META has the only newly printed reversal: bearish, labelled 23 October. The app confirms its fifth close on 22 October, consistent with the next-session 23 October label; its new bear trail is nevertheless 8.94% too low.
- The earlier 22 October proposal to change INTC to 70/4 is **not supported** by this batch: it produces 110.7054 versus 105.80 (+4.64%). Keep the production 15/4 pending investigation; its error is +2.89%.

## Screenshot trail changes since 22 October

Eight levels moved; the other 31 are unchanged. Only META also changed official state.

| Asset | 22 Oct chart | 24 Oct chart | Current app calculation | Error |
|---|---:|---:|---:|---:|
| LINK | 16.19 | 15.073 | 14.6347 | -2.91% |
| SUI | 1.3935 | 1.2754 | 1.1093 | -13.02% |
| AVAX | 12.6071 | 11.3733 | 10.7501 | -5.48% |
| QNT | 258.8 | 235.6 | 251.6503 | +6.81% |
| INTC | 115.7 | 105.8 | 108.8548 | +2.89% |
| META | 713.35 | 757.7 | 689.9891 | -8.94% |
| GOLD | 4584.5 | 4454.4 | 4444.4069 | -0.22% |
| SILVER | 68.78 | 66.09 | 66.7656 | +1.02% |

## Pending confirmations

Crypto figures below include the forming Saturday candle, exactly as the screenshots do. Stock figures count the closed Friday session only: **no Saturday session is invented**. Both directions still require five consecutive completed closes, resetting on failure.

| Asset | Screenshot bearish count | App as captured | App completed closes |
|---|---:|---:|---:|
| BTC | 1/5 | 3/5 | 2/5 |
| ETH | 1/5 | 1/5 | 0/5 |
| DOGE | 3/5 | 3/5 | 2/5 |
| OP | 2/5 | 2/5 | 1/5 |
| HYPE | 1/5 | 1/5 | 0/5 |
| RAY | 2/5 | 2/5 | 1/5 |
| SNDK | 1/5 | 1/5 | 1/5 |
| AMD | 2/5 | 2/5 | 2/5 |

Seven of the eight printed pending counts match. **BTC does not:** its app trail is 81,620.16 rather than 80,859.48, so two earlier completed closes count as bearish and the open candle makes 3/5 instead of 1/5. SOL, JUP and ADA show no pending count on their charts, but the app's higher thresholds produce 1/5, 1/5 and 3/5 respectively as captured. This shows why a sub-1% level difference can still change reversal timing. These are dated comparisons, not live 25 October signals.

## Parameter search and decisions

The search changes only daily KK ATR length and multiplier. Each candidate must replay all archived observations; candidates are never ranked by backtest return. The coarse search uses 26 sampled ATR lengths from 5 to 200 and multipliers 1.5–8 in 0.5 steps (364 settings per asset). A diagnostic pass uses 44 sampled lengths and multipliers 1.5–9 in 0.1 steps on cases needing review. This is a bounded search, **not proof that no other possible setting exists**. Every retained coarse candidate and every fully consistent fine candidate is rechecked with the production indicator engine. Research flip-date checks accept a match on the completed signal bar or next bar/session; both dates remain recorded separately.

- **XMR:** 30/4 is only +0.05% on the new chart, but its worst earlier error remains 1.13%. The earlier diagnostic 27/3.9 still fits all eight levels (worst 0.66%), counts and date alignment. It is a possible finer fit, not a recovered setting or a new market-cap family. Retained 30/4 to respect the preference for a compact family and avoid another arbitrary decimal exception.
- **Silver:** 120/5.5 is +1.02% on the new chart, only just outside the 1% research threshold. 110/5 keeps all seven levels within 0.98% and retains the chart's printed flip-date alignment; 115/5.3 fits more tightly (worst 0.27%) but is a new decimal setting. Neither is adopted just to cross an arbitrary tolerance boundary. Silver's precise session/date convention remains uncertain.
- **GOOGL:** several settings improve the level (for example 100/5.5), but none of the tested fitting candidates also reproduces the historical June 8 flip. A tighter single line is not enough to justify another setting.
- **BTC and SOL:** alternative settings improve the displayed counts, but the tested level-fitting candidates still miss the historical flip date. Their 15/2 and 15/4 are kept, with the new count discrepancies recorded.
- **QNT and META:** newly expose the same post-flip identification problem already seen on ZEC, SUI, LINK and AVAX. They matched earlier bullish/pending behaviour, but no tested setting now keeps every level within 1% on both sides of the reversal. Their five-close timing can be right while the new opposite trail is wrong. Do not change the confirmation mechanism from a guess.
- **No new market-cap thresholds can be inferred.** Crypto cap tiers remain a fallback, not a demonstrated daily formula. The post-flip discrepancies appear in both crypto and equities, so market cap alone does not explain them. Weekly rules remain separate and untouched.

**Recommendation:** keep the current family rather than install more screenshot-specific exceptions. The most useful next evidence is the MoneyLine Inputs/settings panel (and, if possible, the indicator version) for one problematic asset such as QNT, META, SUI or LINK, including any separate bull/bear factor or trail-reset controls. More opposite-regime examples can distinguish rules, but these screenshots alone do not identify the private formula.

## All 39 current presets

Errors compare completed October 23 candles with the October 24 chart level. Wrong-state lines are not accepted as fits even when their numerical error happens to be small. Last-flip and pending mismatches are retained in review.json.

| Asset | ATR / factor | Chart state | App state | Chart trail | App trail | Error | Worst across batches |
|---|---|---|---|---:|---:|---:|---:|
| BTC | 15/2 | bull | bull | 80859.48 | 81620.1575 | +0.94% | 0.94% |
| ETH | 15/4 | bull | bull | 2369.63 | 2381.4909 | +0.50% | 1.00% |
| SOL | 15/4 | bull | bull | 101.15 | 101.8394 | +0.68% | 0.68% |
| DOGE | 15/4 | bull | bull | 0.079837 | 0.0798127 | -0.03% | 0.03% |
| LINK | 60/4.5 | bear | bear | 15.073 | 14.6347 | -2.91% | 9.61% |
| XMR | 30/4 | bull | bull | 493.18 | 493.4332 | +0.05% | 1.13% |
| SUI | 10/2 | bear | bear | 1.2754 | 1.1093 | -13.02% | 19.40% |
| JUP | 15/2.5 | bull | bull | 0.2872 | 0.2944299 | +2.52% | 2.52% |
| OP | 50/3.5 | bull | bull | 0.1158 | 0.1153954 | -0.35% | 0.35% |
| BONK | 15/2.5 | bull | bear | 0.0000024636000 | 0.0000035315539 | +43.35% | wrong state |
| ADA | 15/3.5 | bull | bull | 0.20319 | 0.2178385 | +7.21% | 7.21% |
| ATOM | 5/3.5 | bull | bull | 1.4673 | 1.4558 | -0.78% | 0.78% |
| HYPE | 15/4 | bull | bull | 75.9 | 75.6479 | -0.33% | 0.33% |
| DOT | 50/4.5 | bull | bull | 0.955 | 0.9553752 | +0.04% | 0.04% |
| BNB | 100/4 | bull | bull | 704.06 | 707.7059 | +0.52% | 0.52% |
| ZEC | 40/4 | bear | bear | 1592.95 | 1512.9572 | -5.02% | 5.02% |
| AVAX | 100/3 | bear | bear | 11.3733 | 10.7501 | -5.48% | 10.90% |
| RAY | 15/2.5 | bull | bull | 1.8143 | 1.8303 | +0.88% | 4.69% |
| VVV | 20/3.5 | bull | bull | 22.464 | 22.6582 | +0.86% | 0.86% |
| QNT | 27/3 | bear | bear | 235.6 | 251.6503 | +6.81% | 6.81% |
| TSLA | 100/4.5 | bull | bear | 317.57 | 378.0368 | +19.04% | wrong state |
| GOOGL | 15/5 | bear | bear | 370.44 | 365.3917 | -1.36% | 1.36% |
| NVDA | 50/5 | bull | bull | 210.26 | 208.4698 | -0.85% | 0.85% |
| SPCX | 15/4 | bull | bull | 137.34 | 145.0005 | +5.58% | wrong state |
| MU | 100/5 | bull | bull | 845.1 | 844.9522 | -0.02% | 0.02% |
| SNDK | 100/5.5 | bull | bull | 1249.03 | 1253.8895 | +0.39% | 0.39% |
| BMNR | 15/4 | bull | bull | 21.51 | 21.3792 | -0.61% | 0.61% |
| MSTR | 10/4.5 | bull | bull | 125.3 | 126.0105 | +0.57% | 0.57% |
| CRCL | 10/6 | bull | bull | 57.74 | 57.336 | -0.70% | 0.70% |
| INTC | 15/4 | bear | bear | 105.8 | 108.8548 | +2.89% | 2.89% |
| MRVL | 30/4 | bull | bull | 209.81 | 222.5051 | +6.05% | 6.05% |
| AMD | 20/4 | bull | bull | 540.92 | 544.3818 | +0.64% | 0.70% |
| AMZN | 50/6 | bull | bull | 233.26 | 235.2731 | +0.86% | 0.86% |
| META | 30/2 | bear | bear | 757.7 | 689.9891 | -8.94% | 8.94% |
| BOT | 10/3 | bull | bear | 19.96 | 29.5301 | +47.95% | wrong state |
| STRC | 20/4 | bull | bull | 97.43 | 96.9703 | -0.47% | 0.57% |
| PLTR | 30/4 | bull | bull | 186.58 | 181.8641 | -2.53% | 5.51% |
| GOLD | 40/4.5 | bear | bear | 4454.4 | 4444.4069 | -0.22% | 0.49% |
| SILVER | 120/5.5 | bear | bear | 66.09 | 66.7656 | +1.02% | 1.02% |

## Reproduction, execution and evidence

- `observations.json`: manually read chart levels, state, flip dates, eight pending counters, quote prices and SHA-256 image hashes. Original filenames remain recorded.
- `*-{venue}.json`: archived histories plus only the missing provider tail, ending 23 October. Yahoo split-adjustment overlap was checked before merging. Crypto requests and Yahoo session checks were paced sequentially. `fetch-failures.json` is empty after the completed fetch.
- `review.json`: every baseline replay, all coarse-grid level fits, bounded fine-grid summaries and fully consistent fine candidates. Latest and earlier chart checks are scored with their own dated fixtures, not today's entire history.
- Cost checks use 5/15/30 bps, next-session-open execution and 365 crypto / 252 equity-and-futures periods per year. Buy-and-hold uses the same evaluation window. Rolling four-year results are present where history permits; short listings do not fabricate four years. These backtests are diagnostics only; no return or profitability result selected a calibration.
- Scripts: `node --experimental-strip-types scripts/fetch-kk-october24.ts --fetch`, then `node --experimental-strip-types scripts/research-kk-october24.ts --search`. A rerun reuses downloaded fixtures; no market data is seeded or modified in production.
