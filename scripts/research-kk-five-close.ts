/** Offline review of confirmed daily regimes against the September 21 archive. */
import fs from "node:fs";
import { calculateIndicators, type Candle, type IndicatorCalculationOptions } from "../lib/regimes.ts";
const root = "research/kk-2026-09-21-archives";
type Ref = { asset: string; source: string; timeframe: string; target: number; state: string; pending?: number };
const refs = (JSON.parse(fs.readFileSync(`${root}/results.json`, "utf8")) as Ref[]).filter(r => r.timeframe === "1d");
const results = refs.map(r => {
  const metal = ["gold", "silver"].includes(r.asset);
  const candles: Candle[] = JSON.parse(fs.readFileSync(`${root}/${r.asset}-${r.source}${metal ? "-futures" : ""}.json`, "utf8")).candles;
  const options = (metal ? {market:"commodity",commodity:r.asset} : r.source === "yahoo" ? {market:"equity",stock:r.asset} : {asset:r.asset}) as IndicatorCalculationOptions;
  options.indicatorIds = ["kk_supertrend"];
  const current = calculateIndicators(candles,"1d",options)[0];
  const previous = calculateIndicators(candles,"1d",{...options,kkSupertrendLegacySingleClose:true})[0];
  const flips = (states: typeof current.states) => states.reduce((n,state,i) => n + (i > 0 && state != null && states[i-1] != null && state !== states[i-1] ? 1 : 0),0);
  const family = metal ? [[15,3],[15,4]] : r.source === "yahoo" ? [[15,3],[15,4],[30,2],[30,4]] : [[15,2],[15,3],[15,4],[15,5]];
  const candidates = family.map(([atrLength,factor]) => {
    const s = calculateIndicators(candles,"1d",{...options,kkSupertrendAtrLength:atrLength,kkSupertrendFactor:factor})[0];
    return {atrLength,factor,value:s.values.supertrend!,state:s.state,count:s.confirmation!.count,pending:s.confirmation!.pending,errorPct:100*(s.values.supertrend!/r.target-1)};
  });
  return {asset:r.asset,source:r.source,target:r.target,targetState:r.state,targetCount:r.pending??null,preset:{atrLength:current.values.atrLength,factor:current.values.factor},value:current.values.supertrend,state:current.state,confirmation:current.confirmation,errorPct:100*(current.values.supertrend!/r.target-1),previousFlips:flips(previous.states),confirmedFlips:flips(current.states),candidates};
});
fs.writeFileSync(`${root}/five-close-review.json`,JSON.stringify(results,null,2)+"\n");
let report = "# Daily KK Supertrend: five consecutive confirmations\n\nBoth bullish and bearish reversals require five consecutive completed daily confirmations. A failed confirmation resets the count. The implemented rule counts consecutive underlying Supertrend regimes, with closes strictly on the appropriate side of the continuously calculated ATR trail. The official regime holds through counts 1–4 and changes on the fifth close; execution is at the next session open. A new live/incomplete candle is excluded. Stock/futures weekends and holidays do not add sessions. The initial ATR warmup seed is retained.\n\nATR lengths and multipliers remain as approved, and weekly uses its existing single-close calculation. The continuously calculated trail leaves current numerical levels unchanged. This is an explicit implementation choice; the user's five-close rule alone does not identify the private chart's band/reset formula. Old daily evidence and searches remain reproducible via the research-only legacy option.\n\nThe 23 previously fitted assets still match the screenshot's official regime on the archived completed candles. SUI/OP remain unresolved at their retained 10/3; no new preset is installed from an incomplete match. The five visible screenshot counters are not reproduced by the current presets/cutoff. Some images include the open September 21 candle; our crypto fixtures end September 20 and stocks/futures end September 18. This could explain a one-count difference but is not proof that the underlying rules match.\n\n| Asset | Preset | Image flip | Calculated | Image state/count | Official state/count | Historical flips: single → five |\n|---|---|---:|---:|---|---|---|\n";
for (const r of results) report += `| ${r.asset.toUpperCase()} | ${r.preset.atrLength}/${r.preset.factor} | ${r.target} | ${Number(r.value!.toPrecision(8))} | ${r.targetState}${r.targetCount==null?"":` / ${r.targetCount}` } | ${r.state} / ${r.confirmation!.count} | ${r.previousFlips} → ${r.confirmedFlips} |\n`;
report += "\nSmall-family candidates, including their pending counts, are recorded in five-close-review.json. Do not interpret a matching level as proof of a matching confirmation history. Revalidation needs historical reversal sequences or the original settings/formula.\n";
fs.writeFileSync(`${root}/FIVE-CLOSE-REVIEW.md`,report);
console.log(results.map(r=>`${r.asset}: ${r.state} ${r.confirmation!.count}/5, flips ${r.previousFlips} → ${r.confirmedFlips}`).join("\n"));
