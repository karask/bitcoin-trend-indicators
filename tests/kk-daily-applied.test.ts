import assert from "node:assert/strict";
import test from "node:test";
import { KK_SUPERTREND_PRESETS, KK_SUPERTREND_STOCK_PRESETS, KK_SUPERTREND_COMMODITY_PRESETS } from "../lib/regimes.ts";

test("October 12 daily presets: per-asset October fits, crypto tiers otherwise; weekly presets follow the October 8 rule", () => {
  // JUP/BONK/RAY/VVV (< $8B) use the 15/2.5 tier, ADA ($8–12B) 15/3.5, ZEC (≥ $12B) 15/4.
  const crypto = { btc: [15,2], eth: [15,4], sol: [15,4], doge: [15,4], link: [100,4.5], xmr: [30,4], jup: [15,2.5], bonk: [15,2.5], ada: [15,3.5], atom: [5,3.5], hype: [15,4], dot: [50,4.5], bnb: [100,4], zec: [15,4], sui: [10,2], op: [50,3.5], avax: [100,3], ray: [15,2.5], vvv: [15,2.5], qnt: [21,2.5] };
  const stocks = { tsla: [100,4.5], googl: [15,5], nvda: [30,2], mu: [100,5], sndk: [100,5.5], spcx: [15,4], bmnr: [15,4], mstr: [10,4.5], crcl: [10,6], intc: [15,4], mrvl: [30,4], amd: [20,4], amzn: [50,6], meta: [30,2], bot: [10,3], strc: [30,4], pltr: [30,4] };
  for (const [id, preset] of Object.entries(KK_SUPERTREND_PRESETS)) {
    assert.deepEqual([preset["1d"].atrLength,preset["1d"].factor],crypto[id as keyof typeof crypto]);
    assert.deepEqual(preset["1w"],{atrLength:["btc","eth","sol","bnb"].includes(id)?10:15,factor:id==="btc"?3:2});
  }
  for (const [id, preset] of Object.entries(KK_SUPERTREND_STOCK_PRESETS)) {
    assert.deepEqual([preset["1d"].atrLength,preset["1d"].factor],stocks[id as keyof typeof stocks]);
    assert.deepEqual(preset["1w"],{atrLength:15,factor:2});
  }
  assert.deepEqual(KK_SUPERTREND_COMMODITY_PRESETS,{gold:{"1d":{atrLength:15,factor:5},"1w":{atrLength:15,factor:2}},silver:{"1d":{atrLength:100,factor:5},"1w":{atrLength:15,factor:2}}});
});
