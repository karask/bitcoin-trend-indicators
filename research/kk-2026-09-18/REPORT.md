# September 18 weekly KK Supertrend review

The seven new Downloads images were inspected directly. Comparisons use the established integer family (10/3, 10/2, 15/2, with 15/3 as a check), Monday-based completed weeks through September 7, 2026. September 14's partial week is excluded. All candidates, exact values, image hashes and source notes are in results.json; individual asset JSON files retain the source candles.

| Asset | Selected / retained preset | Image flip | Reference calculation | Error | Confirmed state |
| --- | --- | ---: | ---: | ---: | --- |
| BTC | Retain 10/3 | 60600.44 | 60600.442302 | +0.000004% | Bullish |
| SOL | Retain 10/2 | 79.59 | 79.585191 | −0.006042% | Bullish |
| LTC | Recommended 15/2 | 56.246 | 56.245887 | −0.000202% | Bearish |
| NEAR | Recommended 15/2 | 1.7031 | 1.703001 | −0.005830% | Bullish |
| MSTR | Recommended 15/2 | 90.66 | 90.660437 | +0.000482% | Bullish |
| META | Recommended 15/2, approximate | 670.63 | 671.012103 | +0.056977% | Bearish |
| Gold | Retain futures 10/2; spot not calibrated | 4076.188 spot | 4129.652725 futures | +1.311635% | Bullish |

## Decisions and interpretation

- No existing production preset needs changing. BTC 10/3 and SOL 10/2 match their latest screenshot rounding. BTC's Binance screenshot matches yesterday's Binance calculation, supporting the explanation that yesterday's composite USD difference was feed-related.
- LTC, NEAR, MSTR and META are not currently selectable app assets. Their 15/2 settings are research recommendations recorded here, not deployed asset additions. The request was to report the calibration findings.
- LTC's 10/2 alternative would incorrectly make the confirmed trend bullish. MSTR 10/3 would incorrectly make it bearish. This is why direction and reversal timing matter alongside numerical proximity.
- META explicitly shows Trend BEARISH, Weekly BEARISH and Confirm Bullish 1/1. The completed-week 15/2 result is also bearish. Its private confirmation mechanism is not implemented or inferred from this image. The 0.3821 difference may reflect feed/adjustment differences; the cause is not established.
- gold5.png is OANDA XAUUSD spot, unlike the app's Yahoo GC=F futures. The futures 15/2 candidate gives 4119.566798 (1.0642% above spot), but that small numerical improvement does not justify changing the existing futures 10/2 preset. A matched spot history or another futures screenshot is needed for a direct calibration.
- Most screenshot Last Flip dates are consistent with the next week's executable open rather than the signal candle's Monday label. MSTR's August 31 signal becomes executable September 8 after Labor Day. No timestamp/execution rule was changed.

The expanding sample supports a small shared preset family: BTC 10/3; SOL/ETH 10/2; many other cryptos and stocks 15/2. It still does not identify large/mid/small-cap thresholds. META fitting 15/2, like smaller assets, cautions against a simple market-cap-only rule. No dated market-cap analysis was performed.

## Provenance and checks

BTC reuses the archived September 17 Binance weekly history since the last completed week is unchanged. SOL uses its stored Coinbase daily history plus a fresh same-venue tail. LTC and NEAR use paced Coinbase daily requests from 2022, aggregated into full Monday weeks. MSTR and META use Yahoo split-adjusted daily OHLC from 2015 with the existing XNAS session calendar. Gold uses the existing Yahoo futures normalizer and commodity week aggregation from the app's supported 2019 start. No production data, presets, other indicators or deployment were changed.

Validation checks numerical replay, same-regime results, Monday timestamps, completed-week cutoff, candle quality, stable earlier signal prefixes, and the selected parameters' membership in the existing family. Raw figures are kept so rounding is not mistaken for exact agreement. This is screenshot replication, not an optimization of backtest returns.
