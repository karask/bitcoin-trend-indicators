import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createProviderClient, ProviderCooldownError, retryAfterMs } from "../lib/provider-http.ts";
import { ASSETS, marketDefinition, minimumSourceCandles, sourcesForAsset } from "../lib/markets.ts";
import { calculateIndicators, type Candle } from "../lib/regimes.ts";
import { calibrationStatus } from "../lib/kk-calibration.ts";
import { CRON_ASSETS } from "../worker/refresh.ts";
import { formatPrice } from "../lib/display.ts";

test("public history requests are serialized and paced per provider", async () => {
  let clock = 0, active = 0, maximum = 0;
  const starts: number[] = [];
  const client = createProviderClient({ now: () => clock, sleep: async ms => { clock += ms; }, fetcher: async () => {
    starts.push(clock); active++; maximum = Math.max(maximum, active);
    await Promise.resolve(); active--;
    return Response.json({ price: "1" });
  } });
  await Promise.all([1, 2, 3].map(i => client(`https://api.exchange.coinbase.com/products/OP-USD/candles?page=${i}`)));
  assert.equal(maximum, 1);
  assert.deepEqual(starts, [0, 1250, 2500]);
});

test("429 respects Retry-After, blocks queued requests, and does not rotate Binance hosts", async () => {
  let clock = Date.UTC(2026, 8, 8), calls = 0;
  const client = createProviderClient({ now: () => clock, sleep: async ms => { clock += ms; }, fetcher: async () => { calls++; return calls === 1 ? new Response(null, { status: 429, headers: { "Retry-After": "120" } }) : Response.json([]); } });
  await assert.rejects(client("https://data-api.binance.vision/api/v3/klines"), ProviderCooldownError);
  await assert.rejects(client("https://api1.binance.com/api/v3/klines"), ProviderCooldownError);
  assert.equal(calls, 1);
  clock += 120_000;
  await client("https://data-api.binance.vision/api/v3/klines");
  assert.equal(calls, 2);
});

test("date Retry-After, temporary bans, Kraken body limits, and bounded 5xx retries", async () => {
  assert.equal(retryAfterMs("Tue, 08 Sep 2026 00:02:00 GMT", Date.UTC(2026, 8, 8)), 120_000);
  assert.equal(retryAfterMs("nonsense", 0), null);
  for (const response of [new Response(null, { status: 418 }), Response.json({ error: ["EAPI:Rate limit exceeded"] }), new Response(null, { status: 503, headers: { "Retry-After": "120" } })]) {
    let calls = 0;
    const client = createProviderClient({ fetcher: async () => { calls++; return response; } });
    await assert.rejects(client("https://api.kraken.com/0/public/OHLC"), ProviderCooldownError);
    await assert.rejects(client("https://api.kraken.com/0/public/Ticker"), ProviderCooldownError);
    assert.equal(calls, 1);
  }
  let calls = 0, clock = 0;
  const client = createProviderClient({ now: () => clock, sleep: async ms => { clock += ms; }, fetcher: async () => { calls++; return new Response(null, { status: 502 }); } });
  await assert.rejects(client("https://test.invalid/prices"), /HTTP 502/);
  assert.equal(calls, 2);
});

test("new coins have one verified USD venue and explicit uncalibrated KK presets", () => {
  const daily: Candle[] = Array.from({ length: 300 }, (_, i) => ({ time: Date.UTC(2024, 0, 1) + i * 86_400_000, open: 1 + i / 100, high: 1.1 + i / 100, low: .9 + i / 100, close: 1.01 + i / 100, volume: 10, complete: true }));
  for (const asset of ["jup", "op", "bonk", "ada", "atom", "hype", "dot"] as const) {
    const sources = sourcesForAsset(asset);
    assert.equal(sources.length, 1);
    assert.equal(sources[0].denomination, "USD");
    for (const tf of ["1d", "1w"] as const) {
      const signals = calculateIndicators(daily, tf, { asset });
      const kk = signals.find(signal => signal.id === "kk_supertrend")!, standard = signals.find(signal => signal.id === "supertrend")!;
      assert.equal(kk.values.atrLength, 10); assert.equal(kk.values.factor, 3);
      assert.deepEqual(kk.states, standard.states); assert.equal(kk.values.supertrend, standard.values.supertrend);
      assert.match(calibrationStatus(asset, tf), /Uncalibrated/);
    }
  }
  assert.equal(marketDefinition("jup", "kraken").providerSymbol, "JUPUSD");
  assert.throws(() => marketDefinition("jup", "coinbase"), /Unsupported/);
  assert.equal(formatPrice(.0000123456), "$0.0000123456");
  assert.equal(minimumSourceCandles("hype", "1w"), 26);
  assert.equal(minimumSourceCandles("hype", "1d"), 200);
  assert.equal(minimumSourceCandles("btc", "1w"), 52);
  const short = calculateIndicators(daily.slice(0, 31), "1w", { asset: "hype" });
  assert.equal(short.find(item => item.id === "kk_supertrend")!.readiness?.ready, true);
  assert.equal(short.find(item => item.id === "ma_200w")!.readiness?.ready, false);
});

test("all assets are refreshed once across the five existing cron slots", () => {
  const config = JSON.parse(readFileSync("wrangler.refresh.jsonc", "utf8"));
  assert.deepEqual(Object.keys(CRON_ASSETS), config.triggers.crons);
  assert.deepEqual(Object.values(CRON_ASSETS).flat().sort(), ASSETS.map(asset => asset.id).sort());
  assert.ok(Object.values(CRON_ASSETS).every(group => group.length <= 3));
});
