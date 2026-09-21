# September 21 weekly KK Supertrend calibration

Nine Downloads charts were inspected. Parameters were restricted to the established integer family (10/3, 10/2, 15/2; 15/3 also checked). Completed Monday-based histories end with the week starting September 14, 2026; the current September 21 week is excluded.

| Asset | ATR / multiplier | Image flip | Calculated reference | Difference | Decision |
| --- | --- | ---: | ---: | ---: | --- |
| BTC | 10/3 | 60739.59 | 60600.442302 | −0.22909% | Retain; composite USD vs Binance USDT |
| ETH | 10/2 | 2074.75 | 2074.748916 | −0.00005% | Retain; Bitfinex USD reference |
| SOL | 10/2 | 80.72 | 80.719172 | −0.00103% | Retain |
| BNB | 15/2 | 612.40 | 610.263859 | −0.34881% | Retain; USD vs USDT feed |
| ZEC | 15/2 | 954.01 | 954.007236 | −0.00029% | Retain |
| AVAX | 15/2 | 6.339 | 6.338534 | −0.00735% | New asset and weekly preset |
| SUI | 15/2 | 1.0413 | 1.041269 | −0.00293% | Retain |
| ADA | 15/2 | 0.254943 | 0.255452 | +0.19953% | Retain; limited Kraken warmup |
| MSTR | 15/2 | 90.66 | 93.717411 | +3.37239% | New asset; timing difference described below |

SUI and ADA are bearish; the other seven are bullish, matching every screenshot's confirmed regime. Existing assets need no parameter changes. New AVAX matches to the screenshot's displayed precision and reverses bullish on the September 14 signal candle, effective at the September 21 open. MSTR uses the shared 15/2 stock preset, consistent with the September 18 research.

## MSTR timing caveat

MSTR 15/2 gives 90.660437 through the September 7 week, matching both mstr5.png and mstr6.png to the cent. Adding the completed September 14 week gives 93.717411. Yahoo's last OHLC (130.90 / 154.02 / 123.33 / 153.92) matches mstr6.png. The screenshot continues to show the preceding week's indicator level despite displaying the newer candle. This suggests different indicator update/confirmation timing, but its exact mechanism is not established. Keep the documented completed-candle algorithm and next-session-open execution; do not change parameters or omit a completed week just to force 90.66. The app may therefore display 93.72.

## Sources and persistence

BTC and BNB are USDT proxies for USD screenshot feeds. ETH uses Bitfinex for this fixed reference, although the app's ETH venues differ. ADA uses the 102 available complete Kraken weeks; the app defaults to Coinbase, so its live level may differ. SOL, SUI and AVAX use Coinbase USD. ZEC uses Binance USDT. MSTR uses Yahoo split-adjusted NASDAQ daily data and the existing session calendar.

AVAX is added to crypto with Coinbase as its source; MSTR (Strategy / MicroStrategy) is added to stocks with Yahoo. AVAX starts September 30, 2021. MSTR stored history starts January 4, 1999, bounded by the application's session calendar; it is not an IPO-date claim. Initial seeds target only these two assets. AVAX joins the existing 00:35 UTC refresh group; MSTR joins the existing stock refresh automatically. Requests use existing pacing and incremental updates.

Daily KK presets for new assets remain uncalibrated 10/3. Standard SuperTrend and all other indicator formulas are unchanged. Regression checks cover all nine archived levels and states, non-repainting, MSTR's preceding-week match, new market routing, next-open execution, costs and rolling-window eligibility. MSTR supports four-year rolling tests; AVAX lacks a full four-year common research window after the longest indicator warmup. Fixtures, image hashes, and all four candidate results are archived for reproducibility.

The additional evidence supports the small preset family. It does not establish a market-cap classification or justify bespoke parameters to compensate for source or timing differences.
