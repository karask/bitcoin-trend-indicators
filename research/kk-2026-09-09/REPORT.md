# Gold, Silver and Bitmine — weekly KK calibration, 9 September 2026

Historical record: these fractional fits have been superseded at the user's request by the integer-only presets in `INTEGER-REPORT.md`. The results below describe the previous configuration, not the currently deployed presets.

Only KK Supertrend changes. Daily presets, Standard SuperTrend, other indicators, provider histories and calendar rules are untouched. Fixtures use completed weekly bars through 31 August 2026; the screenshot's unfinished September 7 week is excluded. Image hashes and exact audit results are in `lib/kk-followup-evidence.ts`.

| Screenshot | Regime / reversal | Prior ATR / factor | Selected ATR / factor | Yahoo result | Error |
| --- | --- | --- | --- | --- | --- |
| gold.jpeg | Bullish; bearish below 4,123.70 | 10 / 3 | 10 / 2 | 4,123.17409 | −0.01275% |
| silver.jpeg | Bearish; bullish above 75.730 | 10 / 3 | 15 / 2.4 | 75.82864 | +0.13025% |
| bitmine.jpeg | Bullish; bearish below 17.45 | 10 / 3 | 10 / 2.35 | 17.42637 | −0.13540% |

## Interpretation and limits

- **Gold:** multiplier 3 → 2, ATR 10 unchanged. Previous Yahoo result was bearish with upper trail 4,684.62598. New result is bullish, with the calculated reversal on August 17. The simple 10/2 group already used for ETH/SOL fits closely; the residual is a feed-level mismatch, not price rounding.
- **Silver:** ATR 10 → 15 and multiplier 3 → 2.4. Previous trail was 78.30538 (bearish). Shorter-memory 7/3 gives 75.67728, but its latest bearish reversal is March 16; the screenshot's bearish reversal is near the January peak. Selected 15/2.4 reverses January 26. We favor the established 15-bar memory and a coarse multiplier over arbitrary 23/2.4 or 27/2.5 choices that fit a single number slightly better. This is an approximate Yahoo-series proxy, not recovery of the private formula.
- **Bitmine:** keep ATR 10 and lower multiplier 3 → 2.35. Previous trail 15.31218; new trail approximately 17.43. Calculated reversal August 17; the exact screenshot reversal date is not legible/validated. Yahoo's history begins June 5, 2025 (verified with an explicit request from 2018); the chart includes much older prices and volatility. Do not fabricate that history or adjust unrelated data/indicators to force equality.

The TradingView metals charts are `GC1!` / `SI1!` with B-ADJ shown. Our Yahoo `GC=F` / `SI=F` series have different contract/roll histories; matching one endpoint does not establish matching paths. The Bitmine fixture has only 65 completed weeks versus the screenshot's history from 2018. Tests archive approximately matching levels with explicit absolute tolerances of 0.60, 0.11 and 0.03 respectively, not exact display-rounding claims. Further screenshots on the same source, or exported TradingView OHLC, are needed for stronger validation.

## Parameter search and pattern

Exploratory candidates used ATR lengths 5, 7, 10, 14, 15, 20, 21, 30 with factors 1, 1.5, 2, 2.5, 3, followed by lengths 5–30 and factors 1.5–3 in 0.1 increments for Silver/Bitmine. Bitmine's retained ATR 10 was refined to a 0.05 factor step; no backtest return was used to select parameters. Many pairs can match a single level, so the selected settings are explicitly approximate and feed-specific.

Gold adds support for a 10/2 group across different asset classes. Silver and Bitmine demonstrate why market capitalization cannot determine settings from this evidence: futures have no stock-style company capitalization, and roll adjustment, provider history and extreme past volatility affect ATR. Do not infer large/mid/small-cap boundaries from these fits.

## Research validation

Run the fixed-fixture tests for state/level, non-repainting prefixes, unchanged non-KK indicators/daily presets, next-bar-open execution, matched buy-and-hold dates and 5/15/30-bps sensitivity. Metals support full 208-week rolling tests; Bitmine does not have four years of data and must not show invented rolling results. Calibrated backtests are descriptive and in-sample, not independent validation of the private indicator.

Fixed-fixture 15-bps long/cash results (all eligible regime models share the same post-warmup dates):

| Asset | Open-to-open dates | Weekly observations | KK total return | Price-series buy-and-hold | KK max drawdown | Full rolling windows |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Gold | 6 Jul 2020–31 Aug 2026 | 321 | +104.09% | +147.37% | −22.47% | 3 |
| Silver | 6 Jul 2020–31 Aug 2026 | 321 | +69.44% | +261.68% | −51.33% | 3 |
| Bitmine | 5 Jan 2026–31 Aug 2026 | 34 | +1.38% | −26.35% | 0.00% | 0 |

Bitmine has only one execution and one exposed interval in this comparison; its zero observed drawdown has almost no evidential value. Metals simulations exclude roll/margin/financing costs and are not executable futures returns. At 5/15/30 bps, total returns are Gold +107.18/+104.09/+99.53%, Silver +72.49/+69.44/+64.95%, and Bitmine +1.48/+1.38/+1.23%. These results were calculated after preset selection, never optimized to select the presets.
