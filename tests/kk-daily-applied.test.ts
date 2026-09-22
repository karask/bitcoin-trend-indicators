import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { KK_DAILY_EVIDENCE } from "../lib/kk-daily-evidence.ts";
import { calculateIndicators, KK_SUPERTREND_PRESETS, KK_SUPERTREND_STOCK_PRESETS, KK_SUPERTREND_COMMODITY_PRESETS, type Candle, type IndicatorCalculationOptions } from "../lib/regimes.ts";
import { buildResearch } from "../lib/research.ts";

test("approved daily assignments use compact independent families and leave every weekly preset unchanged", () => {
  const crypto = { btc: [15,2], eth: [15,4], sol: [15,2], doge: [15,5], link: [15,4], xmr: [15,3], jup: [15,3], bonk: [15,3], ada: [15,5], atom: [15,5], hype: [15,4], dot: [15,5], bnb: [15,4], zec: [15,3], sui: [10,3], op: [10,3], avax: [10,3], ray: [10,3] };
  const stocks = { tsla: [30,4], googl: [15,3], nvda: [30,2], mu: [15,3], sndk: [30,4], spcx: [15,4], bmnr: [15,3], mstr: [10,3] };
  for (const [id, preset] of Object.entries(KK_SUPERTREND_PRESETS)) {
    assert.deepEqual([preset["1d"].atrLength,preset["1d"].factor],crypto[id as keyof typeof crypto]);
    assert.deepEqual(preset["1w"],{atrLength:["btc","eth","sol"].includes(id)?10:15,factor:id==="btc"?3:2});
  }
  for (const [id, preset] of Object.entries(KK_SUPERTREND_STOCK_PRESETS)) {
    assert.deepEqual([preset["1d"].atrLength,preset["1d"].factor],stocks[id as keyof typeof stocks]);
    assert.deepEqual(preset["1w"],{atrLength:id==="spcx"?10:15,factor:id==="spcx"?3:2});
  }
  assert.deepEqual(KK_SUPERTREND_COMMODITY_PRESETS,{gold:{"1d":{atrLength:15,factor:4},"1w":{atrLength:10,factor:2}},silver:{"1d":{atrLength:15,factor:3},"1w":{atrLength:15,factor:2}}});
});

test("all 23 daily assignments reproduce evidence, preserve other indicators and non-repainting next-open research", () => {
  assert.equal(KK_DAILY_EVIDENCE.length,23);
  for (const row of KK_DAILY_EVIDENCE) {
    const metal = row.asset === "gold" || row.asset === "silver";
    const cs: Candle[] = JSON.parse(readFileSync(new URL(`../research/kk-2026-09-21-archives/${row.asset}-${row.source}${metal?"-futures":""}.json`,import.meta.url),"utf8")).candles;
    const options: IndicatorCalculationOptions = metal ? {market:"commodity",commodity:row.asset as "gold"|"silver"} : row.source === "yahoo" ? {market:"equity",stock:row.asset as keyof typeof KK_SUPERTREND_STOCK_PRESETS} : {asset:row.asset as keyof typeof KK_SUPERTREND_PRESETS};
    const signals = calculateIndicators(cs,"1d",options), kk = signals.find(s=>s.id==="kk_supertrend")!;
    assert.equal(kk.values.supertrend,row.value,row.asset);
    assert.equal(kk.state,row.targetState,row.asset);
    assert.deepEqual([kk.values.atrLength,kk.values.factor],[row.preset.atrLength,row.preset.factor]);
    const before = calculateIndicators(cs,"1d",{...options,kkSupertrendAtrLength:row.previous.atrLength,kkSupertrendFactor:row.previous.factor});
    assert.deepEqual(signals.filter(s=>s.id!=="kk_supertrend"),before.filter(s=>s.id!=="kk_supertrend"));
    const prefix = calculateIndicators(cs.slice(0,-1),"1d",{...options,indicatorIds:["kk_supertrend"]})[0];
    assert.deepEqual(prefix.states,kk.states.slice(0,-1));
    assert.deepEqual(prefix.overlays[0].points,kk.overlays[0].points.filter(p=>p.time<=cs.at(-2)!.time));
    const research = buildResearch(cs,signals,"kk_supertrend","1d",options);
    assert.equal(research.periodsPerYear,options.market?252:365);
    assert.ok(research.detail && research.benchmark);
    assert.equal(research.detail.summary.start,research.benchmark.summary.start);
    const returns = research.sensitivity.map(s=>s.result!.totalReturn);
    assert.ok(returns[0]>=returns[1] && returns[1]>=returns[2]);
    for (const e of research.detail.executions) {
      const i = cs.findIndex(c=>c.time===e.time);
      assert.equal(e.price,cs[i].open); assert.equal(e.signalTime,cs[i-1].time);
    }
    if(cs.length>5*365) assert.ok(research.rolling.length>0);
  }
});
