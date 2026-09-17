# September 17 weekly KK Supertrend references

Six supplied screenshots were checked using completed Monday-based weeks through September 7, 2026. The unfinished September 14 week is excluded. Image SHA-256 hashes, source histories and all four shared-preset comparisons are archived in results.json and fixtures.json. The research script replays the analysis without further downloads when fixtures exist.

| Coin | Decision (ATR / multiplier) | Screenshot | Calculated reference | Difference |
| --- | --- | ---: | ---: | ---: |
| BTC | Keep 10/3 | 60739.59 | 60600.442302 | −0.22909% |
| BNB | New 15/2 | 605.67 | 602.813063 | −0.47170% |
| ZEC | New 15/2 | 863.79 | 863.788110 | −0.00022% |
| DOT | Keep 15/2 | 1.1893 | 1.190606 | +0.10981% |
| LINK | Keep 15/2 | 9.346 | 9.346163 | +0.00174% |
| HYPE | Keep 15/2 | 64.551 | 64.550329 | −0.00104% |

Every selected preset reproduces the screenshot regime: DOT bearish, all others bullish. Existing presets need no changes. BNB and ZEC join the existing 15/2 family; their daily settings use the uncalibrated 10/3 baseline. Other indicators retain their formulas and settings.

BTC uses Binance USDT as a proxy for TradingView's composite CRYPTO USD feed. BNB also uses USDT rather than the screenshot's Binance USD feed. These differences are not exact same-feed replications. DOT uses 102 available Kraken weeks; its warmup does not validate the older December 2024 reversal. LINK uses only Coinbase daily history, with a recent provider tail; HYPE uses KuCoin daily history aggregated into Monday weeks. The app's DOT default is Coinbase and HYPE default is Kraken, so their live values can differ from these reference calculations.

The calculated signal weeks for BTC (August 31), BNB/ZEC/LINK (August 17), and HYPE (March 16) precede screenshot Last Flip dates by one week. This agrees with an effective-next-week timestamp convention, but does not prove the private indicator's date semantics. Production next-open execution is unchanged.

The result strengthens the small shared preset family. It does not establish market-cap boundaries: no dated market-cap classification was performed, and BNB's 15/2 fit itself cautions against interpreting 15/2 as exclusively small-cap.

BNB and ZEC are added as selectable Binance USDT markets. Initial daily history is fetched sequentially through the existing paced provider client, with incremental updates and browser caching thereafter. Each is assigned to a different existing refresh cron. No broad reseed of existing assets is needed.
