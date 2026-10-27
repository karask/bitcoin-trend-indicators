# Daily KK Supertrend — 27 October 2026 batch

Reviewed **27 October 2026**, from the two `TradingView-MoneyLine-39-…-2026-10-27` folders in Downloads. All 78 screenshots are readable; no asset additions or user clarification were needed. There are 20 crypto, 17 stocks and 2 COMEX continuous futures in each folder. Gold and silver are GC1!/SI1!, not spot.

**No production parameters, indicator algorithms, data-source defaults, application database or other indicators were changed.** This calibration review does not claim to have recovered the private MoneyLine formula. Existing unrelated overview and earlier research edits were preserved. No commit, push or deployment was requested or performed.

## Correct cutoff

Daily captures were **26 October 23:05–23:10 UTC**, which was already 27 October in Athens. Crypto uses completed candles through **25 October**; the 26 October candle was forming. US stocks use the completed **26 October** regular session. COMEX's 26 October session had closed and its new 27 October session was forming. Futures research therefore scores the closed 26 October bar, with the application's more conservative 00:00 UTC policy (through 23 October at capture) reported separately. No 27 October candle enters official signals or backtests.

## Result

- Correct latest official state: **36/39**. Wrong states remain BONK, TSLA, BOT.
- Latest state and trail within 1%: **23/39** (previous batch 22/39).
- Every archived state and trail within 1%: **19/39**, across the nine October batches (3, 5, 9, 12, 16, 19, 22, 24, 27). LINK, gold and silver each have eight available scored references, starting 5 October; missing 3 October readings are not invented. Gold now falls outside tolerance; the previous review had 20/39.
- Only **10/39** current settings also match every scored pending count and last-flip date convention. A close line is not necessarily a fully recovered configuration.
- No chart changed official daily regime or last-flip date since the 24 October batch. Seven active trails moved; the other 32 are unchanged.

## Chart changes since 24 October

| Asset | Previous chart | New chart | Current app replay | Error |
|---|---:|---:|---:|---:|
| LINK | 15.073 | 14.183 | 14.2627 | +0.56% |
| SUI | 1.2754 | 1.1594 | 1.0526 | -9.21% |
| AVAX | 11.3733 | 11.0109 | 10.5201 | -4.46% |
| GOOGL | 370.44 | 360.66 | 360.8342 | +0.05% |
| META | 757.7 | 740.56 | 686.7606 | -7.26% |
| GOLD | 4454.4 | 4369.3 | 4437.5617 | +1.56% |
| SILVER | 66.09 | 63.775 | 66.511 | +4.29% |

## Five-close confirmations

The rule remains five consecutive **completed** closes, in both directions, resetting when a close returns to the original side. Open crypto quotes are used only to reproduce the chart's provisional counter. Stock Monday closes are counted once; after-hours quotes do not create another daily candle.

| Asset | Screenshot bearish count | App as captured | App completed closes |
|---|---:|---:|---:|
| BTC | 3/5 | 5/5 | 4/5 |
| ETH | 3/5 | 3/5 | 2/5 |
| SOL | 1/5 | 2/5 | 1/5 |
| DOGE | 5/5 | 5/5 | 4/5 |
| JUP | 2/5 | 3/5 | 2/5 |
| OP | 4/5 | 4/5 | 3/5 |
| RAY | 1/5 | 2/5 | 1/5 |
| BMNR | 1/5 | 1/5 | 1/5 |
| AMD | 3/5 | 3/5 | 3/5 |

**5/9 printed pending counts match.** BTC, SOL, JUP, RAY do not. ADA shows no pending counter on the chart, but the app's higher trail produces a provisional bearish 5/5. TSLA also has an app bullish pending close while its official app state is incorrectly bearish. These discrepancies were not hidden by the level-only success statistic.

**DOGE's screenshot says Bearish 5/5 while Trend is still BULLISH.** There are four completed bearish closes plus the still-open 26 October candle. It must not be declared officially bearish before that candle closes. BTC's screenshot is only 3/5, whereas the app counts 5/5 provisionally because its trail is higher; this is a real calibration discrepancy, not a reason to include the open candle in signals.

## Search and calibration decision

The existing parameters were replayed against each batch's own archived history, using only that batch's completed candles. A coarse grid tested 26 sampled ATR lengths from 5–200 and multipliers 1.5–8 in 0.5 steps, separately for each asset. Cases needing review received a bounded diagnostic grid of 44 sampled lengths and multipliers 1.5–9 in 0.1 steps. Every retained candidate was rechecked through the production calculation engine. This is not an exhaustive search of all integer lengths or a proof that no other formula can fit.

- **Keep the approved presets.** Replacing them with isolated single-chart fits would increase parameter proliferation and can break earlier observations. Level-only fits with wrong dates or counters are not adopted.
- **XMR 30/4:** new trail 493.4332 versus 493.18 (+0.05%). The earlier diagnostic 27/3.9 still fits all nine levels, counters and accepted flip-date alignment (worst 0.66%), but it would add another arbitrary decimal exception. It remains a hypothesis, not a production change.
- **GOOGL 15/5:** the new level is nearly exact (360.8342 vs 360.66), but earlier history and the June flip date remain mismatched. This is evidence against refitting to only the newest screenshot.
- **LINK and AVAX:** the active bearish trails are converging towards the chart, but a parameter fit must also reproduce their earlier bullish trails and transitions. No tested setting keeps all dated state/level observations within 1%.
- **SUI, QNT, META and ZEC:** mismatches across the reversal remain. Correct five-close timing alone does not identify how the private indicator initializes and ratchets its new opposite trail. Do not invent a new confirmation rule.
- **Silver:** Yahoo revised 23 October from a full-range bar (53.075–54.795, volume 57,273) to a near-expiry flat bar at 53.711 (volume 15); 26 October is also flat at 54.108 with volume 15. The entire archived period was refetched and calendar-validated rather than spliced across the revision. TradingView SI1! is a different continuous-futures construction; parameter-fitting this contract mismatch is not justified. The previously considered 110/5 and 115/5.3 no longer fit every batch within 1%.
- **No stable daily cap-tier formula is established.** Crypto, stocks and commodities remain separate research groups; weekly's compact family should not be imposed on daily. Repeated post-flip discrepancies across both crypto and equities point to missing algorithm/settings information, not a defensible new small/mid/large-cap boundary.

Best additional evidence: MoneyLine's Inputs/settings and version, especially separate bull/bear factors, ATR smoothing, initial seed, and trail-reset/confirmation options, on LINK, SUI, QNT or META.

## Futures availability diagnostic

These are distinct data-cutoff comparisons, not competing calibrations:

| Asset | Screenshot | Closed 26 Oct replay | Error | Strict app cutoff | Strict app trail | Error |
|---|---:|---:|---:|---|---:|---:|
| GOLD | 4369.3 | 4437.5617 | +1.56% | 2026-10-23 | 4444.4069 | +1.72% |
| SILVER | 63.775 | 66.511 | +4.29% | 2026-10-23 | 66.511 | +4.29% |

## All 39 approved presets

| Asset | ATR/factor | Chart state | App state | Chart trail | App trail | Error | Worst all batches |
|---|---|---|---|---:|---:|---:|---:|
| BTC | 15/2 | bull | bull | 80859.48 | 81620.1575 | +0.94% | 0.94% |
| ETH | 15/4 | bull | bull | 2369.63 | 2381.4909 | +0.50% | 1.00% |
| SOL | 15/4 | bull | bull | 101.15 | 101.8394 | +0.68% | 0.68% |
| DOGE | 15/4 | bull | bull | 0.079837 | 0.0798127 | -0.03% | 0.03% |
| LINK | 60/4.5 | bear | bear | 14.183 | 14.2627 | +0.56% | 9.61% |
| XMR | 30/4 | bull | bull | 493.18 | 493.4332 | +0.05% | 1.13% |
| SUI | 10/2 | bear | bear | 1.1594 | 1.0526 | -9.21% | 19.40% |
| JUP | 15/2.5 | bull | bull | 0.2872 | 0.2944299 | +2.52% | 2.52% |
| OP | 50/3.5 | bull | bull | 0.1158 | 0.1153954 | -0.35% | 0.35% |
| BONK | 15/2.5 | bull | bear | 0.0000024636000 | 0.0000035315539 | +43.35% | wrong state |
| ADA | 15/3.5 | bull | bull | 0.20319 | 0.2178385 | +7.21% | 7.21% |
| ATOM | 5/3.5 | bull | bull | 1.4673 | 1.4558 | -0.78% | 0.78% |
| HYPE | 15/4 | bull | bull | 75.9 | 75.6479 | -0.33% | 0.33% |
| DOT | 50/4.5 | bull | bull | 0.955 | 0.9553752 | +0.04% | 0.04% |
| BNB | 100/4 | bull | bull | 704.06 | 707.7059 | +0.52% | 0.52% |
| ZEC | 40/4 | bear | bear | 1592.95 | 1512.9572 | -5.02% | 5.02% |
| AVAX | 100/3 | bear | bear | 11.0109 | 10.5201 | -4.46% | 10.90% |
| RAY | 15/2.5 | bull | bull | 1.8143 | 1.8303 | +0.88% | 4.69% |
| VVV | 20/3.5 | bull | bull | 22.464 | 22.6582 | +0.86% | 0.86% |
| QNT | 27/3 | bear | bear | 235.6 | 245.1027 | +4.03% | 6.81% |
| TSLA | 100/4.5 | bull | bear | 317.57 | 378.0368 | +19.04% | wrong state |
| GOOGL | 15/5 | bear | bear | 360.66 | 360.8342 | +0.05% | 1.36% |
| NVDA | 50/5 | bull | bull | 210.26 | 208.4698 | -0.85% | 0.85% |
| SPCX | 15/4 | bull | bull | 137.34 | 145.0005 | +5.58% | wrong state |
| MU | 100/5 | bull | bull | 845.1 | 844.9522 | -0.02% | 0.02% |
| SNDK | 100/5.5 | bull | bull | 1249.03 | 1253.8895 | +0.39% | 0.39% |
| BMNR | 15/4 | bull | bull | 21.51 | 21.3792 | -0.61% | 0.61% |
| MSTR | 10/4.5 | bull | bull | 125.3 | 126.0105 | +0.57% | 0.57% |
| CRCL | 10/6 | bull | bull | 57.74 | 57.336 | -0.70% | 0.70% |
| INTC | 15/4 | bear | bear | 105.8 | 108.8548 | +2.89% | 2.89% |
| MRVL | 30/4 | bull | bull | 209.81 | 222.5051 | +6.05% | 6.05% |
| AMD | 20/4 | bull | bull | 540.92 | 544.3818 | +0.64% | 0.70% |
| AMZN | 50/6 | bull | bull | 233.26 | 235.2731 | +0.86% | 0.86% |
| META | 30/2 | bear | bear | 740.56 | 686.7606 | -7.26% | 8.94% |
| BOT | 10/3 | bull | bear | 19.96 | 29.5301 | +47.95% | wrong state |
| STRC | 20/4 | bull | bull | 97.43 | 96.9703 | -0.47% | 0.57% |
| PLTR | 30/4 | bull | bull | 186.58 | 181.8641 | -2.53% | 5.51% |
| GOLD | 40/4.5 | bear | bear | 4369.3 | 4437.5617 | +1.56% | 1.56% |
| SILVER | 120/5.5 | bear | bear | 63.775 | 66.511 | +4.29% | 4.29% |

## Evidence and reproduction

`observations.json` records all manually read levels, regimes, dates, counts and image SHA-256s. STRC's current quote is not visible in its long title and is stored as null; no quote is needed for its completed-session replay. `review.json` includes current and candidate production replays, bounded search results and the two futures cutoff comparisons. Historical fixtures are not overwritten. `fetch-failures.json` is empty.

Backtests retain next-session-open execution, 5/15/30-bps costs, same-window buy-and-hold, 365 crypto / 252 stock-and-futures daily annualization, and rolling four-year windows where history allows. No setting was selected for profitability.

Reproduce: `node --experimental-strip-types scripts/fetch-kk-october27.ts --fetch`, `node --experimental-strip-types scripts/research-kk-october27-daily.ts --search`, then `node scripts/report-kk-october27.mjs`. Network fetches are sequential, limited to missing tails except the necessary silver history revalidation, and reusable local fixtures prevent repeat downloads.
