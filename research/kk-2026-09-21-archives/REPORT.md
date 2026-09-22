# September 21 archives: weekly and daily KK Supertrend

Only KK Supertrend was investigated. All assets in these archives already exist in the app; the archives contain 16 cryptos, seven stocks, and Gold/Silver futures. AVAX and MSTR are not pictured in these archives. No new assets are required.

25 weekly charts and 25 daily charts were visually read. All screenshots show ordinary candles, not Heikin-Ashi. Weekly BTC is skipped because its current flip is clipped and its legend is showing a historical cursor value. Weekly SpaceX is skipped because no indicator line/value is shown. The remaining 48 values are readable from the right-edge label or unambiguous current-value legend.

The crypto daily cutoff is September 20 inclusive, stocks/futures September 18 inclusive. September 21 was still in progress when the screenshots were captured (countdowns visible); it is excluded. Weekly comparisons use the completed week starting September 14. Do not insert a screenshot's live candle into a completed-bar backtest.

## Decisions

- **Weekly: retain all existing settings.** The 23 scored charts reproduce the screenshot regimes. Most level differences are small; Bitmine and Silver retain explicitly approximate fits. Gold's existing 10/2 is already within 0.15%, so switching it to 15/2 for a 0.04-percentage-point improvement is not justified.
- **Daily: reviewed, not reliably calibrated as a group.** The existing four shared presets do not reproduce several readable charts. Pending SUI/OP/Bonk/NVDA/Micron labels reveal a separate five-stage confirmation mechanism; the current implementation has only ATR length and multiplier with immediate completed-close reversal. Even a simple offline five-consecutive-close hypothesis does not recover the chart set. No unverified algorithm is installed.
- No parameter changes are applied by this report. Closest-preset columns below are research comparisons, not claims of equivalence or recommendations to retune each asset.
- Standard SuperTrend, all other indicators, execution timing, and production data remain unchanged.

## Weekly results

ATR/multiplier; percentage differences are signed, calculated minus screenshot.

| Asset | Preset retained | Image flip | Calculated | Difference | State |
|---|---|---:|---:|---:|---|
| BTC | 10/3 | — | Skipped | — | Not scored |
| ETH | 10/2 | 2053.01 | 2053.01 | 0.000% | bull |
| SOL | 10/2 | 80.72 | 80.72 | -0.001% | bull |
| DOGE | 15/2 | 0.097900 | 0.097636 | -0.270% | bear |
| LINK | 15/2 | 9.346000 | 9.346163 | 0.002% | bull |
| XMR | 15/2 | 416.30 | 416.30 | -0.000% | bull |
| SUI | 15/2 | 1.041300 | 1.041269 | -0.003% | bear |
| JUP | 15/2 | 0.153380 | 0.153374 | -0.004% | bull |
| OP | 15/2 | 0.150700 | 0.150753 | 0.035% | bear |
| BONK | 15/2 | 0.00000513 | 0.00000514 | 0.175% | bear |
| ADA | 15/2 | 0.254943 | 0.255452 | 0.200% | bear |
| ATOM | 15/2 | 1.860200 | 1.861610 | 0.076% | bear |
| HYPE | 15/2 | 65.03 | 65.06 | 0.049% | bull |
| DOT | 15/2 | 1.187200 | 1.187207 | 0.001% | bear |
| BNB | 15/2 | 612.40 | 610.26 | -0.349% | bull |
| ZEC | 15/2 | 945.98 | 945.98 | 0.000% | bull |
| TSLA | 15/2 | 383.88 | 383.88 | 0.001% | bear |
| GOOGL | 15/2 | 380.37 | 380.37 | 0.000% | bear |
| NVDA | 15/2 | 192.15 | 192.15 | 0.001% | bull |
| SPCX | 10/3 | — | Skipped | — | Not scored |
| MU | 15/2 | 1097.54 | 1097.54 | -0.000% | bear |
| SNDK | 15/2 | 1808.89 | 1808.89 | -0.000% | bear |
| BMNR | 15/2 | 17.57 | 16.97 | -3.407% | bull |
| GOLD | 10/2 | 4123.70 | 4129.65 | 0.144% | bull |
| SILVER | 15/2 | 75.73 | 72.90 | -3.739% | bear |

## Daily results — current versus closest shared preset

**None of these closest alternatives has been applied.** State agreement is required when ranking. A pending bullish chart is treated as still bearish for this comparison, but the application cannot reproduce its confirmation counter. A close current value is not sufficient to validate the full historical path.

| Asset | Image flip | Current preset | Current flip / state | Current error | Closest same-state preset | Closest flip / error |
|---|---:|---|---|---:|---|---|
| BTC | 76922.00 | 10/3 | 74552.81 / bull | -3.08% | 15/2 | 76868.64 / -0.07% |
| ETH | 2275.90 | 10/2 | 2425.97 / bull | 6.59% | 10/3 | 2321.39 / 2.00% |
| SOL | 101.04 | 10/2 | 101.45 / bull | 0.40% | 10/2 | 101.45 / 0.40% |
| DOGE | 0.065730 | 10/3 | 0.075293 / bull | 14.55% | 10/3 | 0.075293 / 14.55% |
| LINK | 10.75 | 10/3 | 12.85 / bear | 19.53% | 10/2 | 11.11 / 3.35% |
| XMR | 450.51 | 10/3 | 448.96 / bull | -0.34% | 10/3 | 448.96 / -0.34% |
| SUI (pending 4/5) | 0.788500 | 10/3 | 0.687955 / bull | -12.75% | None | No matching regime |
| JUP | 0.235130 | 10/3 | 0.228122 / bull | -2.98% | 15/3 | 0.232909 / -0.94% |
| OP (pending 4/5) | 0.104231 | 10/3 | 0.096867 / bull | -7.07% | None | No matching regime |
| BONK (pending 1/5) | 0.00000322 | 10/3 | 0.00000327 / bear | 1.48% | 10/3 | 0.00000327 / 1.48% |
| ADA | 0.166640 | 10/3 | 0.187055 / bull | 12.25% | 10/3 | 0.187055 / 12.25% |
| ATOM | 1.455900 | 10/3 | 1.800726 / bear | 23.68% | 10/2 | 1.513738 / 3.97% |
| HYPE | 71.48 | 10/3 | 77.59 / bull | 8.55% | 10/3 | 77.59 / 8.55% |
| DOT | 0.797600 | 10/3 | 0.925665 / bull | 16.06% | 10/3 | 0.925665 / 16.06% |
| BNB | 677.44 | 10/3 | 694.54 / bull | 2.52% | 10/3 | 694.54 / 2.52% |
| ZEC | 1206.85 | 10/3 | 1116.25 / bull | -7.51% | 15/3 | 1163.00 / -3.63% |
| TSLA | 290.35 | 10/3 | 330.76 / bull | 13.92% | 10/3 | 330.76 / 13.92% |
| GOOGL | 370.44 | 10/3 | 353.03 / bear | -4.70% | 15/3 | 354.72 / -4.24% |
| NVDA (pending 1/5) | 225.58 | 10/3 | 209.78 / bull | -7.00% | 15/2 | 224.95 / -0.28% |
| SPCX | 115.88 | 10/3 | 133.10 / bull | 14.86% | 15/3 | 131.62 / 13.58% |
| MU (pending 2/5) | 987.92 | 10/3 | 1044.51 / bear | 5.73% | 15/3 | 1043.13 / 5.59% |
| SNDK | 1205.80 | 10/3 | 1430.10 / bull | 18.60% | 15/3 | 1393.45 / 15.56% |
| BMNR | 21.51 | 10/3 | 21.66 / bull | 0.68% | 10/3 | 21.66 / 0.68% |
| GOLD | 4316.70 | 10/3 | 4655.09 / bear | 7.84% | None | No matching regime |
| SILVER | 71.29 | 10/3 | 68.77 / bear | -3.53% | 15/3 | 68.83 / -3.45% |

## Interpretation and next step

Weekly evidence continues to support BTC 10/3 (not rescored here), ETH/SOL 10/2, other pictured cryptos and calibrated stocks 15/2, Gold 10/2 and Silver 15/2. This is not proof of a market-cap rule: stocks and cryptos share presets, and the sample is selected rather than representative.

Daily BTC, for example, gets closer under 15/2 (76,868.64 versus 76,922) than 10/3 (74,552.81), but other daily charts cannot be explained by that preset. Arbitrarily selecting a different pair per coin would undermine the shared-pattern objective. The daily set needs the confirmation and trailing-level behavior specified or independently validated across several historical reversals before it can be called calibrated. Useful evidence would include the indicator settings screen or consecutive daily screenshots showing a 1/5 → 5/5 transition, including what happens when a close returns across the threshold.

Data-source differences: ETH weekly uses Coinbase, daily uses Bitstamp; XMR weekly Bitfinex, daily Kraken; DOGE weekly Binance USD proxy, daily Coinbase; JUP weekly Kraken, daily Bitstamp; BONK weekly Bitstamp, daily Coinbase; ADA weekly Kraken, daily Coinbase. HYPE and ZEC charts use Coinbase even though app defaults differ. Kraken's REST history is limited; short Bitstamp listings and sparse JUP daily bars constrain reproducibility. Yahoo stock OHLC is split-adjusted. Yahoo futures are continuous series and are not guaranteed to have TradingView's contract-roll treatment.

The archive script uses paced public requests and reuses one daily fixture per asset/source across both timeframes. No database seeds, refresh jobs or production writes are made. Fixtures are research-only. Backtest regression checks verify next-open execution, annualization, cost sensitivity and rolling-window availability; screenshot-fit data is not independent out-of-sample evidence.

## Image inventory and qualifications

- Weekly BTC: **Image 21-9-26 at 9.24 AM.jpeg**, bitstamp. Skipped: current flip clipped; legend is historical under cursor. User permits skipping uncertain charts.
- Weekly ETH: **Image 21-9-26 at 9.27 AM.jpeg**, coinbase. Existing preset retained.
- Weekly SOL: **Image 21-9-26 at 9.30 AM.jpeg**, coinbase. Existing preset retained.
- Weekly DOGE: **Image 21-9-26 at 9.32 AM.jpeg**, binance. USDT history is a proxy for the chart's USD feed.
- Weekly LINK: **Image 21-9-26 at 9.34 AM.jpeg**, coinbase. Existing preset retained.
- Weekly XMR: **Image 21-9-26 at 9.36 AM.jpeg**, bitfinex. Existing preset retained.
- Weekly SUI: **Image 21-9-26 at 9.38 AM.jpeg**, coinbase. Existing preset retained.
- Weekly JUP: **Image 21-9-26 at 9.39 AM.jpeg**, kraken. Venue/history-length differences remain; do not transplant this number to another feed.
- Weekly OP: **Image 21-9-26 at 9.41 AM.jpeg**, bitstamp. Venue/history-length differences remain; do not transplant this number to another feed.
- Weekly BONK: **Image 21-9-26 at 9.43 AM.jpeg**, bitstamp. Venue/history-length differences remain; do not transplant this number to another feed.
- Weekly ADA: **Image 21-9-26 at 9.45 AM.jpeg**, kraken. Venue/history-length differences remain; do not transplant this number to another feed.
- Weekly ATOM: **Image 21-9-26 at 9.46 AM.jpeg**, kraken. Venue/history-length differences remain; do not transplant this number to another feed.
- Weekly HYPE: **Image 21-9-26 at 9.48 AM.jpeg**, coinbase. Existing preset retained.
- Weekly DOT: **Image 21-9-26 at 9.51 AM.jpeg**, coinbase. Existing preset retained.
- Weekly BNB: **Image 21-9-26 at 9.52 AM.jpeg**, binance. USDT history is a proxy for the chart's USD feed.
- Weekly ZEC: **Image 21-9-26 at 9.53 AM.jpeg**, coinbase. Existing preset retained.
- Weekly TSLA: **Image 21-9-26 at 9.56 AM.jpeg**, yahoo. Existing preset retained.
- Weekly GOOGL: **Image 21-9-26 at 9.57 AM.jpeg**, yahoo. Existing preset retained.
- Weekly NVDA: **Image 21-9-26 at 9.59 AM.jpeg**, yahoo. Existing preset retained.
- Weekly SPCX: **Image 21-9-26 at 10.00 AM.jpeg**, yahoo. Skipped: no weekly indicator level is displayed.
- Weekly MU: **Image 21-9-26 at 10.02 AM.jpeg**, yahoo. Existing preset retained.
- Weekly SNDK: **Image 21-9-26 at 10.04 AM.jpeg**, yahoo. Existing preset retained.
- Weekly BMNR: **Image 21-9-26 at 10.06 AM.jpeg**, yahoo. Approximate fit; Yahoo has much shorter history than the screenshot.
- Weekly GOLD: **Image 21-9-26 at 10.08 AM.jpeg**, yahoo. Existing preset retained.
- Weekly SILVER: **Image 21-9-26 at 10.09 AM.jpeg**, yahoo. Approximate continuous-futures fit; contract/roll differences remain.
- Daily BTC: **Image 21-9-26 at 9.48 PM.jpeg**, bitstamp. Current and closest presets are comparisons, not accepted daily calibrations. A single level cannot establish the different trailing/confirmation rules.
- Daily ETH: **Image 21-9-26 at 9.50 PM.jpeg**, bitstamp. Current and closest presets are comparisons, not accepted daily calibrations. A single level cannot establish the different trailing/confirmation rules.
- Daily SOL: **Image 21-9-26 at 9.53 PM.jpeg**, coinbase. Current and closest presets are comparisons, not accepted daily calibrations. A single level cannot establish the different trailing/confirmation rules.
- Daily DOGE: **Image 21-9-26 at 9.56 PM.jpeg**, coinbase. Current and closest presets are comparisons, not accepted daily calibrations. A single level cannot establish the different trailing/confirmation rules.
- Daily LINK: **Image 21-9-26 at 9.57 PM.jpeg**, coinbase. Current and closest presets are comparisons, not accepted daily calibrations. A single level cannot establish the different trailing/confirmation rules.
- Daily XMR: **Image 21-9-26 at 9.59 PM.jpeg**, kraken. Current and closest presets are comparisons, not accepted daily calibrations. A single level cannot establish the different trailing/confirmation rules.
- Daily SUI: **Image 21-9-26 at 10.01 PM.jpeg**, coinbase. Bullish 4/5 is pending, not a confirmed bullish regime. Current implementation has no five-bar confirmation counter.
- Daily JUP: **Image 21-9-26 at 10.06 PM.jpeg**, bitstamp. Current and closest presets are comparisons, not accepted daily calibrations. A single level cannot establish the different trailing/confirmation rules.
- Daily OP: **Image 21-9-26 at 10.08 PM.jpeg**, bitstamp. Bullish 4/5 is pending, not a confirmed bullish regime. Current implementation has no five-bar confirmation counter.
- Daily BONK: **Image 21-9-26 at 10.12 PM.jpeg**, coinbase. Bullish 1/5 is pending, not a confirmed bullish regime. Current implementation has no five-bar confirmation counter.
- Daily ADA: **Image 21-9-26 at 10.14 PM.jpeg**, coinbase. Current and closest presets are comparisons, not accepted daily calibrations. A single level cannot establish the different trailing/confirmation rules.
- Daily ATOM: **Image 21-9-26 at 10.15 PM.jpeg**, kraken. Current and closest presets are comparisons, not accepted daily calibrations. A single level cannot establish the different trailing/confirmation rules.
- Daily HYPE: **Image 21-9-26 at 10.17 PM.jpeg**, coinbase. Current and closest presets are comparisons, not accepted daily calibrations. A single level cannot establish the different trailing/confirmation rules.
- Daily DOT: **Image 21-9-26 at 10.19 PM.jpeg**, coinbase. Current and closest presets are comparisons, not accepted daily calibrations. A single level cannot establish the different trailing/confirmation rules.
- Daily BNB: **Image 21-9-26 at 10.21 PM.jpeg**, binance. Current and closest presets are comparisons, not accepted daily calibrations. A single level cannot establish the different trailing/confirmation rules.
- Daily ZEC: **Image 21-9-26 at 10.23 PM.jpeg**, coinbase. Current and closest presets are comparisons, not accepted daily calibrations. A single level cannot establish the different trailing/confirmation rules.
- Daily TSLA: **Image 21-9-26 at 10.25 PM.jpeg**, yahoo. Current and closest presets are comparisons, not accepted daily calibrations. A single level cannot establish the different trailing/confirmation rules.
- Daily GOOGL: **Image 21-9-26 at 10.27 PM.jpeg**, yahoo. Current and closest presets are comparisons, not accepted daily calibrations. A single level cannot establish the different trailing/confirmation rules.
- Daily NVDA: **Image 21-9-26 at 10.28 PM.jpeg**, yahoo. Bullish 1/5 is pending, not a confirmed bullish regime. Current implementation has no five-bar confirmation counter.
- Daily SPCX: **Image 21-9-26 at 10.30 PM.jpeg**, yahoo. Current and closest presets are comparisons, not accepted daily calibrations. A single level cannot establish the different trailing/confirmation rules.
- Daily MU: **Image 21-9-26 at 10.31 PM.jpeg**, yahoo. Bullish 2/5 is pending, not a confirmed bullish regime. Current implementation has no five-bar confirmation counter.
- Daily SNDK: **Image 21-9-26 at 10.33 PM.jpeg**, yahoo. Current and closest presets are comparisons, not accepted daily calibrations. A single level cannot establish the different trailing/confirmation rules.
- Daily BMNR: **Image 21-9-26 at 10.34 PM.jpeg**, yahoo. Current and closest presets are comparisons, not accepted daily calibrations. A single level cannot establish the different trailing/confirmation rules.
- Daily GOLD: **Image 21-9-26 at 10.35 PM.jpeg**, yahoo. Current and closest presets are comparisons, not accepted daily calibrations. A single level cannot establish the different trailing/confirmation rules.
- Daily SILVER: **Image 21-9-26 at 10.37 PM.jpeg**, yahoo. Current and closest presets are comparisons, not accepted daily calibrations. A single level cannot establish the different trailing/confirmation rules.
