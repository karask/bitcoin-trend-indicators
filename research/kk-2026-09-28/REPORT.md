# September 28 KK Supertrend calibration and asset additions

[Video source](https://www.youtube.com/watch?v=L_CvF4pDmOY&t=2400s). Individual source images remain in `data/kk-research-2026-09-28-video/` and are indexed in the [video inventory](../youtube-2026-09-28-L_CvF4pDmOY/REPORT.md).

Added CRCL, VVV, INTC, MRVL, AMD, AMZN, META, QNT, BOT, STRC, and PLTR. The nine stocks use Yahoo split-adjusted prices; VVV and QNT use Coinbase USD. Stock start dates follow verified provider availability, bounded by the application calendar. STRC is a preferred security, distinct from MSTR.

The 16 weekly references cover six existing stocks and ten additions. STRC has only a daily reference. Five daily references were reviewed: STRC, CRCL, BOT, SPCX, QNT. No hourly chart was used to calibrate a daily model.

## Method and limits

- Fixed cutoff: September 28, 2026 00:00 UTC. Stocks end September 25; crypto daily ends September 27; the last complete weekly bar starts September 21. Partial candles are excluded.
- Replay the application’s Wilder ATR / HL2 Supertrend calculation and existing five-consecutive-close daily confirmation. The documented [TradingView Supertrend recurrence](https://www.tradingview.com/support/solutions/43000634738-supertrend/) supplies the transparent model; this is not a recovered private MoneyLine formula.
- First check existing compact preset families; retain good existing fits. A bounded diagnostic grid uses ATR lengths 5, 7, 10, 14, 15, 20, 21, 30, 50 and integer multipliers 1–6. Decisions consider the level, regime, and readable historical flip date, never backtest profitability.
- Daily CRCL 50/6 and QNT 50/4 extend the former families. They are approximate, single-video calibrations; CRCL’s executable flip date matches, while QNT’s remains three days later. More same-feed references are needed.
- Six weekly screenshots match the **preceding** completed week substantially better. Report both values; do not drop a completed week in the live engine or shift historical signals to force a match.
- Screenshot flip dates generally describe executable opens, whereas model lastFlip is the signal candle. The report preserves this distinction. GOOGL’s partly obscured date is unscored.
- BOT’s sparse history and SPCX weekly cannot be reproduced reliably by the tested settings. They stay explicitly uncalibrated; no screenshot target is hardcoded into the indicator. STRC weekly has no supplied reference and remains 10/3.

## Weekly results

All supported weekly fits use ATR 15 / multiplier 2. BOT and SPCX retain 10/3 as unresolved fallbacks. Error below compares the latest completed-candle model against the screenshot.

| Asset | ATR/factor | Screenshot | Latest model | Error | Image/model state | Assessment |
|---|---|---:|---:|---:|---|---|
| CRCL | 15/2 | 62.45 | 62.500724 | +0.081% | bull/bull | approximate |
| VVV | 15/2 | 23.258 | 23.134248 | -0.532% | bull/bull | approximate |
| BOT | 10/3 | 7.86 | 53.243489 | +577.398% | bull/bear | unresolved |
| SNDK | 15/2 | 1808.89 | 1808.877365 | -0.001% | bear/bear | matched |
| INTC | 15/2 | 119.42 | 91.436754 | -23.433% | bear/bull | timing-difference |
| MU | 15/2 | 1097.54 | 1097.536901 | -0.000% | bear/bear | matched |
| MRVL | 15/2 | 249.77 | 191.406895 | -23.367% | bear/bull | timing-difference |
| AMD | 15/2 | 438.38 | 490.771977 | +11.951% | bull/bull | timing-difference |
| NVDA | 15/2 | 192.15 | 193.621332 | +0.766% | bull/bull | timing-difference |
| AMZN | 15/2 | 242.65 | 242.653687 | +0.002% | bull/bull | matched |
| META | 15/2 | 670.63 | 615.336660 | -8.245% | bear/bull | timing-difference |
| GOOGL | 15/2 | 380.37 | 380.370264 | +0.000% | bear/bear | matched |
| TSLA | 15/2 | 383.88 | 383.883956 | +0.001% | bear/bear | matched |
| PLTR | 15/2 | 141.97 | 150.359578 | +5.909% | bull/bull | timing-difference |
| SPCX | 10/3 | 158.13 | 211.530290 | +33.770% | bear/bear | unresolved |
| QNT | 15/2 | 160.41 | 161.193565 | +0.488% | bull/bull | approximate |

### Preceding-week comparisons

These comparisons use the September 14 bar as the final completed weekly bar. Live calculations continue through September 21.

| Asset | Screenshot | September 14 model | Error | Confirmed image/model state |
|---|---:|---:|---:|---|
| INTC | 119.42 | 119.422065 | +0.0017% | bear/bear |
| MRVL | 249.77 | 249.765971 | -0.0016% | bear/bear |
| AMD | 438.38 | 438.382527 | +0.0006% | bull/bull |
| NVDA | 192.15 | 192.151562 | +0.0008% | bull/bull |
| META | 670.63 | 671.012103 | +0.0570% | bear/bear |
| PLTR | 141.97 | 141.965452 | -0.0032% | bull/bull |

## Daily results

| Asset | Previous → applied | Screenshot | Completed model | Error | Image/model state | Assessment |
|---|---|---:|---:|---:|---|---|
| STRC | 10/3 → 30/4 | 94.11 | 93.581233 | -0.562% | bull/bull | approximate |
| CRCL | 10/3 → 50/6 | 57.74 | 59.082278 | +2.325% | bull/bull | approximate |
| BOT | 10/3 → 10/3 | 18.62 | 31.187956 | +67.497% | bull/bear | unresolved |
| SPCX | 15/4 → 15/4 | 115.88 | 124.599441 | +7.525% | bull/bull | approximate |
| QNT | 10/3 → 50/4 | 227.68 | 222.985776 | -2.062% | bull/bull | approximate |

## Per-reference decisions

- **CRCL 1W** ([video 40:27](https://www.youtube.com/watch?v=L_CvF4pDmOY&t=2427s)): 15/2 matches the bullish regime and September 8 executable flip; the Yahoo level differs by 0.081%.
- **VVV 1W** ([video 40:34](https://www.youtube.com/watch?v=L_CvF4pDmOY&t=2434s)): 15/2 matches the bullish regime and September 14 executable flip. Coinbase USD is a proxy for CRYPTO:VVVUSD; level error is -0.532%.
- **BOT 1W** ([video 41:18](https://www.youtube.com/watch?v=L_CvF4pDmOY&t=2478s)): Unresolved: only 20 completed weeks are available. No tested common integer preset reproduces the bullish screenshot regime. Keep the uncalibrated 10/3 fallback; do not substitute the screenshot price for an indicator.
- **SNDK 1W** ([video 41:52](https://www.youtube.com/watch?v=L_CvF4pDmOY&t=2512s)): Retain 15/2. The level differs by about $0.013; archived Yahoo history begins at the existing February 24, 2025 application cutoff.
- **INTC 1W** ([video 42:14](https://www.youtube.com/watch?v=L_CvF4pDmOY&t=2534s)): 15/2 reproduces 119.42 and the bearish regime through September 14. Including the completed September 21 week flips the model bullish; the screenshot still shows bearish with Bullish 1/1. The private update/confirmation timing is unresolved.
- **MU 1W** ([video 42:25](https://www.youtube.com/watch?v=L_CvF4pDmOY&t=2545s)): Retain 15/2; bearish state and displayed reversal level match to the cent.
- **MRVL 1W** ([video 42:43](https://www.youtube.com/watch?v=L_CvF4pDmOY&t=2563s)): 15/2 reproduces 249.77 and the bearish regime through September 14. The completed September 21 week flips the model bullish; the screenshot still shows bearish with Bullish 1/1. Preserve completed-candle semantics.
- **AMD 1W** ([video 43:05](https://www.youtube.com/watch?v=L_CvF4pDmOY&t=2585s)): 15/2 reproduces 438.38 through September 14 and the historical bullish reversal. The September 21 completed candle raises the model trail to 490.77; do not retune to compensate for the screenshot lag.
- **NVDA 1W** ([video 43:17](https://www.youtube.com/watch?v=L_CvF4pDmOY&t=2597s)): Retain 15/2: 192.15 matches through September 14. Including September 21 raises the trail to 193.62; bullish state is unchanged.
- **AMZN 1W** ([video 43:24](https://www.youtube.com/watch?v=L_CvF4pDmOY&t=2604s)): 15/2 reproduces the bullish state, 242.65 level, and August 3 executable flip.
- **META 1W** ([video 43:50](https://www.youtube.com/watch?v=L_CvF4pDmOY&t=2630s)): 15/2 gives 671.0121 and bearish through September 14, versus screenshot 670.63. Including September 21 flips the model bullish; the image still says bearish and Bullish 1/1. The small prior-level difference and confirmation timing remain disclosed.
- **GOOGL 1W** ([video 44:38](https://www.youtube.com/watch?v=L_CvF4pDmOY&t=2678s)): Retain 15/2; the bearish state and 380.37 level match. The screenshot flip date is obscured by candles and was not scored.
- **TSLA 1W** ([video 44:42](https://www.youtube.com/watch?v=L_CvF4pDmOY&t=2682s)): Retain 15/2; bearish state, 383.88 level, and July 27 executable flip match.
- **PLTR 1W** ([video 44:55](https://www.youtube.com/watch?v=L_CvF4pDmOY&t=2695s)): 15/2 reproduces 141.97 through September 14 and the August 10 executable bullish flip. The completed September 21 candle raises the model trail to 150.36.
- **SPCX 1W** ([video 45:12](https://www.youtube.com/watch?v=L_CvF4pDmOY&t=2712s)): Unresolved: only 15 complete IPO-era weeks are available. The existing 10/3 gives 211.53 versus 158.13; 15/2 also fails (194.80). No parameter or aggregation change is justified by this short reference.
- **QNT 1W** ([video 51:01](https://www.youtube.com/watch?v=L_CvF4pDmOY&t=3061s)): 15/2 matches the bullish regime and September 28 executable flip. Coinbase USD is a proxy for CRYPTO:QNTUSD, with +0.488% level difference.
- **STRC 1D** ([video 40:01](https://www.youtube.com/watch?v=L_CvF4pDmOY&t=2401s)): Apply 30/4: -0.562% level error; July 6 confirmed signal executes July 7, matching the screenshot. A numerically closer 15/5 was rejected because it reverses in August.
- **CRCL 1D** ([video 40:10](https://www.youtube.com/watch?v=L_CvF4pDmOY&t=2410s)): Apply approximate 50/6: +2.325% level error; September 10 signal executes September 11 as shown. Established stock-family candidates miss the level by at least 26.7%; the closer 10/6 candidate has the wrong reversal date. This extends the daily family and needs more screenshots.
- **BOT 1D** ([video 41:24](https://www.youtube.com/watch?v=L_CvF4pDmOY&t=2484s)): Unresolved: the default 10/3 remains bearish versus the bullish screenshot. Established daily families also fail; even the nearest bullish common-integer candidate misses the level by over 34%. Keep 10/3 explicitly uncalibrated.
- **SPCX 1D** ([video 45:22](https://www.youtube.com/watch?v=L_CvF4pDmOY&t=2722s)): Retain approximate 15/4. Level error is +7.525%; the September 14 signal executes September 15, later than the image September 11. Only 73 daily bars are available; this remains a weak fit.
- **QNT 1D** ([video 47:30](https://www.youtube.com/watch?v=L_CvF4pDmOY&t=2850s)): Apply approximate 50/4: -2.062% level error, bullish state. Model signal September 12 executes September 13 versus image September 10. The image shows an unfinished September 28 candle and Bearish 1/5; completed-candle replay has no pending count. This is a proxy-feed level/timing compromise, not a confirmation match.

## Persistence and reproducibility

- `observations.json`: transcribed targets, states, counters, readable dates, video links and source-image hashes.
- `candidates.json`: compact-family and selected additional candidates, with both current and preceding comparisons.
- `*-diagnostics.json`: bounded common-integer scans, including rejected settings.
- Per-asset JSON files: fixed daily and weekly OHLC, quality counts, retrieval timestamps, split signatures, source raw paths and hashes.
- `results.json` and `lib/kk-september28-evidence.ts`: decisions used by the app’s calibration notebook.
- Reproduce with `python3 research/kk-2026-09-28/download.py`, `node --experimental-strip-types scripts/research-kk-september28.ts`, `node --experimental-strip-types scripts/research-kk-september28-diagnostics.ts`, and `python3 research/kk-2026-09-28/register.py`. Downloads require network; fixture replay does not.
- Asset catalogs, selectors, overview routing and the scheduled crypto refresh groups include the additions. The shared stock refresh iterates the stock catalog automatically; the Python research service also includes VVV and QNT.
- No changes to standard SuperTrend, other indicator formulas, completed-bar aggregation, daily confirmation count, or next-open execution.

## Validation and deployment

- Passed 128 unit tests, 15 component tests, and two production-rendered HTML/bundle checks.
- Passed the production Next.js/Cloudflare Pages build, including TypeScript checking, and ESLint.
- Passed all six Python research-service tests using isolated temporary pytest/DuckDB dependencies.
- Replayed all 21 calibration references, checked non-repainting prefixes, partial-candle exclusion, unchanged other indicators, five-close daily confirmation and next-open execution.
- All 21 source-image files exist and match their archived SHA-256 hashes.
- All eleven prepared seed files replay idempotently in a temporary SQLite database: thirteen histories with completed-candle counts, actual retrieval timestamps and stock split metadata verified.
- New VVV/QNT daily and weekly histories were also saved to the local SQLite cache. Recreate seeds with `node --experimental-strip-types scripts/seed-kk-september28.ts`; add `--apply-local` to populate those two local crypto caches.
- The eleven SQL seed files are in ignored `data/cloudflare-seed/september28-*.sql`; the production Pages bundle is prepared in `dist/cloudflare-pages`.
- Release follow-up: low-confidence daily fits (STRC, CRCL, QNT, SPCX), unreliable BOT/SPCX fits, weekly timing mismatches and new uncalibrated timeframes have visible KK-specific warnings in both labs and the overview. The assets remain selectable.
- Hosted deployment uses the reviewed narrow seed files, Pages bundle and refresh Worker; release identifiers are recorded by Cloudflare.
