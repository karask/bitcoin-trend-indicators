# Integer-only KK calibration

Historical report, superseded by [shared preset selection](SHARED-PRESETS.md). The broad-search settings below are no longer deployed.

User explicitly requested whole-number parameters closest to the supplied images. Scope: weekly Gold, Silver and Bitmine KK only. Daily presets, other assets, Standard SuperTrend and all other indicators remain unchanged. No data refresh, feed changes or database writes are needed.

| Asset | Previous ATR / multiplier | Integer-only choice | Screenshot flip | Calculated flip | Signed error | Regime |
| --- | --- | --- | ---: | ---: | ---: | --- |
| Gold | 10 / 2 | **10 / 2**, unchanged | 4,123.70 | 4,123.174089 | −0.525911 (−0.01275%) | Bullish; bearish flip below |
| Silver | 15 / 2.4 | **45 / 3** | 75.730 | 75.738702 | +0.008702 (+0.01149%) | Bearish; bullish flip above |
| Bitmine | 10 / 2.35 | **29 / 1** | 17.45 | 17.530972 | +0.080972 (+0.46403%) | Bullish; bearish flip below |

## Search and interpretation

Exhaustive bounded search: ATR length 1–100, multiplier 1–10, both integers; candidates must have enough warmup history and the same current regime as the screenshot. Rank by absolute flip-level error on the fixed completed weekly fixtures. These are the closest candidates **within that range**, not a claim about every possible positive integer or the original private settings. Regression tests reproduce the complete search. No backtest-return optimization, price offsets or formula changes are used.

Gold retains its well-supported simple 10/2 fit. Silver's 45/3 also reverses bearish on January 26, consistent with the January reversal visible in the image; 7/3 gives 75.677279 but reverses in March and is less close numerically. The earlier search stopped at ATR 30, which is why 45/3 was not considered then. Bitmine 29/1 reverses bullish on August 24, versus August 17 with the former 10/2.35 fit; the screenshot's exact date is not validated. A secondary integer fit 30/1 yields 17.339989, less close than 29/1.

Silver's ATR memory increases 15 → 45 and its multiplier 2.4 → 3: volatility reacts more slowly, and the basic band distance increases for a given ATR. Bitmine's ATR memory increases 10 → 29 while its multiplier falls 2.35 → 1: much smoother volatility, with a smaller basic ATR distance. Final trailing levels depend on the whole price path; they cannot be predicted by the multiplier alone.

## Limits and validation

The screenshots are weekly. All reference candles end with the week of August 31, 2026; the unfinished September 7 week is excluded. Gold/Silver use 400 Yahoo weekly candles. Bitmine has only 65 completed Yahoo weeks, while the image includes older history from 2018. Futures contract selection and TradingView back-adjustment differ from Yahoo's series. Integer-only fitting does not remove overfitting or these feed limitations; matching one level does not establish the full trail or a market-cap rule.

Archive exact image hashes, targets and source histories unchanged. Update only the selected preset and its reproducible result in the notebook evidence; absolute test tolerances are Gold 0.60, Silver 0.01 and Bitmine 0.09. Check all non-KK indicators and daily settings for equality, non-repainting prefixes, next-open execution, 5/15/30-bps costs, aligned price-series benchmarks, and 208-week rolling tests for metals. Bitmine has no four-year window. Prior fractional backtest figures in `REPORT.md` are historical, not current results.
