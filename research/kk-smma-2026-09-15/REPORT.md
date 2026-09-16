# KK ribbon — daily screenshot calibration

Research date: 15 September 2026. This folder contains research artifacts only; no production indicator or preset was changed.

## Conclusion

Use **closing-price EMA 32 and EMA 58 as the visible ribbon boundaries**, with the same lengths for BTC, ETH and SOL. This is a materially stronger match than the existing HL2 SMMA 15/19/25/29 model.

The BTC and SOL boundary pairs reproduce all four screenshot numbers to their displayed two-decimal precision. ETH is consistent with the same parameters, but its screenshot uses `CRYPTO:ETHUSD`, whereas the available comparison history is Binance ETHUSDT. Its two deviations are 0.0245% and 0.0390%; it is not an exact same-feed validation.

For a working three-colour prototype, use hidden **EMA 34 and EMA 48** as alignment checks between the visible 32/58 boundaries. This is a fitted approximation, not a recovered private colour formula. Nearby inner lengths fit similarly, and the screenshots do not establish unique values.

The technically accurate name would be **KK EMA Ribbon** or **KK Trend Ribbon**. Standard integer-period SMMA lengths cannot exactly implement the matched boundaries. A generalized Wilder recurrence with lengths 16.5 and 29.5 has the same update weights as EMA 32 and 58, respectively, but is not conventional integer-period SMMA.

## Reference identity and candle timing

The visible indicator is labelled `Larsson Line v2.51` in all three screenshots. The separate EMA Ribbon 20/25/.../55 entries are hidden. The screenshot headers show daily candles, and the BTC/SOL opening prices identify the active bar as **14 September 2026**.

| Asset | Screenshot symbol | Partial OHLC transcribed from screenshot | Visible boundaries |
|---|---|---|---|
| BTC | BINANCE:BTCUSDT | 76842.01 / 79007.90 / 76388.72 / 78928.32 | 75523.31 / 72767.38 |
| ETH | CRYPTO:ETHUSD | 2476.68 / 2536.34 / 2465.33 / 2528.78 | 2362.63 / 2232.08 |
| SOL | BINANCE:SOLUSDT | 99.31 / 103.11 / 99.00 / 102.96 | 96.54 / 91.03 |

Daily history ends at the completed 13 September bar. The screenshot's partial 14 September bar is appended only for the endpoint calculation. Using the later final close of 14 September, or excluding the partial candle, would compare a different moment with the screenshot.

## Numerical boundary checks

| Asset | Reference fast / slow | EMA 32 / 58, close, screenshot partial bar | Existing SMMA 15 / 29, HL2, same partial bar |
|---|---|---|---|
| BTC | 75523.31 / 72767.38 | **75523.306176 / 72767.382121** | 75878.184081 / 72750.685832 |
| ETH | 2362.63 / 2232.08 | **2363.208598 / 2232.950749** | 2380.727212 / 2233.855435 |
| SOL | 96.54 / 91.03 | **96.537374 / 91.034731** | 97.249452 / 91.027028 |

For comparison, completed-bar-only EMA32/58 values through 13 September are BTC 75303.627865 / 72551.208862; ETH 2352.526572 / 2222.570775; SOL 96.123011 / 90.616300. They should not be presented as the screenshot-time values.

The EMA recurrence is `E[t] = E[t-1] + 2/(length+1) * (close[t] - E[t-1])`. The research seeds at the first available close and uses thousands of warmup bars. A conventional SMMA/RMA instead uses an update weight of `1/length` and usually an SMA seed.

## Historical geometry check

The analysis maps screenshot x positions to dates using labelled year gridlines, and y positions to log prices using the printed price grid. It extracts gold and purple ribbon pixels, rejects the legend/volume regions, and compares the two boundaries across the historical chart. This is approximate raster measurement: stroke width, antialiasing, candle overlap and subpixel date alignment affect the score.

| Asset | Accepted ribbon columns | EMA32/58 median / mean absolute pixel error | Existing SMMA15/29 median / mean error |
|---|---:|---:|---:|
| BTC | 1209 | 0.48 / 0.79 px | 0.67 / 0.98 px |
| ETH | 1100 | 0.65 / 1.01 px | 0.87 / 1.20 px |
| SOL | 1095 | 0.55 / 0.90 px | 0.69 / 1.00 px |

The old ribbon was already visually close at this zoom. The decimal endpoint matches on two same-feed assets are stronger evidence for the new boundaries than the modest pixel-score improvement alone. The initial integer SMMA scan favoured fast lengths around 16; testing the intervening smoothing weight revealed the exact EMA32 boundary match.

## Colour/neutral rule: provisional

Suggested prototype:

- Gold when `EMA32 > EMA34 > EMA48 > EMA58`.
- Purple/blue when `EMA32 < EMA34 < EMA48 < EMA58`.
- Grey otherwise.
- Plot and fill between **EMA32 and EMA58 only**. The inner averages determine the state and do not widen the visible band.

A plain 32/58 crossover has no grey state. Fast-line slope filters and fixed percentage/ATR gap filters fitted the screenshot states less well than the tested alignment rules.

Screenshot colour observations are automatically classified near the calculated band and omit unclassifiable columns. They are not a manually audited daily signal export. The approximate sampled agreement for the full-sample-selected 32/34/48/58 prototype is:

| Asset | Sample window | Classified daily samples | Colour agreement |
|---|---|---:|---:|
| BTC | 2023-08-12 to 2026-09-09 | 988 | 98.89% |
| ETH | 2021-06-08 to 2026-08-23 | 1640 | 97.01% |
| SOL | 2022-08-27 to 2026-09-11 | 1273 | 97.33% |

These are **in-sample visual agreement scores, not trading accuracy, profitability, or exact flip-date accuracy**. Long trends, compressed daily bars, ambiguous colour transitions, and ETH feed differences limit interpretation. The fitting objective averages bullish, bearish and neutral class accuracy equally within each asset, then weights the three assets equally.

As a temporal sensitivity check, selecting inner lengths using only observations before 1 January 2025 favoured **33/47**, very narrowly ahead of 34/47 and neighbouring combinations. That training-selected 32/33/47/58 rule matched 98.32% BTC, 98.04% ETH and 96.05% SOL of classified later observations, with mean balanced class agreement of 96.78%. This is evidence that the alignment approach is useful, but also that **34/48 is not uniquely determined**. The 2025 boundary was examined retrospectively during the same research exercise, not as a pre-registered independent test.

## Proposed implementation specification

| Setting | Proposal | Evidence status |
|---|---|---|
| Timeframe | 1D | Explicit in all screenshots |
| Input | Close | Strong boundary evidence |
| Moving average | EMA | Matches standard recurrence with these lengths; does not prove internal private implementation |
| Visible boundaries | 32 / 58 | Exact displayed rounding on BTC and SOL; approximate ETH cross-feed support |
| Inner alignment lengths | 34 / 48, editable | Provisional shared fit; nearby settings similarly plausible |
| States | Fully ordered up / fully ordered down / otherwise grey | Approximation supported by sampled visual agreement |
| Shared preset | Same settings for BTC, ETH and SOL | No evidence here justifies asset-specific lengths |
| Live preview | Include current partial daily candle; mark it provisional | Needed to reproduce screenshot-time values |
| Confirmed signal/history | Evaluate only at completed daily close | Proposed app behaviour; partial screenshot colour is not confirmed |
| Display offset | 0 | No offset required for this fit |
| ATR filter / extra confirmation delay | None initially | Not required by the stronger fitted alignment model |

To claim exact colour reproduction would require more precise transition evidence or the original state series. Current evidence is sufficient for a clearly labelled approximate KK prototype, with high-confidence band geometry and provisional colour logic.

## Files and reproducibility

- `provenance.json`: original image paths, hashes, public request URLs and observation windows.
- `*-binance-tail.json`: raw public daily klines downloaded 15 September; may include a partial current bar and are not production data.
- `*-daily.json`: merged Binance histories truncated to completed 13 September bars. Histories were checked for daily gaps and OHLC ordering.
- `endpoint_scan.py`: initial integer SMMA endpoint scan.
- `calibrate.py`: historical pixel extraction and integer SMMA geometry scan.
- `color_scan.py`: approximate state extraction and alignment scan.
- `neutral_scan.py`: percentage/ATR neutral alternatives.
- `validate.py`: EMA endpoint checks, geometry comparison and temporal sensitivity check.
- `validation.json`, `pixel-results.json`, `color-results.json`, `neutral-results.json`: numeric outputs.

Run `calibrate.py`, then `color_scan.py`, then `neutral_scan.py` and `validate.py` with a Python environment containing NumPy and Pillow. The archived inputs make these stages offline. The current bundled interpreter is `/home/kos/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3`. Image paths remain in Downloads and are verified by the recorded SHA-256 hashes.
