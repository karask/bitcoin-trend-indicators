# Weekly KK Supertrend class rule — 8 October 2026

Per-asset weekly calibration is replaced by one class rule. New assets receive it immediately; they do not need a weekly screenshot.

| Group | Weekly ATR / multiplier |
|---|---|
| BTC | 10 / 3 |
| Crypto with circulating market cap ≥ ~$50B (`largeCap: true` in `lib/markets.ts`: ETH, SOL, BNB) | 10 / 2 |
| Every other crypto, every stock, every commodity | 15 / 2 |

Daily KK is unchanged. No single daily rule fits the daily screenshots, so daily presets stay per-asset. Assets added without a daily screenshot use the unverified 10/3 baseline and are flagged as uncalibrated.

## Changes from the previous presets

| Asset | Weekly before → after | Evidence |
|---|---|---|
| BNB | 15/2 → 10/2 | Both 10/2 and 15/2 fit both BNB screenshots within 1%. BNB joins the large-cap group by market cap. |
| Gold | 10/2 → 15/2 | 15/2 is 0.00% from the OANDA spot screenshot on spot gold, and −0.10% from the COMEX screenshot on Yahoo futures. |
| STRC | 10/3 → 15/2 | No weekly screenshot; 15/2 is the stock rule. |
| BOT, SPCX | 10/3 → 15/2 | Unresolved fallbacks. These IPOs have only 15–20 completed weeks, too few to verify any setting. |
| Unidentified stock or commodity context | 10/3 → 15/2 | The rule is the default. |

## Method

- **Screenshots:** every archived weekly screenshot from the 8, 9, 17, 18, 21, 22 and 28 September reviews, the original SOL/ETH/XMR/DOGE/LINK/SUI references and the September 21 archive. Duplicate captures are counted once.
- **Price history:** each screenshot was scored on the price history archived with it, and on the latest full history from the default feed. For crypto, weeks are Monday–Sunday UTC. Stocks use XNAS trading weeks.
- **Settings tested:** 130 combinations of ATR length 5, 7, 10, 12, 14, 15, 20, 21, 25 or 30 with multipliers from 1 to 5.
- **Weekly reversal:** a plain close-confirmed reversal; the five-close confirmation applies only to daily.
- **Fit:** the screenshot state matches and the reversal level is within 1%.

## Crypto: 53 screenshots, 22 coins

- **15/2 alone** fits 40 of 53 screenshots and every screenshot of 19 coins. It still fits 75% of screenshots when each coin is held out of the selection.
- **The only misses are BTC, ETH and SOL.** BTC fits only 5–10/3. ETH fits 5–12/2. SOL fits only 10/2.
- **10/2 marks the large caps.** It fits every screenshot of ETH, SOL, BNB and NEAR. NEAR is uninformative: it fits nearly every setting. None of the mid or small caps that need 15/2 (HYPE, XMR, LINK, ATOM, ZEC, DOGE, SUI, JUP, BONK, OP and others) also fits 10/2.
- **The full rule fits 53 of 53 screenshots within 1%.**
- **Market cap separates the groups.** On CoinGecko's 9 September caps, SOL ($61B) is the smallest ATR-10 coin, while HYPE ($19B) and DOGE ($14B) use 15/2.
- **Exchange volume does not separate them.** ZEC has the highest median weekly dollar volume on its exchange but needs 15/2.
- **Volatility does not separate them.** Weekly ATR % overlaps between the groups.

The threshold rests on three coins, so it is approximate: somewhere between $20B and $60B.

## Stocks: 29 screenshots, 16 stocks

- **Exact fits:** 15/2 reproduces every screenshot of GOOGL, AMZN, NVDA, TSLA, MU, SNDK and CRCL within 0.08%.
- **INTC, MRVL and META:** 15/2 matches within 0.00–0.06% through the week before the screenshot. In the screenshot week, the chart shows a pending "Bullish 1/1" and keeps the old trail, while the model flips at once.
- **MSTR:** fits exactly on 7 September. The 14 September capture repeats the identical printed level, which looks like a stale legend.
- **Exceptions:** AMD (multiplier 2.75) and PLTR (2.5), each from a single screenshot. Neither shares a trait (volatility, size, sector) that separates it from the stocks that fit 15/2.
- **No better split:** splitting stocks by volatility, dollar volume or history length never beat 15/2 alone, either fitted on all stocks or held out.
- **No separate large-cap group:** NVDA, GOOGL and AMZN all use 15/2, so stocks have no equivalent of the crypto large-cap tier.

## Commodities: gold and silver, spot and futures feeds

| Screenshot | Feed | 15/2 error |
|---|---|---:|
| Gold, OANDA XAUUSD spot | Bitfinex XAUT (spot proxy) | +0.00% |
| Gold, OANDA XAUUSD spot | OKX XAU perpetual | −0.00% |
| Gold, GC1! back-adjusted futures | Yahoo GC=F (app) | −0.10% |
| Silver, SI1! back-adjusted futures | Dukascopy XAG/USD spot | −0.03% |
| Silver, SI1! back-adjusted futures | Yahoo SI=F (app) | −3.74% |

- **Silver's error comes from the feed.** The −3.7% difference carried since 9 September is not a parameter problem. Yahoo's continuous futures jump at each contract roll; back-adjusted and spot series do not.
- **Spot sources checked:**
  - Binance PAXG for gold;
  - OKX, Binance, Bybit and Hyperliquid perpetuals, which start in 2025–2026;
  - Stooq, which blocks automated downloads.
- **Commodity data source unchanged:** the lab still uses Yahoo futures. Switching it to spot is a separate decision.

`spot-weekly.json` holds the weekly spot fixtures used by `tests/kk-weekly-rule.test.ts`:

- gold: Bitfinex XAUT through the week of 7 September;
- silver: Dukascopy through the week of 14 September.

## Limitations

- **Not a recovered formula.** The rule reproduces screenshot levels; it is not the private formula.
- **Large-cap threshold.** It is set from three coins; the next large-cap weekly screenshot, such as XRP, would test it.
- **Short histories.** BOT, SPCX and BMNR have too little weekly history to verify any setting.
- **Pending flips.** The INTC/MRVL/META cases suggest the private indicator holds the old trail while a flip is pending. Daily KK lets its trail keep moving during the five-close confirmation, which may explain part of the daily misfits. That hypothesis is not yet tested.
