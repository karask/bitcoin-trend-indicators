# KK EMA Ribbon daily calibration — 22 September charts, analyzed 23 September 2026

## Decision

**Keep the shared daily Close EMA 32/34/48/58 preset.** Plot the 32/58 boundaries. The seven screenshots independently confirm that 32 and 58 reproduce the two visible Larsson Line v2.51 values across five matching exchange symbols, with only one last-digit difference on JUP's slow line. SOL and RAY are close on available proxy feeds. No change to the EMA periods, source, or state rule is justified. The production indicator's calibration metadata and caveat were updated to reflect this evidence; no deployment was made.

The hidden 34/48 averages still implement a **provisional** color rule: gold for full ascending EMA order (32 > 34 > 48 > 58), purple for full descending order, grey otherwise. The screenshots print only the 32/58 boundary values. Their broad gold/purple regions agree visually with the existing rule, including gold at each chart's latest candle, but these files cannot uniquely identify the two hidden periods or exact grey-transition dates. Weekly was not calibrated by daily charts.

## What the seven images show

The charts show the **22 September 2026 daily candle in progress**; the files were placed in Downloads on 23 September. I initially confused the file date with the chart candle date. The crosshairs point to older daily candles, and the two legend numbers belong to those historical dates. Current right-axis labels and prices are different observations. Calculated values below stop at each historical crosshair date, then round to the precision printed in the image. Thus the date correction does not change the boundary comparisons.

| File | Reference symbol and crosshair date | Printed fast / slow | Close EMA32 / EMA58 | Comparison |
|---|---|---:|---:|---|
| `image.png` | Binance BTC/USDT, 2025-02-03 | 100,575.94 / 98,007.66 | 100,575.94 / 98,007.66 | Exact displayed rounding |
| `image(1).png` | Binance ETH/USDT, 2020-08-01 | 277.79 / 257.39 | 277.79 / 257.39 | Exact displayed rounding |
| `image(2).png` | CRYPTO:SOLUSD, 2023-11-15 | 41.24 / 34.89 | 41.23 / 34.88 | Coinbase SOL/USD proxy; one cent per line |
| `image(3).png` | CRYPTO:RAYUSD, 2023-06-07 | 0.2098 / 0.2178 | 0.2106 / 0.2181 | Binance RAY/USDT proxy; 0.0008 / 0.0003 difference |
| `image(4).png` | Coinbase DOGE/USD, 2023-05-03 | 0.08155 / 0.08139 | 0.08155 / 0.08139 | Exact displayed rounding |
| `image(5).png` | Binance SUI/USDC, 2025-01-05 | 4.3143 / 3.9011 | 4.3143 / 3.9011 | Exact displayed rounding |
| `image(6).png` | Bitstamp JUP/USD, 2025-05-27 | 0.515302 / 0.512712 | 0.515302 / 0.512711 | Fast exact; slow off by 0.000001 |

The five matching-symbol crosshair OHLC candles (BTC, ETH, DOGE, SUI, JUP) match the screenshot headers. SOL and RAY have different OHLC candles on the available venues, so their boundary discrepancies are expected feed differences, not evidence for different EMA lengths. The Bitstamp JUP slow-line difference is about 0.0002% of the printed value, consistent with one historical candle or feed revision; the screenshot does not establish the cause.

Among integer Close EMA lengths 20–75, the shared 32-period fast line has mean relative error **0.001128%** across the five matching-symbol observations; the next-best 33 period has **0.206913%**. The shared 58-period slow line has **0.001466%** versus **0.173438%** for the next-best 59 period. This is a fit to five historical pairs, not a trading-performance result. Close also fits each matching-symbol pair much better than Open, HL2, HLC3 or OHLC4. All seven retrieved histories are daily-continuous through their crosshair dates.

## Implication for the app

- Daily visible boundaries: **Close EMA32 and EMA58**.
- Hidden color checks: **EMA34 and EMA48**, unchanged and provisional.
- Gold / purple / grey: current full-order rule, unchanged.
- The venue must be considered when checking any asset in the app: default BTC and ETH use Bitstamp, SUI uses Coinbase, JUP uses Kraken, and RAY uses Kraken history that starts after the historical RAY crosshair. Their live app numbers need not match the other venues in these images to the last digit.
- Other assets and weekly remain uncalibrated against this batch.

## Reproducibility

`download.py` copies the seven PNGs into the ignored local `data/kk-research-2026-09-23/references/` directory and records SHA-256 hashes and public candle URLs in `provenance.json`. Matching BTC, ETH, SOL and DOGE history starts from the repository's read-only SQLite candle archive and is extended with public exchange bars. SUI/USDC and RAY/USDT come from Binance; JUP/USD comes from Bitstamp. The archived research-only `*-daily.json` files end on the **finalized** 22 September bars. Those closes were not yet known when the screenshots showed the 22 September candle in progress, so they must not be used as screenshot-time closing prices. `analyze.py` filters to the older crosshair dates and checks the exact crosshair candle, daily continuity, alternate sources and lengths, and records full precision in `results.json`.

Run from the repository root: `python3 research/kk-ema-2026-09-23/analyze.py`. The Binance RAY/USDT comparison does not recreate TradingView's composite CRYPTO:RAYUSD history, and the Coinbase SOL/USD comparison does not recreate CRYPTO:SOLUSD. No private Larsson implementation was accessed or inferred from the pixels beyond the visible boundary values.

`node --experimental-strip-types research/kk-ema-2026-09-23/verify.ts` confirms the production TypeScript calculation matches the independent Python values and crosshair states for all seven assets. This passed, as did the repository unit suite and ESLint.
