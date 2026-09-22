import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { calculateIndicators, type Candle } from "../lib/regimes.ts";
import { KK_SEPTEMBER17_EVIDENCE } from "../lib/kk-september17-evidence.ts";
import { marketDefinition } from "../lib/markets.ts";
import { buildResearch } from "../lib/research.ts";

const fixtures = JSON.parse(readFileSync(new URL("../research/kk-2026-09-17/fixtures.json", import.meta.url), "utf8")) as {asset:string;candles:Candle[]}[];
test("six weekly screenshots retain shared presets and reproduce archived completed levels", () => {
  for(const row of KK_SEPTEMBER17_EVIDENCE) {
    const candles=fixtures.find(f=>f.asset===row.asset)!.candles;
    assert.equal(candles.at(-1)!.time,Date.UTC(2026,8,7));
    const kk=calculateIndicators(candles,"1w",{asset:row.asset,indicatorIds:["kk_supertrend"]})[0];
    assert.equal(kk.state,row.targetState);
    assert.ok(Math.abs(kk.values.supertrend!-row.value)<1e-9);
    assert.ok(Math.abs(kk.values.supertrend!/row.target-1)<0.005);
    const prefix=calculateIndicators(candles.slice(0,-1),"1w",{asset:row.asset,indicatorIds:["kk_supertrend"]})[0];
    assert.deepEqual(prefix.states,kk.states.slice(0,-1));
  }
});
test("new BNB and ZEC markets support research, next-open execution and cost sensitivity",()=>{
  for(const asset of ["bnb","zec"] as const){
    assert.equal(marketDefinition(asset,"binance").providerSymbol,`${asset.toUpperCase()}USDT`);
    const candles=fixtures.find(f=>f.asset===asset)!.candles;
    const signals=calculateIndicators(candles,"1w",{asset});
    const baseline=calculateIndicators(candles,"1w",{asset,kkSupertrendAtrLength:10,kkSupertrendFactor:3});
    assert.deepEqual(signals.filter(s=>s.id!=="kk_supertrend"),baseline.filter(s=>s.id!=="kk_supertrend"));
    const daily=calculateIndicators(candles,"1d",{asset,indicatorIds:["kk_supertrend"]})[0];
    assert.deepEqual([daily.values.atrLength,daily.values.factor],[15,asset==="bnb"?4:3]);
    const report=buildResearch(candles,signals,"kk_supertrend","1w");
    assert.ok(report.detail && report.benchmark && report.rolling.length);
    const returns=report.sensitivity.map(s=>s.result!.totalReturn);
    assert.ok(returns[0]>=returns[1] && returns[1]>=returns[2]);
    for(const execution of report.detail.executions){const i=candles.findIndex(c=>c.time===execution.time);assert.equal(execution.price,candles[i].open);assert.equal(execution.signalTime,candles[i-1].time);}
  }
});
