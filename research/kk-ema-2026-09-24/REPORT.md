# KK EMA Ribbon daily calibration — 24 September 2026

## Result

**Keep the shared daily Close EMA 32/34/48/58 preset for now.** Six charts support the visible 32/58 band: ETH, DOGE and LINK round exactly from their matching feeds, and SOL, HYPE and ZEC are close using available feed proxies. RAY is a material exception and remains unresolved. Its current screenshot's slower value matches an EMA40 on two exchange histories, while the earlier RAY screenshot aligned much more closely with EMA58. The CRYPTO composite history cannot be recreated from either exchange series, so one current point is not enough to choose an asset-specific period or change the shared preset.

The hidden EMA34/48 color checks remain provisional. Five charts show the September 24 candle in progress; the other two have crosshairs on older dates. Their broad color states are consistent with the current ordering rule, but they do not identify the inner lengths or precise grey transitions. Weekly was not calibrated.

## Chart date and reference points

All seven files were saved at 13:57 Athens time on **24 September**. Each screenshot's own clock reads 10:39–10:43 UTC on 24 September. Five headers show the current, still-forming **September 24** daily candle: ETH, SOL, RAY, DOGE and LINK. Their header Close is the snapshot value used in the EMA calculations; the September 23 candle is the last fully completed candle in the downloaded histories.

The HYPE crosshair is on **4 December 2025**, and the ZEC crosshair is on **20 September 2025**. Their legend values and header OHLC refer to those selected historical bars, not to the current right-axis prices.

| Screenshot | Reference point | Printed 32 / 58 values | Calculated Close EMA32 / EMA58 | Feed and result |
|---|---|---:|---:|---|
| `image.png` — ETHUSDT | Sep 24, 2026 partial candle | 2,481.69 / 2,342.95 | 2,481.6876 / 2,342.9477 | Binance; rounds exactly |
| `image(1).png` — SOLUSD | Sep 24, 2026 partial candle | 103.15 / 96.63 | 103.1536 / 96.6356 | Coinbase USD proxy; within about one cent per line |
| `image(2).png` — RAYUSD | Sep 24, 2026 partial candle | 1.343 / 1.263 | 1.3483 / 1.1287 | Binance RAY/USDT proxy; slow differs by 0.1343 |
| `image(3).png` — DOGEUSD | Sep 24, 2026 partial candle | 0.08629 / 0.08374 | 0.0862919 / 0.0837369 | Coinbase; rounds exactly |
| `image(4).png` — HYPEUSD | Dec 4, 2025 crosshair | 36.420 / 38.591 | 36.4277 / 38.5980 | Hyperliquid USD proxy; about 0.02% per line |
| `image(5).png` — ZECUSD | Sep 20, 2025 crosshair | 46.21 / 44.26 | 46.2019 / 44.2598 | Binance ZEC/USDT proxy; within one cent |
| `image(6).png` — LINKUSDT | Sep 24, 2026 partial candle | 11.630 / 10.928 | 11.6299 / 10.9282 | Binance; rounds exactly |

For the five current charts, the model uses completed exchange candles through September 23 plus the screenshot's September 24 Close. The captured OHLC values were: ETH 2684.70/2704.08/2600.15/2640.75; SOL 114.99/116.08/112.55/113.12; RAY 1.977/2.163/1.972/1.992; DOGE 0.09271/0.09516/0.09138/0.09235; LINK 12.356/12.498/12.094/12.179. Later exchange queries show the same day's bars evolving, so their later Close values were not substituted for the screenshot snapshots.

## RAY exception

At the current RAY snapshot, both Binance RAY/USDT and Kraken RAY/USD histories put EMA58 near **1.129**. On those same inputs, EMA40 is **1.2626** and **1.2630**, close to the screenshot's 1.263. The fast EMA32 from Close is 1.348 on both feeds, near but not equal to the screenshot's 1.343. The earlier RAY screenshot from June 7, 2023 instead matched EMA32/58 much better than EMA32/40 on Binance history. That disagreement across dates and the `CRYPTO:RAYUSD` composite feed makes RAY inconclusive. It is not a reason to change the shared 58-period line.

## Calibration implications

- Shared daily visible boundaries stay at **Close EMA32 and EMA58**.
- Hidden EMA34/48 checks and the full-order gold/purple/grey rule stay provisional.
- The daily snapshot states are gold for ETH, SOL, RAY, DOGE and LINK. The selected historical HYPE bar is purple; the selected ZEC bar is gold. This is a broad visual check, not proof of exact inner EMA lengths.
- The cross-feed screenshots cannot establish venue-specific settings. The app uses Coinbase for SOL and DOGE, Kraken for HYPE and RAY, and Binance for ETH, ZEC and LINK; the images use composite feeds for SOL, RAY, HYPE and ZEC.
- Weekly remains uncalibrated.

## Reproducibility and limits

`download.py` archives screenshot copies, hashes and candle-source URLs in the ignored `data/kk-research-2026-09-24/references/` folder and `provenance.json`. It records completed candles through September 23. Binance supplies ETH/LINK and the RAY/ZEC proxy histories; Coinbase supplies SOL/DOGE; Hyperliquid supplies HYPE; Kraken is retained as a second RAY check. `analyze.py` uses historical crosshair dates for HYPE/ZEC and the screenshot's partial September 24 Close for the other five, checks continuous daily timestamps, and searches nearby lengths and OHLC sources. `results.json` contains the full calculations.

The screenshot's TradingView `CRYPTO` composite feeds are not published with a single reproducible candle history here. This is most material for RAY, where the two available USD/USDT feeds agree with each other but not with the screenshot's slow boundary. None of these checks claims to recover a private Larsson formula or establish trading performance.
