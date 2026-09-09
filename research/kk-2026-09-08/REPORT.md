# KK Supertrend — 8 September screenshot batch

Audited 9 September 2026. Only KK Supertrend parameters change. Standard SuperTrend, all other indicator calculations, execution rules, market-data sources and confirmed-candle boundaries are unchanged.

## Outcome

Twenty images were inspected in `/home/kos/Downloads/KK coins`. Nineteen references were accepted: eighteen numerical matches and one approximate DOGE check. The SpaceX daily chart was ignored at the user's explicit request. Twelve **weekly** presets change from ATR 10 / multiplier 3 to **ATR 15 / multiplier 2**; all daily presets are unchanged.

The filenames below share `Image 8-9-26 at ` and ` PM.jpeg` (the actual files contain a narrow space before PM). LINK additionally has ` (1)` before `.jpeg`.

| Asset | Filename time | Reference market | Previous → current ATR/factor | Reference state | Screenshot flip | Calculated flip |
|---|---|---|---|---|---:|---:|
| TSLA | 7.17 | NASDAQ, Yahoo split-adjusted candles | **10/3 → 15/2** | Bearish | 383.88 | 383.88393 |
| NVDA | 7.21 | NASDAQ, Yahoo split-adjusted candles | **10/3 → 15/2** | Bullish | 191.61 | 191.60631 |
| GOOGL | 7.23 | NASDAQ, Yahoo split-adjusted candles | **10/3 → 15/2** | Bearish | 384.80 | 384.79814 |
| SPCX | 7.26 | NASDAQ daily | 10/3 unchanged | Ignored | — | Not calibrated |
| MU | 7.29 | NASDAQ, Yahoo split-adjusted candles | **10/3 → 15/2** | Bearish | 1,097.54 | 1,097.53690 |
| SNDK | 7.33 | NASDAQ, Yahoo split-adjusted candles | **10/3 → 15/2** | Bearish | 1,808.89 | 1,808.87736 |
| BTC | 7.36 | Bitstamp USD | 10/3 unchanged | Bullish | 60,653 | 60,653.43646 |
| ETH | 7.37 | Coinbase USD | 10/2 unchanged | Bullish | 1,988.79 | 1,988.79028 |
| OP | 7.57 | Binance USDT | **10/3 → 15/2** | Bearish | 0.1552 | 0.15515934 |
| JUP | 7.59 | Binance USDT | **10/3 → 15/2** | Bullish | 0.1476 | 0.14759370 |
| BONK | 8.02 | Binance USDT, unscaled token units | **10/3 → 15/2** | Bearish | 0.00000506 | 0.00000505550 |
| ADA | 8.04 | Binance USDT | **10/3 → 15/2** | Bearish | 0.2573 | 0.25730240 |
| DOT | 8.06 | Binance USDT | **10/3 → 15/2** | Bearish | 1.204 | 1.20449591 |
| ATOM | 8.08 | Binance USDT | **10/3 → 15/2** | Bearish | 1.888 | 1.88812733 |
| HYPE | 8.09 | KuCoin USDT, Monday-based weeks | **10/3 → 15/2** | Bullish | 64.551 | 64.55033 |
| SOL | 8.19 | Binance USDT | 10/2 unchanged | Bullish | 78.91 | 78.90516 |
| DOGE | 8.20 | Binance USDT | 15/2 unchanged | Bearish | approximately 0.097, user-confirmed | 0.09763383 |
| LINK | 8.23 (1) | Binance USDT | 15/2 unchanged | Bullish | 9.161 | 9.16073 |
| XMR | 8.24 | Kraken USD | 15/2 unchanged | Bullish | 399.65 | 399.64902 |
| SUI | 8.26 | Coinbase USD | 15/2 unchanged | Bearish | 1.0413 | 1.04126946 |

Values are in the stated denomination. The first eighteen numerical matches are within the displayed rounding precision or a very small history/initialization allowance (SNDK about $0.013, HYPE about $0.00067). DOGE is an approximate check with a deliberately wider 0.001 tolerance, not an exact match. No parameter was tuned to that approximate value.

## What the parameter changes mean

The recurrence remains `HL2 ± multiplier × Wilder ATR`, with trailing bands and completed-close reversals. ATR 10 → 15 gives volatility a longer memory: each new true range receives 1/15 rather than 1/10 of the smoothed estimate. This slows the response to volatility changes. It does **not** always raise or lower the trail: after a volatility spike, the longer ATR can remain higher even after shorter ATR has decayed.

Multiplier 3 → 2 reduces the raw band distance by one third **for the same ATR**. Together with the ATR-length change, the final line need not move by precisely one third. A smaller multiplier generally means closer bands and earlier/more frequent reversals, with greater susceptibility to sideways-market false flips. These are descriptive effects, not evidence of better returns.

This is the same 10/3 → 15/2 change previously used for XMR, DOGE, LINK and SUI. ETH and SOL previously changed only the multiplier (3 → 2), retaining ATR 10; their new screenshots independently support leaving 10/2 intact. BTC stays 10/3, now with an archived numerical reference rather than an unarchived legacy claim.

## Important findings beyond the latest number

1. **Completed-candle alignment is essential.** All accepted weekly targets align with completed candles through the week starting 31 August, ending 6 September for crypto and 4 September for stocks. Adding the screenshot's partial current-week candle often makes the comparison worse. For example, ETH 10/2 is 1,988.7903 on completed candles but about 2,039.15 when the screenshot's partial OHLC is included. LINK 15/2 is 9.1607 completed versus about 10.0289 partial. This is strong evidence of a confirmed-candle trail in these references; it does not establish every internal rule of the private indicator.
2. **Weekly boundaries matter.** KuCoin's returned native HYPE weekly timestamps were Thursdays. Directly fitting those bars incorrectly favored 10/2. One daily-data request, grouped into actual Monday–Sunday weeks, produces the 15/2 match at 64.5503. That aggregation is research-only; it does not change the app's providers.
3. **A changing flip level is not necessarily a recalibration.** XMR's older 350.93 reference and the new 399.65 reference both fit 15/2. ETH, SOL and LINK likewise retain their presets despite their trails rising. The older archived fixtures continue to pass.
4. **A matching venue is essential for decimal comparisons.** The app's new-coin sources remain Kraken/Coinbase USD. Binance/KuCoin USDT reference candles are archived separately, never spliced into D1 or the app's USD histories. At the same completed week, the app's selected-source 15/2 levels are approximately JUP 0.14967, OP 0.15439, BONK 0.000004979, ADA 0.25340, ATOM 1.86387, HYPE 64.86871 and DOT 1.18721. These source differences are not reasons to invent asset-specific fractional factors. HYPE's Kraken history has 31 weeks versus 91 in the KuCoin reference.
5. **SpaceX is excluded.** Its daily chart displayed a separate 3/5 confirmation state. ATR/factor fitting alone did not reproduce its displayed state. The user asked to ignore it; no confirmation rule was guessed and neither SPCX timeframe was calibrated.

## Can market cap explain the groups?

The simplest description supported by this batch is:

- BTC: 10/3.
- ETH and SOL: 10/2.
- The other eleven crypto assets: 15/2.
- The five accepted weekly stock charts: 15/2, including very large companies.

That is a useful **preset cluster**, but not a demonstrated large/mid/small-cap rule. A common crypto convention is large above $10B, mid $1B–$10B, small below $1B. CoinGecko describes these categories using circulating market cap, not fully diluted valuation. [CoinGecko market-cap guide](https://www.coingecko.com/learn/what-is-market-cap-in-crypto)

One batched CoinGecko request on 9 September at 08:20 UTC gave this research snapshot (not the exact screenshot-time caps):

| Convention | Assets and approximate circulating caps | Observed weekly presets |
|---|---|---|
| Large, >$10B | BTC $1.596T; ETH $307.1B; SOL $61.4B; HYPE $19.3B; DOGE $14.2B | **All three**: 10/3, 10/2, 15/2 |
| Mid, $1B–$10B | XMR $9.39B; LINK $9.35B; ADA $8.34B; SUI $3.38B; DOT $1.99B; ATOM $1.01B | 15/2 |
| Small, <$1B | JUP $829M; BONK $270M; OP $243M | 15/2 |

The full snapshot and timestamp are in `market-caps.json`; values came from the [CoinGecko markets API](https://docs.coingecko.com/reference/coins-markets). ATOM is near the $1B boundary and XMR/LINK are near $10B, illustrating why these labels are date-dependent.

For stocks, a common convention is large above $10B, mid $2B–$10B, small below $2B; these are conventions, not universal boundaries. [Fidelity market-cap explanation](https://www.fidelity.com/learning-center/trading-investing/market-cap) The 15/2 matches include Tesla (roughly $1.4T in Yahoo's cited early-September valuation snapshot), so 15/2 clearly is not limited to small companies. [Yahoo TSLA](https://finance.yahoo.com/quote/TSLA/)

If BTC is treated as a special case, a post-hoc threshold **anywhere between about $19.3B and $61.4B** separates this sample's 10/2 coins (ETH/SOL) from its 15/2 coins. A round $50B cutoff is therefore a **hypothesis worth testing**, not an inferred setting: many other cutoffs would fit equally well, only two assets support the upper group, and no evidence shows settings change when an asset crosses a cap boundary. The stock matches also prevent carrying such a rule across asset classes.

There is currently **no evidence for different mid-cap versus small-cap settings**: both groups fit 15/2. Nor can a threshold be deduced from price candles alone, because circulating supply/share counts are absent. We should retain explicit per-asset/timeframe presets and validate the hypothesis on new charts (particularly crypto assets between $20B and $60B, and genuine small/mid-cap stocks). ATR/price, venue and history length should be recorded alongside market cap to check alternative explanations. No automatic cap-based preset selection was added.

## Method and reproducibility

- Images were read directly, with timeframe, symbol, denomination, target, state and filename recorded in `charts.json`. DOGE's approximate value was confirmed by the user; SpaceX was ignored by request.
- Compared a deliberately small grid: ATR lengths 5, 7, 10, 14, 15, 20, 21, 30; multipliers 1, 1.5, 2, 2.5, 3. The same two-parameter recurrence was used for every chart. No arbitrary fractional-factor optimization, price offsets, formula changes, cap-dependent switches or profit optimization were used.
- `fixtures.json` contains the fixed, source-specific OHLCV histories used by the tests. Stock research uses 2023 onward (or listing onward); crypto histories use the available verified source history. No screenshot candle was inserted into production history. Full research fixtures are not sent in the browser bundle.
- `scripts/research-kk-batch.ts` is offline-first; `--download` opts into bounded sequential requests and saves a reusable local research copy. It never writes D1 or production presets. `scripts/archive-kk-batch.ts` exports fixed research fixtures and audit metadata. Its metadata is checked against the app's compact notebook evidence by regression tests.
- Tests check the accepted targets with stated tolerances, prior reference preservation, unchanged non-KK calculations, unchanged daily defaults, stock-specific overview routing, non-repainting prefixes, next-open execution, matched buy-and-hold dates, cost sensitivity and complete rolling windows where enough history exists. A screenshot fit does not validate a profitable strategy; insufficient-history windows remain unavailable.

The existing notebook remains closed by default. It now distinguishes archived matches, unchanged checks, uncalibrated daily settings and the ignored SpaceX reference.
