# KK Supertrend calibration review — 27 October 2026

Reviewed **27 October 2026**, from the two `TradingView-MoneyLine-39-…-2026-10-27` folders in Downloads. All 78 screenshots are readable; no asset additions or user clarification were needed. There are 20 crypto, 17 stocks and 2 COMEX continuous futures in each folder. Gold and silver are GC1!/SI1!, not spot.

**No production parameters, indicator algorithms, data-source defaults, application database or other indicators were changed.** This calibration review does not claim to have recovered the private MoneyLine formula. Existing unrelated overview and earlier research edits were preserved. No commit, push or deployment was requested or performed.

| Check | Daily | Weekly |
|---|---:|---:|
| Readable charts | 39 | 39 |
| Latest state + trail within 1%, app feeds | 23/39 | 33/39 |
| Latest state + trail with diagnostic alternate feeds | not substituted | 35/39 |
| Parameter changes | none | none |

## Most important findings

- **Weekly QNT and gold flipped bearish:** unchanged 15/2 reproduces the new trails at 270.24 vs 268.13 (+0.79%), and 4538.15 vs 4535.40 (+0.06%). TSLA's bullish 1/1 is provisional on the current week, not a completed weekly reversal.
- **Daily DOGE's bearish 5/5 is provisional:** four closed daily candles plus the open 26 October candle; the confirmed chart state remains bullish. Daily regimes are unchanged from the last batch.
- **Keep weekly's compact family.** The new XMR discrepancy is within 1% on KuCoin with the same 15/2; RAY likewise fits on Binance. No venue default is changed.
- **Daily is not fully calibrated:** 19/39 current settings keep every available dated state/level comparison within 1% across the nine batches; only 10/39 also match all scored counters and accepted date alignment. LINK and the metals have eight available references; the other assets have nine. Further one-image refits would add exceptions without identifying the private trail/reset logic. No new production preset is justified by this batch.
- **Cutoffs matter:** screenshots were captured late on 26 October UTC, already 27 October Athens. Crypto daily ends 25 October, stocks daily ends 26 October, and weekly ends the week starting 19 October. COMEX has a separate conservative app availability diagnostic. Yahoo silver revised a near-expiry candle; it was fully revalidated.

Detailed readings, all 39 presets per timeframe, errors, historical checks and candidate-search decisions:

- [Daily report](daily/REPORT.md)
- [Weekly report](weekly/REPORT.md)

No market-cap boundary beyond the existing weekly registry heuristic is established. Daily/weekly and asset classes remain separate; no other indicator is calibrated.

## Verification

Passed: eight new research tests; the full unit suite (29 TypeScript test files) and 15 component tests; `npx tsc --noEmit`; `npm run lint`; `git diff --check`. Research tests cover dated production replay, image/fixture hashes, separate daily/weekly cutoffs, provisional confirmations, incomplete weeks, futures revisions, unchanged presets, non-repainting and backtest execution/costs. Application/Pages builds were not rerun because no application implementation changed; no deployment was performed.
