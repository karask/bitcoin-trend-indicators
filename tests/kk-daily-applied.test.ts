import assert from "node:assert/strict";
import test from "node:test";
import { KK_SUPERTREND_PRESETS, KK_SUPERTREND_STOCK_PRESETS, KK_SUPERTREND_COMMODITY_PRESETS } from "../lib/regimes.ts";

test("October daily assignments use existing families; weekly presets follow the October 8 rule", () => {
  const crypto = { btc: [15,2], eth: [15,4], sol: [15,4], doge: [15,4], link: [15,4], xmr: [10,3], jup: [15,3], bonk: [15,3], ada: [15,5], atom: [15,5], hype: [15,4], dot: [15,5], bnb: [15,4], zec: [15,3], sui: [15,2], op: [15,2], avax: [10,3], ray: [10,3], vvv: [15,3], qnt: [50,4] };
  const stocks = { tsla: [30,4], googl: [50,6], nvda: [30,2], mu: [15,3], sndk: [30,4], spcx: [15,4], bmnr: [15,4], mstr: [15,4], crcl: [50,6], intc: [15,4], mrvl: [30,4], amd: [15,4], amzn: [50,6], meta: [30,2], bot: [10,3], strc: [30,4], pltr: [30,4] };
  for (const [id, preset] of Object.entries(KK_SUPERTREND_PRESETS)) {
    assert.deepEqual([preset["1d"].atrLength,preset["1d"].factor],crypto[id as keyof typeof crypto]);
    assert.deepEqual(preset["1w"],{atrLength:["btc","eth","sol","bnb"].includes(id)?10:15,factor:id==="btc"?3:2});
  }
  for (const [id, preset] of Object.entries(KK_SUPERTREND_STOCK_PRESETS)) {
    assert.deepEqual([preset["1d"].atrLength,preset["1d"].factor],stocks[id as keyof typeof stocks]);
    assert.deepEqual(preset["1w"],{atrLength:15,factor:2});
  }
  assert.deepEqual(KK_SUPERTREND_COMMODITY_PRESETS,{gold:{"1d":{atrLength:15,factor:4},"1w":{atrLength:15,factor:2}},silver:{"1d":{atrLength:15,factor:3},"1w":{atrLength:15,factor:2}}});
});
