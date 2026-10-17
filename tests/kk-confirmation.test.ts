import assert from "node:assert/strict";
import test from "node:test";
import { confirmDailyRegimes } from "../lib/kk-confirmation.ts";
import { calculateIndicators, type Candle, type RegimeState } from "../lib/regimes.ts";
import { buildResearch } from "../lib/research.ts";
import { overviewState } from "../lib/asset-overview.ts";

test("bullish and bearish reversals occur only on the fifth consecutive confirmation; failure resets", () => {
  const raw: RegimeState[] = ["bear","bull","bull","bull","bull"];
  let result = confirmDailyRegimes(raw);
  assert.equal(result.states.at(-1),"bear"); assert.equal(result.count,4); assert.equal(result.pending,"bull");
  raw.push("bear","bull","bull","bull","bull");
  result = confirmDailyRegimes(raw);
  assert.equal(result.states.at(-1),"bear"); assert.equal(result.count,4);
  raw.push("bull"); result = confirmDailyRegimes(raw);
  assert.equal(result.states.at(-1),"bull"); assert.equal(result.count,0); assert.equal(result.pending,null);
  raw.push("bear","bear","bear","bear","bull","bear","bear","bear","bear");
  result = confirmDailyRegimes(raw); assert.equal(result.states.at(-1),"bull"); assert.equal(result.count,4);
  raw.push("bear"); result = confirmDailyRegimes(raw);
  assert.equal(result.states.at(-1),"bear"); assert.equal(result.count,0);
  const equality = confirmDailyRegimes(["bear","bull","bull","bull","bull","bull"],[true,true,true,true,true,false]);
  assert.equal(equality.states.at(-1),"bear"); assert.equal(equality.count,0);
});

const candles = (): Candle[] => Array.from({length:600},(_,i)=>{
  const close=i<20?100:Math.floor((i-20)/30)%2===0?140:60;
  return {time:Date.UTC(2026,0,1)+i*86400000,open:close,high:close+1,low:close-1,close,volume:1,complete:true};
});
test("pre-October 16 raw-trail replay ignores open candles, preserves weekly/other indicators, and executes after the fifth close", () => {
  const cs=candles();
  for(const options of [{asset:"btc" as const},{market:"equity" as const,stock:"tsla" as const},{market:"commodity" as const,commodity:"gold" as const}]) {
    const settings={...options,kkSupertrendAtrLength:3,kkSupertrendFactor:1,kkSupertrendRawTrailConfirmation:true};
    const all=calculateIndicators(cs,"1d",settings), kk=all.find(s=>s.id==="kk_supertrend")!;
    const legacy=calculateIndicators(cs,"1d",{...settings,kkSupertrendLegacySingleClose:true});
    const raw=legacy.find(s=>s.id==="kk_supertrend")!;
    assert.deepEqual(all.filter(s=>s.id!=="kk_supertrend"),legacy.filter(s=>s.id!=="kk_supertrend"));
    assert.deepEqual(calculateIndicators(cs,"1w",settings),calculateIndicators(cs,"1w",{...settings,kkSupertrendLegacySingleClose:true}));
    assert.deepEqual(kk.overlays,raw.overlays);
    for(let i=1;i<cs.length;i++) if(kk.states[i]!==kk.states[i-1] && kk.states[i-1]!=null) {
      assert.deepEqual(raw.states.slice(i-4,i+1),Array(5).fill(kk.states[i]));
      assert.notEqual(raw.states[i-5],kk.states[i]);
      const partial=cs.slice(0,i+1).map((c,j)=>({...c,complete:j<i}));
      const pending=calculateIndicators(partial,"1d",settings).find(s=>s.id==="kk_supertrend")!;
      assert.equal(pending.state,kk.states[i-1]); assert.equal(pending.confirmation!.count,4);
      assert.equal(pending.lastFlip,calculateIndicators(cs.slice(0,i),"1d",settings).find(s=>s.id==="kk_supertrend")!.lastFlip);
      assert.match(pending.triggerLabel,/4\/5/);
      assert.match(overviewState({...pending,readiness:{ready:true,availableCandles:i,requiredCandles:3,validStates:i-2}},true),/4\/5 pending/);
    }
    for(const end of [24,54,84,114]) {
      const prefix=calculateIndicators(cs.slice(0,end),"1d",settings).find(s=>s.id==="kk_supertrend")!;
      assert.deepEqual(prefix.states,kk.states.slice(0,end));
    }
    const research=buildResearch(cs,all,"kk_supertrend","1d",options);
    assert.ok(research.detail!.executions.length>=3);
    for(const execution of research.detail!.executions) {
      const i=cs.findIndex(c=>c.time===execution.time);
      assert.equal(execution.price,cs[i].open); assert.equal(execution.signalTime,cs[i-1].time);
      assert.notEqual(kk.states[i-1],kk.states[i-2]);
    }
  }
});

// October 16: the chart holds its trail while a reversal is pending (ZEC 1251.54 through 2/5, a reset and 5/5).
test("held-trail daily KK freezes the trail while pending, flips on the fifth close beyond it and ignores open candles", () => {
  const cs=candles();
  for(const options of [{asset:"btc" as const},{market:"equity" as const,stock:"tsla" as const},{market:"commodity" as const,commodity:"gold" as const}]) {
    const settings={...options,kkSupertrendAtrLength:3,kkSupertrendFactor:1};
    const all=calculateIndicators(cs,"1d",settings), kk=all.find(s=>s.id==="kk_supertrend")!;
    const raw=calculateIndicators(cs,"1d",{...settings,kkSupertrendRawTrailConfirmation:true});
    assert.deepEqual(all.filter(s=>s.id!=="kk_supertrend"),raw.filter(s=>s.id!=="kk_supertrend"));
    assert.deepEqual(calculateIndicators(cs,"1w",settings),calculateIndicators(cs,"1w",{...settings,kkSupertrendRawTrailConfirmation:true}));
    const trail=new Map(kk.overlays[0].points.map(p=>[p.time,p.value]));
    let flips=0;
    for(let i=6;i<cs.length;i++) if(kk.states[i]!==kk.states[i-1] && kk.states[i-1]!=null) {
      flips++;
      const held=trail.get(cs[i-5].time)!;
      for(let j=i-4;j<=i;j++) assert.ok(kk.states[i]==="bear"?cs[j].close<held:cs[j].close>held, `close ${j} beyond the held trail`);
      for(let j=i-4;j<i;j++) assert.equal(trail.get(cs[j].time),held, "trail holds while pending");
      const partial=cs.slice(0,i+1).map((c,j)=>({...c,complete:j<i}));
      const pending=calculateIndicators(partial,"1d",settings).find(s=>s.id==="kk_supertrend")!;
      assert.equal(pending.state,kk.states[i-1]); assert.equal(pending.confirmation!.count,4);
      assert.equal(pending.values.supertrend,held);
      assert.equal(pending.lastFlip,calculateIndicators(cs.slice(0,i),"1d",settings).find(s=>s.id==="kk_supertrend")!.lastFlip);
      assert.match(pending.triggerLabel,/4\/5 · 1 more consecutive daily closes beyond the held trail/);
      assert.match(overviewState({...pending,readiness:{ready:true,availableCandles:i,requiredCandles:3,validStates:i-2}},true),/4\/5 pending/);
    }
    assert.ok(flips>=3);
    for(const end of [24,54,84,114]) {
      const prefix=calculateIndicators(cs.slice(0,end),"1d",settings).find(s=>s.id==="kk_supertrend")!;
      assert.deepEqual(prefix.states,kk.states.slice(0,end));
    }
    const research=buildResearch(cs,all,"kk_supertrend","1d",options);
    assert.ok(research.detail!.executions.length>=3);
    for(const execution of research.detail!.executions) {
      const i=cs.findIndex(c=>c.time===execution.time);
      assert.equal(execution.price,cs[i].open); assert.equal(execution.signalTime,cs[i-1].time);
      assert.notEqual(kk.states[i-1],kk.states[i-2]);
    }
  }
});

test("held trail survives a failed confirmation instead of resetting to the next band", () => {
  // Bull trend, then four closes just below the trail, one close back above, then recovery: no flip and the trail is unchanged.
  const base=Array.from({length:80},(_,i)=>100+i*.5);
  const cs: Candle[]=base.map((close,i)=>({time:Date.UTC(2026,0,1)+i*86400000,open:close,high:close+1,low:close-1,close,volume:1,complete:true}));
  const before=calculateIndicators(cs,"1d",{asset:"btc",kkSupertrendAtrLength:5,kkSupertrendFactor:2,indicatorIds:["kk_supertrend"]})[0];
  assert.equal(before.state,"bull");
  const held=before.values.supertrend!, last=cs.at(-1)!;
  const dips=[held-.5,held-.6,held-.4,held-.3,held+.2].map((close,k)=>({time:last.time+(k+1)*86400000,open:close,high:close+.3,low:close-.3,close,volume:1,complete:true}));
  const after=calculateIndicators([...cs,...dips],"1d",{asset:"btc",kkSupertrendAtrLength:5,kkSupertrendFactor:2,indicatorIds:["kk_supertrend"]})[0];
  assert.equal(after.state,"bull"); assert.equal(after.confirmation!.count,0);
  assert.equal(after.values.supertrend,held);
  const raw=calculateIndicators([...cs,...dips],"1d",{asset:"btc",kkSupertrendAtrLength:5,kkSupertrendFactor:2,indicatorIds:["kk_supertrend"],kkSupertrendRawTrailConfirmation:true})[0];
  assert.notEqual(raw.values.supertrend,held, "the raw trail resets after closes below it");
});
