# KK EMA Ribbon daily calibration for 30 September 2026

**All eleven charts support Close EMA32/58.** Eight pairs match both printed numbers after rounding; ZEC, RAY and HYPE differ by less than 0.04% on the available proxy histories. The user's accepted calibration difference is **0.2% per boundary**. Every asset is within that tolerance. Keep the shared daily 32/34/48/58 preset, with 32/58 as the visible ribbon boundaries.

The indicator's calibration date and explanation have been updated. The earlier RAY EMA40 exception was caused by a transcription error and has been corrected in the September 24 report and calculations. The hidden 34/48 periods and precise color transitions remain provisional; these eleven snapshot states are all gold and agree with the existing full-order rule. Daily screenshots provide no new weekly calibration.

## Screenshot dates and candle inputs

These are **30 September 2026 daily candles in progress**, with chart clocks from **05:59:13 to 06:04:21 UTC** (08:59 to 09:04 Athens time). The Downloads files have September 30 dates, the right edge of each chart is near October, and the current provider candles corroborate the selected daily date. In particular, the Binance BTC, ETH, SUI and LINK and Coinbase DOGE and Bitstamp JUP Opens match the screenshot headers exactly. No historical crosshair is selected.

Every calculation uses completed daily history through September 29 plus that chart's captured September 30 Close. Later provider prices are archived for date comparison and are excluded from the snapshot EMA calculation. Venue proxies account for small OHLC differences on the composite charts. Header values were inspected using enlarged crops in addition to the full charts.

## Comparison for all eleven assets

The two printed values are observations. The identification as EMA32/58 comes from comparison with exchange histories and nearby length and source alternatives.

| File | Asset and screenshot venue | Printed fast / slow | Calculated Close EMA32 / EMA58 | Comparison |
|---|---|---:|---:|---|
| `image.png` | BTC Binance USDT | 80,174.15 / 76,946.21 | 80,174.148257 / 76,946.212843 | Both round exactly |
| `image(1).png` | ETH Binance USDT | 2,547.47 / 2,408.37 | 2,547.466797 / 2,408.374362 | Both round exactly |
| `image(2).png` | SOL CRYPTO USD | 108.67 / 101.17 | 108.670614 / 101.172031 | Coinbase USD proxy; both round exactly |
| `image(3).png` | ZEC CRYPTO USD | 1,278.86 / 1,081.82 | 1,279.302697 / 1,082.234740 | Binance USDT proxy; +0.0346% / +0.0383% |
| `image(4).png` | RAY CRYPTO USD | 1.5536 / 1.2933 | 1.55410474 / 1.29375466 | Binance USDT proxy; +0.0325% / +0.0352% |
| `image(5).png` | HYPE CRYPTO USD | 85.178 / 79.740 | 85.188608 / 79.749653 | Hyperliquid proxy; +0.0125% / +0.0121% |
| `image(6).png` | DOGE Coinbase USD | 0.08932 / 0.08605 | 0.089321830 / 0.086049553 | Both round exactly |
| `image(7).png` | SUI Binance USDC | 0.9302 / 0.8609 | 0.930247356 / 0.860895390 | Both round exactly |
| `image(8).png` | JUP Bitstamp USD | 0.275266 / 0.250703 | 0.275265751 / 0.250703136 | Both round exactly after omitting flat zero-volume days |
| `image(9).png` | QNT CRYPTO USD | 116.21 / 94.59 | 116.207469 / 94.588890 | Coinbase USD proxy; both round exactly |
| `image(10).png` | LINK Binance USDT | 12.558 / 11.614 | 12.557610715 / 11.614342976 | Both round exactly |

Searching integer Close EMA lengths 15 through 100 gives **32** as the best fast length and **58** as the best slow length for every asset, including JUP after the documented no-trade handling. Across all eleven assets, mean absolute error is **0.00843%** for EMA32 and **0.00846%** for EMA58. Nearby alternatives are substantially worse: EMA33 fast averages 0.4713%, and EMA59 slow averages 0.2766%. At the 32/58 pair, Close averages 0.00844% across both boundaries; HL2 averages 0.44076%, HLC3 0.29224% and OHLC4 0.56516%. The batch favors Close with the current shared lengths.

Kraken gives RAY EMA32/58 of **1.55410407 / 1.29367716** and HYPE of **85.18717197 / 79.75058566**, also within 0.04% of the composite screenshots. No asset-specific period adjustment is warranted by this evidence.

## JUP no-trade days

Bitstamp's daily endpoint includes **32 flat zero-volume rows** before the September 30 snapshot. Counting those rows gives 0.275066639 / 0.250198702, a fast difference of -0.0724% and a slow difference of -0.2012%. Omitting just those flat no-trade rows gives 0.275265751 / 0.250703136, matching both displayed numbers after rounding. Fresh complete Bitstamp history agrees with the archived calendar-day OHLC history, so revisions to those candles do not explain the discrepancy.

The same treatment reproduces the earlier May 27, 2025 JUP reference: **0.515302 / 0.512712** after rounding. This is evidence that TradingView omits Bitstamp's synthetic no-trade bars for this chart. It is an inference about that venue's chart inputs, not a different EMA formula. Production JUP uses Kraken, so the research filter is specific to the Bitstamp screenshot comparison and is not applied globally to production candles.

## Correction to the previous RAY report

The archived September 24 screenshot prints **1.3443 / 1.1263**, with OHLC **1.9777 / 2.1633 / 1.9172 / 1.9292**. The original transcription recorded 1.343 / 1.263 and an incorrect Close of 1.992. Recalculating the corrected snapshot gives Binance EMA32/58 of **1.34449100 / 1.12654817**, within 0.023% per line, and Kraken **1.34500680 / 1.12672350**, within 0.053%. The old EMA40 claim is withdrawn. Both that corrected snapshot and the current RAY chart support EMA32/58.

The September 24 acquisition configuration, provenance, calculation precision, results and report now contain the corrected values. The September 23 report also records the follow-up explanation of JUP's earlier last-digit difference.

## Calibration scope and reproduction

The shared visible boundaries are supported for the eleven assets in this batch. The 34/48 inner averages remain a provisional explanation of gold, purple and grey transitions. All eleven current snapshots are gold under the existing ordering rule, but this single state does not identify hidden periods or prove exact historical transition dates. Weekly calibration and assets outside this batch require separate references.

Screenshot copies, original provider responses and SHA-256 hashes are archived locally under ignored `data/kk-research-2026-09-30/`. `provenance.json` records the venues, snapshot OHLC, provider URLs, retrieval times, screenshot clocks and history sources. Completed histories and `results.json` are retained with this report. Binance supplies BTC, ETH, SUI and LINK, plus RAY/ZEC proxies; Coinbase supplies DOGE and SOL/QNT proxies; Hyperliquid supplies HYPE; Bitstamp supplies JUP; Kraken provides independent RAY/HYPE checks.

Run `python3 research/kk-ema-2026-09-30/analyze.py` to reproduce the comparisons from archived histories. It checks complete daily coverage before the snapshot, uses the captured Close, searches lengths and sources, records the special Bitstamp comparison, and applies the accepted 0.2% tolerance. The production EMA recurrence uses the same initialization and weighting as the research calculation.

The app can use different venues from the images: BTC and ETH default to Bitstamp; SOL, DOGE, SUI, LINK and QNT to Coinbase; RAY, HYPE and JUP to Kraken; ZEC to Binance. Exact screenshot rounding on a reference venue does not guarantee exact prices on the app's default venue. Composite feeds are approximated with public exchange histories, and no trading-performance conclusion follows from these calibration comparisons.
