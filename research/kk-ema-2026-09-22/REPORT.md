# KK EMA Ribbon — new daily chart calibration, 22 September 2026

## Result

**Retain Close-source EMA 32/34/48/58 for BTC, ETH, SOL and ZEC.** Plot the 32/58 boundaries; use the existing 34/48 alignment checks for the provisional gold/grey/purple state. The new screenshots support the existing shared daily preset. They do not justify coin-specific lengths, a different source, or replacement of the colour rule. No production parameters or deployment were changed.

## Reference date and feeds

The latest candle is **21 September 2026**, still incomplete at capture. BTC, ETH and ZEC opening prices match that date on the displayed exchanges. The files were saved on 22 September; that is not the chart candle date. The future crosshair dates in BTC, ETH and ZEC also do not date the last candle.

SOL has its crosshair on **20 October 2025**: its header OHLC refers to that historical candle. Its latest right-axis price is **116.77**, not the header close 189.82. The chart timeline is consistent with the same 21 September endpoint.

| Asset | Screenshot market | Comparison feed | Qualification |
|---|---|---|---|
| BTC | Coinbase BTC/USD | Coinbase BTC/USD | Matching venue and quote |
| ETH | Kraken ETH/USD | Kraken ETH/USD | Matching venue and quote |
| SOL | Binance SOL/USD | Binance SOL/USDT | Quote/feed proxy, not exact same-symbol validation |
| ZEC | Binance ZEC/USDT | Binance ZEC/USDT | Matching venue and quote; additional asset evidence |

Unlike the earlier September 14 screenshots, **these images do not print the ribbon boundary numbers**. Right-axis labels are current market prices, price-axis ticks or cursor levels. The measurements below are raster comparisons, not decimal-exact formula recovery.

## Existing preset: colour comparison

The preset was fixed before seeing these images. Coloured/grey pixels near the ribbon classify readable daily observations; obscured or ambiguous observations are omitted. The incomplete 21 September candle is excluded from this historical colour score.

| Asset | Accepted sample window | Readable samples | Matching samples | Agreement |
|---|---|---:|---:|---:|
| BTC | 2026-01-03 – 2026-09-20 | 227 | 225 | 99.1% |
| ETH | 2025-11-13 – 2026-09-20 | 265 | 263 | 99.2% |
| SOL | 2025-07-21 – 2026-09-20 | 375 | 368 | 98.1% |
| ZEC | 2025-09-13 – 2026-09-20 | 298 | 298 | 100.0% |

These percentages measure **sampled screenshot-colour agreement**, not trading performance, all-day coverage, or proven exact flip timing. ZEC matched every accepted sample, but omitted/ambiguous pixels and screenshot compression prevent claiming an exact reproduction. Much of BTC/ETH/SOL history overlaps the earlier evidence; this is mainly a closer-view verification, with ZEC adding a new asset.

The remaining disagreements are between grey and an adjacent trend colour. Several nearby inner-length combinations perform similarly. All four reconstructed screenshot-time states are gold/bullish.

## Boundary comparison

The price axes are logarithmic. Label positions establish the log-price mapping. The dated crosshair and latest candle establish the initial time mapping, then candle-wick positions refine it independently of any indicator. Filled regions identify the ribbon, and nearby coloured strokes locate its boundaries. Orange annotations, support/resistance lines and the volume profile are excluded by colour, position and region.

Median absolute boundary deviations at a standardized 2048-pixel chart width:

| Asset | Fast EMA32 | Slow EMA58 |
|---|---:|---:|
| BTC | 2.30 px | 1.62 px |
| ETH | 1.77 px | 1.56 px |
| SOL | 1.13 px | 0.90 px |
| ZEC | 1.68 px | 0.60 px |

The curves follow the reference closely. Stroke width, antialiasing, candle overlap, chart coordinate registration and SOL feed differences limit precision. Some neighbouring lengths or sources achieve slightly smaller raster errors on individual charts; those rankings are not consistent across assets and do not outweigh the earlier two-asset, four-number rounding matches for Close EMA32/58.

Calculated values using completed history through 20 September plus the screenshot partial close are below. **These are model outputs, not numbers transcribed from the ribbon.**

| Asset | EMA32 | EMA58 | Screenshot-time model state |
|---|---:|---:|---|
| BTC | 77,008.7211 | 74,202.8057 | Gold |
| ETH | 2,434.5466 | 2,302.2161 | Gold |
| SOL | 100.5188 | 94.5433 | Gold |
| ZEC | 1,101.5969 | 923.8346 | Gold |

## Would retuning the grey filter help?

Scanning ordered inner EMA lengths from 33 to 57 with the 32/58 boundaries fixed favoured 32/35/50/58 on this batch. Equal-weighted bullish/neutral/bearish agreement, then averaged equally across assets, improves from **98.24% to 98.63%**.

However, the same change worsens the archived September 14 batch from **97.19% to 96.93%** by the same metric. The gain on the new batch is small, the inner lengths are not uniquely identified, and the images have measurement uncertainty. **Keep 34/48** rather than selecting a new winner for each batch.

The old comparison reuses the archived daily histories and colour observations; the original September 14 files are no longer in Downloads. No claim is made that those old images were re-extracted in this run.

## Implementation implication

- Daily source: **Close**.
- EMA lengths: **32, 34, 48, 58**.
- Visible band: **32 / 58** only.
- Gold: EMA32 > EMA34 > EMA48 > EMA58.
- Purple: the reverse ordering.
- Grey: all other orderings, including equality.
- Use the same preset for ZEC; it now has additional approximate daily screenshot support.
- The colour rule remains provisional.
- Weekly settings were not calibrated by these daily charts.

## Reproducibility and validation

`download.py` archives the public exchange responses and merges only the same Coinbase market with its local history. Binance supplies 1000 daily bars for SOL/ZEC; Kraken supplies 721 ETH daily bars. `compare.py` checks continuous daily timestamps and valid OHLC ordering. Screenshot partial candles are research-only and never written to production stores.

Run with NumPy and Pillow: `register.py`, `calibrate.py`, then `compare.py`. `register.py` is independent of previous registration output. `calibrate.py` reads original Downloads images; copies are retained under the ignored local `data/kk-research-2026-09-22/references/` directory. `provenance.json` records image hashes and download URLs. `results.json` and `comparison.json` contain full scores, sample windows and disagreement dates.

`node --experimental-strip-types research/kk-ema-2026-09-22/verify.ts` confirms that the existing production calculation matches the independent Python EMA values and bullish screenshot-time state for all four assets. This check passed.
