/** Format the two reproducible research reviews, never edit production presets. */
import fs from "node:fs";
const root = "research/kk-2026-10-27";
const read = path => JSON.parse(fs.readFileSync(path, "utf8"));
const daily = read(`${root}/daily/review.json`), weekly = read(`${root}/weekly/review.json`);
const dailyCharts = read(`${root}/daily/observations.json`).charts;
const weeklyCharts = read(`${root}/weekly/observations.json`).charts;
const latest = row => (row.current?.checks ?? row.checks).at(-1);
const fits = c => c.state === c.targetState && Math.abs(c.errorPct) < 1;
const num = n => n < .0001 ? n.toPrecision(8) : n < 1 ? n.toFixed(7).replace(/0+$/, "") : n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
const pct = n => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const preset = p => `${p.atrLength}/${p.factor}`;
const dChanged = daily.filter(r => r.target !== r.previousTarget);
const wChanged = weekly.rows.filter(r => r.target !== r.previousTarget && r.asset !== "sui");
const wrong = daily.filter(r => latest(r).state !== r.targetState).map(r => r.asset.toUpperCase());
const common = [
  "Reviewed **27 October 2026**, from the two `TradingView-MoneyLine-39-…-2026-10-27` folders in Downloads. All 78 screenshots are readable; no asset additions or user clarification were needed. There are 20 crypto, 17 stocks and 2 COMEX continuous futures in each folder. Gold and silver are GC1!/SI1!, not spot.",
  "",
  "**No production parameters, indicator algorithms, data-source defaults, application database or other indicators were changed.** This calibration review does not claim to have recovered the private MoneyLine formula. Existing unrelated overview and earlier research edits were preserved. No commit, push or deployment was requested or performed.",
  "",
];
const levelChanges = rows => ["| Asset | Previous chart | New chart | Current app replay | Error |", "|---|---:|---:|---:|---:|", ...rows.map(r => `| ${r.asset.toUpperCase()} | ${num(r.previousTarget)} | ${num(r.target)} | ${num(latest(r).value)} | ${pct(latest(r).errorPct)} |`)];
const pending = daily.filter(r => latest(r).chartPendingCount);
const weakCounts = pending.filter(r => latest(r).asCapturedCount !== latest(r).chartPendingCount);
const dailyLines = [
  "# Daily KK Supertrend — 27 October 2026 batch", "", ...common,
  "## Correct cutoff", "",
  "Daily captures were **26 October 23:05–23:10 UTC**, which was already 27 October in Athens. Crypto uses completed candles through **25 October**; the 26 October candle was forming. US stocks use the completed **26 October** regular session. COMEX's 26 October session had closed and its new 27 October session was forming. Futures research therefore scores the closed 26 October bar, with the application's more conservative 00:00 UTC policy (through 23 October at capture) reported separately. No 27 October candle enters official signals or backtests.", "",
  "## Result", "",
  `- Correct latest official state: **${daily.filter(r => latest(r).state === r.targetState).length}/39**. Wrong states remain ${wrong.join(", ")}.`,
  `- Latest state and trail within 1%: **${daily.filter(r => fits(latest(r))).length}/39** (previous batch 22/39).`,
  `- Every archived state and trail within 1%: **${daily.filter(r => r.current.levelFits).length}/39**, across the nine October batches (3, 5, 9, 12, 16, 19, 22, 24, 27). LINK, gold and silver each have eight available scored references, starting 5 October; missing 3 October readings are not invented. Gold now falls outside tolerance; the previous review had 20/39.`,
  `- Only **${daily.filter(r => r.current.levelFits && r.current.allPendingMatch && r.current.allFlipDatesMatch).length}/39** current settings also match every scored pending count and last-flip date convention. A close line is not necessarily a fully recovered configuration.`,
  "- No chart changed official daily regime or last-flip date since the 24 October batch. Seven active trails moved; the other 32 are unchanged.", "",
  "## Chart changes since 24 October", "", ...levelChanges(dChanged), "",
  "## Five-close confirmations", "",
  "The rule remains five consecutive **completed** closes, in both directions, resetting when a close returns to the original side. Open crypto quotes are used only to reproduce the chart's provisional counter. Stock Monday closes are counted once; after-hours quotes do not create another daily candle.", "",
  "| Asset | Screenshot bearish count | App as captured | App completed closes |", "|---|---:|---:|---:|",
  ...pending.map(r => { const c = latest(r); return `| ${r.asset.toUpperCase()} | ${c.chartPendingCount}/5 | ${c.asCapturedCount}/5 | ${c.confirmationCount}/5 |`; }), "",
  `**${pending.length - weakCounts.length}/${pending.length} printed pending counts match.** ${weakCounts.map(r => r.asset.toUpperCase()).join(", ")} do not. ADA shows no pending counter on the chart, but the app's higher trail produces a provisional bearish 5/5. TSLA also has an app bullish pending close while its official app state is incorrectly bearish. These discrepancies were not hidden by the level-only success statistic.`, "",
  "**DOGE's screenshot says Bearish 5/5 while Trend is still BULLISH.** There are four completed bearish closes plus the still-open 26 October candle. It must not be declared officially bearish before that candle closes. BTC's screenshot is only 3/5, whereas the app counts 5/5 provisionally because its trail is higher; this is a real calibration discrepancy, not a reason to include the open candle in signals.", "",
  "## Search and calibration decision", "",
  "The existing parameters were replayed against each batch's own archived history, using only that batch's completed candles. A coarse grid tested 26 sampled ATR lengths from 5–200 and multipliers 1.5–8 in 0.5 steps, separately for each asset. Cases needing review received a bounded diagnostic grid of 44 sampled lengths and multipliers 1.5–9 in 0.1 steps. Every retained candidate was rechecked through the production calculation engine. This is not an exhaustive search of all integer lengths or a proof that no other formula can fit.", "",
  "- **Keep the approved presets.** Replacing them with isolated single-chart fits would increase parameter proliferation and can break earlier observations. Level-only fits with wrong dates or counters are not adopted.",
  "- **XMR 30/4:** new trail 493.4332 versus 493.18 (+0.05%). The earlier diagnostic 27/3.9 still fits all nine levels, counters and accepted flip-date alignment (worst 0.66%), but it would add another arbitrary decimal exception. It remains a hypothesis, not a production change.",
  "- **GOOGL 15/5:** the new level is nearly exact (360.8342 vs 360.66), but earlier history and the June flip date remain mismatched. This is evidence against refitting to only the newest screenshot.",
  "- **LINK and AVAX:** the active bearish trails are converging towards the chart, but a parameter fit must also reproduce their earlier bullish trails and transitions. No tested setting keeps all dated state/level observations within 1%.",
  "- **SUI, QNT, META and ZEC:** mismatches across the reversal remain. Correct five-close timing alone does not identify how the private indicator initializes and ratchets its new opposite trail. Do not invent a new confirmation rule.",
  "- **Silver:** Yahoo revised 23 October from a full-range bar (53.075–54.795, volume 57,273) to a near-expiry flat bar at 53.711 (volume 15); 26 October is also flat at 54.108 with volume 15. The entire archived period was refetched and calendar-validated rather than spliced across the revision. TradingView SI1! is a different continuous-futures construction; parameter-fitting this contract mismatch is not justified. The previously considered 110/5 and 115/5.3 no longer fit every batch within 1%.",
  "- **No stable daily cap-tier formula is established.** Crypto, stocks and commodities remain separate research groups; weekly's compact family should not be imposed on daily. Repeated post-flip discrepancies across both crypto and equities point to missing algorithm/settings information, not a defensible new small/mid/large-cap boundary.", "",
  "Best additional evidence: MoneyLine's Inputs/settings and version, especially separate bull/bear factors, ATR smoothing, initial seed, and trail-reset/confirmation options, on LINK, SUI, QNT or META.", "",
  "## Futures availability diagnostic", "",
  "These are distinct data-cutoff comparisons, not competing calibrations:", "",
  "| Asset | Screenshot | Closed 26 Oct replay | Error | Strict app cutoff | Strict app trail | Error |", "|---|---:|---:|---:|---|---:|---:|",
  ...daily.filter(r => r.availabilityComparison).map(r => `| ${r.asset.toUpperCase()} | ${num(r.target)} | ${num(latest(r).value)} | ${pct(latest(r).errorPct)} | ${r.availabilityComparison.through} | ${num(r.availabilityComparison.value)} | ${pct(r.availabilityComparison.errorPct)} |`), "",
  "## All 39 approved presets", "",
  "| Asset | ATR/factor | Chart state | App state | Chart trail | App trail | Error | Worst all batches |", "|---|---|---|---|---:|---:|---:|---:|",
  ...daily.map(r => { const c = latest(r); return `| ${r.asset.toUpperCase()} | ${preset(r.preset)} | ${r.targetState} | ${c.state} | ${num(r.target)} | ${num(c.value)} | ${pct(c.errorPct)} | ${r.current.maxErrorPct == null ? "wrong state" : r.current.maxErrorPct.toFixed(2) + "%"} |`; }), "",
  "## Evidence and reproduction", "",
  "`observations.json` records all manually read levels, regimes, dates, counts and image SHA-256s. STRC's current quote is not visible in its long title and is stored as null; no quote is needed for its completed-session replay. `review.json` includes current and candidate production replays, bounded search results and the two futures cutoff comparisons. Historical fixtures are not overwritten. `fetch-failures.json` is empty.", "",
  "Backtests retain next-session-open execution, 5/15/30-bps costs, same-window buy-and-hold, 365 crypto / 252 stock-and-futures daily annualization, and rolling four-year windows where history allows. No setting was selected for profitability.", "",
  "Reproduce: `node --experimental-strip-types scripts/fetch-kk-october27.ts --fetch`, `node --experimental-strip-types scripts/research-kk-october27-daily.ts --search`, then `node scripts/report-kk-october27.mjs`. Network fetches are sequential, limited to missing tails except the necessary silver history revalidation, and reusable local fixtures prevent repeat downloads.", "",
];
const weekAltFits = weekly.rows.filter(r => fits(latest(r)) || r.alternateFeeds.some(a => fits(a.check))).length;
const weeklyLines = [
  "# Weekly KK Supertrend — 27 October 2026 batch", "", ...common,
  "## Completed-week comparison", "",
  "Captures were **26 October 23:10–23:15 UTC** (27 October in Athens). The last completed Monday-based week starts **19 October**: crypto through Sunday 25 October; stocks and COMEX through Friday 23 October. The week starting 26 October is incomplete and excluded, even though Monday's US stock session had closed. Full archived history is used to warm up ATR, not only the visible two-year window.", "",
  "## Result", "",
  `- Approved class rule: **BTC 10/3; ETH, SOL and BNB 10/2; other crypto, stocks and futures 15/2.** The ≥$50B registered crypto tier remains the existing weekly heuristic, not a freshly measured market-cap threshold.`,
  `- App-feed state and trail within 1%: **${weekly.rows.filter(r => fits(latest(r))).length}/39** (previously 34/39). Same count holds across all three weekly batches reviewed here.`,
  `- With diagnostic exchange alternatives: **${weekAltFits}/39** latest charts fit. XMR on KuCoin and RAY on Binance resolve two level discrepancies without changing parameters. These USDT alternatives are not assumed identical to composite USD and do not change production sources.`,
  `- Flip entry-week matches on **${weekly.rows.filter(r => latest(r).flipWeekMatches).length}/39** app feeds, or 34/39 using Binance ADA.`,
  "- **Two new bearish flips are reproduced by unchanged 15/2:** QNT and gold. The model flips on the completed week of 19 October; chart entry labels are 26 October for QNT and Sunday 25 October for COMEX gold.", "",
  "| New bearish flip | ATR/factor | Chart new trail | App new trail | Error |", "|---|---|---:|---:|---:|",
  ...weekly.rows.filter(r => r.previousState !== r.targetState).map(r => `| ${r.asset.toUpperCase()} | ${preset(r.preset)} | ${num(r.target)} | ${num(latest(r).value)} | ${pct(latest(r).errorPct)} |`), "",
  "These add two independent examples supporting the standard opposite-band initialization on weekly charts. Daily still has its separate five-close/held-trail identification problem.", "",
  "## Weekly chart changes since 19 October", "", ...levelChanges(wChanged), "",
  "Six material trail changes. SUI's displayed precision changed 0.7980 → 0.79803, not evidence of a new configuration. Other chart trails are unchanged. Only QNT and gold changed official weekly state.", "",
  "**TSLA remains officially bearish.** Its screenshot's Bullish 1/1 belongs to the still-forming week of 26 October. Monday's close above 383.88 does not complete a weekly reversal. Do not change its confirmed regime or parameters from that provisional counter.", "",
  "## Feed and history diagnostics", "",
  "| Asset | App feed error | Alternate feed | Alternate trail | Error | Flip entry-week right? |", "|---|---:|---|---:|---:|---|",
  ...weekly.rows.flatMap(r => r.alternateFeeds.map(a => `| ${r.asset.toUpperCase()} | ${pct(latest(r).errorPct)} | ${a.source} USDT | ${num(a.check.value)} | ${pct(a.check.errorPct)} | ${a.check.flipWeekMatches ? "yes" : "no"} |`)), "",
  "- XMR's new rising trail is 469.19 on Kraken versus the composite chart's 475.78 (−1.38%), but 472.76 on KuCoin (−0.63%) with unchanged 15/2. A venue difference is a plausible explanation; this does not prove the exact composite construction.",
  "- RAY remains a Kraken-versus-composite difference; Binance is within 0.49%. ADA's Binance flip week matches, whereas Coinbase flips one week earlier. HYPE still has a historical flip-week mismatch on both checked sources despite a close level.",
  "- SPCX and BOT remain short-IPO initialization cases; BMNR's Yahoo history starts at its uplisting and lacks the older OTC warm-up. These are not evidence for three arbitrary new multipliers.",
  "- Silver remains a Yahoo SI=F versus TradingView SI1! contract-roll discrepancy. Full-history revalidation recorded Yahoo's newly revised 23 October near-expiry bar. Retain that provenance instead of attributing all disagreement to ATR settings.", "",
  "## Compact-family check", "",
  "A class-wide diagnostic grid tested nine sampled ATR lengths (5, 10, 12, 14, 15, 16, 20, 25, 30) and nine multipliers (1–5 in 0.5 steps): 81 common settings. A match requires correct state, trail within 1% and the chart's flip entry-week in **all three** dated weekly batches (16, 19, 27 October), not just the latest chart. No independent per-asset preset is installed.", "",
  "| Group | Best shared tested setting | Matching assets | Next setting | Matching assets |", "|---|---|---:|---|---:|",
  ...weekly.familySearch.groups.map(g => `| ${g.assetClass === "crypto" ? "Crypto in 15/2 tier (16)" : g.assetClass === "stock" ? "Stocks (17)" : "Futures (2)"} | ${g.ranking[0]?.preset ?? "none"} | ${g.ranking[0]?.matches ?? 0} | ${g.ranking[1]?.preset ?? "none"} | ${g.ranking[1]?.matches ?? 0} |`), "",
  "Several futures settings tie on gold and none fits silver; two metals cannot identify a market-cap family. The broadest shared weekly setting remains 15/2 for the other crypto and stocks. Feed-matched level-only coverage is higher than this deliberately stricter state/level/date score. No new small/mid-cap cutoff can be estimated from these screenshots alone; the existing $50B split is an empirical registry heuristic, not a proven universal rule.", "",
  "## All 39 weekly presets", "",
  "| Asset | ATR/factor | Chart state | App state | Chart trail | App trail | Error | Entry week right? |", "|---|---|---|---|---:|---:|---:|---|",
  ...weekly.rows.map(r => { const c = latest(r); return `| ${r.asset.toUpperCase()} | ${preset(r.preset)} | ${r.targetState} | ${c.state} | ${num(r.target)} | ${num(c.value)} | ${pct(c.errorPct)} | ${c.flipWeekMatches ? "yes" : "no"} |`; }), "",
  "## Evidence and reproduction", "",
  "`observations.json` contains 39 manually read chart levels/states/flip dates with original filenames and SHA-256s. `review.json` holds three dated production replays per asset, the family search and four alternate-feed diagnostics. Daily histories are shared with the daily review, not downloaded again. The alternate fetch makes four sequential read-only requests; it does not seed D1.", "",
  "Backtest diagnostics retain 52 periods/year, next-session-open execution, 5/15/30-bps costs, same-window buy-and-hold, and rolling four-year windows where sufficient history exists. Incomplete weeks are never backtested. No parameter was chosen by profitability.", "",
  "Reproduce after the daily fixtures: `node --experimental-strip-types scripts/fetch-kk-october27-alternates.ts --fetch`, `node --experimental-strip-types scripts/research-kk-october27-weekly.ts --search`, then `node scripts/report-kk-october27.mjs`.", "",
];
const summary = [
  "# KK Supertrend calibration review — 27 October 2026", "", ...common,
  "| Check | Daily | Weekly |", "|---|---:|---:|", `| Readable charts | ${dailyCharts.length} | ${weeklyCharts.length} |`, `| Latest state + trail within 1%, app feeds | ${daily.filter(r => fits(latest(r))).length}/39 | ${weekly.rows.filter(r => fits(latest(r))).length}/39 |`, `| Latest state + trail with diagnostic alternate feeds | not substituted | ${weekAltFits}/39 |`, `| Parameter changes | none | none |`, "",
  "## Most important findings", "",
  "- **Weekly QNT and gold flipped bearish:** unchanged 15/2 reproduces the new trails at 270.24 vs 268.13 (+0.79%), and 4538.15 vs 4535.40 (+0.06%). TSLA's bullish 1/1 is provisional on the current week, not a completed weekly reversal.",
  "- **Daily DOGE's bearish 5/5 is provisional:** four closed daily candles plus the open 26 October candle; the confirmed chart state remains bullish. Daily regimes are unchanged from the last batch.",
  "- **Keep weekly's compact family.** The new XMR discrepancy is within 1% on KuCoin with the same 15/2; RAY likewise fits on Binance. No venue default is changed.",
  "- **Daily is not fully calibrated:** 19/39 current settings keep every available dated state/level comparison within 1% across the nine batches; only 10/39 also match all scored counters and accepted date alignment. LINK and the metals have eight available references; the other assets have nine. Further one-image refits would add exceptions without identifying the private trail/reset logic. No new production preset is justified by this batch.",
  "- **Cutoffs matter:** screenshots were captured late on 26 October UTC, already 27 October Athens. Crypto daily ends 25 October, stocks daily ends 26 October, and weekly ends the week starting 19 October. COMEX has a separate conservative app availability diagnostic. Yahoo silver revised a near-expiry candle; it was fully revalidated.", "",
  "Detailed readings, all 39 presets per timeframe, errors, historical checks and candidate-search decisions:", "",
  "- [Daily report](daily/REPORT.md)", "- [Weekly report](weekly/REPORT.md)", "",
  "No market-cap boundary beyond the existing weekly registry heuristic is established. Daily/weekly and asset classes remain separate; no other indicator is calibrated.", "",
  "## Verification", "",
  "Passed: eight new research tests; the full unit suite (29 TypeScript test files) and 15 component tests; `npx tsc --noEmit`; `npm run lint`; `git diff --check`. Research tests cover dated production replay, image/fixture hashes, separate daily/weekly cutoffs, provisional confirmations, incomplete weeks, futures revisions, unchanged presets, non-repainting and backtest execution/costs. Application/Pages builds were not rerun because no application implementation changed; no deployment was performed.", "",
];
fs.writeFileSync(`${root}/daily/REPORT.md`, dailyLines.join("\n"));
fs.writeFileSync(`${root}/weekly/REPORT.md`, weeklyLines.join("\n"));
fs.writeFileSync(`${root}/REPORT.md`, summary.join("\n"));
console.log("Wrote combined, daily and weekly reports.");
