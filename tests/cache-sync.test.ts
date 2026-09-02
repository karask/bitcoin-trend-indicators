import assert from "node:assert/strict";
import test from "node:test";
import { cryptoIncrementalStart, mergeCryptoDataset } from "../lib/crypto-cache.ts";
import type { MarketDataset } from "../lib/market-data.ts";
import { onRequestPost } from "../functions/api/v1/sync.ts";

const DAY = 86_400_000;

function dataset(timeframe: "1d" | "1w", closes: number[]): MarketDataset {
  const step = timeframe === "1d" ? DAY : 7 * DAY;
  return {
    asset: "btc", assetLabel: "Bitcoin", source: "bitstamp", sourceLabel: "Bitstamp", market: "BTC/USD", denomination: "USD", timeframe,
    candles: closes.map((close, index) => ({ time: Date.UTC(2026, 0, 1) + index * step, open: close, high: close, low: close, close, volume: 1, complete: true })),
    retrievedAt: "2026-01-01T00:00:00.000Z", checksum: "test", provisional: null, stale: false, demo: false, storage: "d1", warning: null,
    quality: { gaps: 0, duplicates: 0, malformed: 0 },
  };
}

test("crypto browser history replaces an overlapping tail without redownloading its prefix", () => {
  const cached = dataset("1d", Array.from({ length: 60 }, (_, index) => 100 + index));
  const start = cryptoIncrementalStart(cached)!;
  const incoming = { ...cached, retrievedAt: "2026-03-01T00:00:00.000Z", candles: cached.candles.filter(candle => candle.time >= start).map(candle => ({ ...candle, close: candle.close + 1 })) };
  incoming.candles.push({ ...incoming.candles.at(-1)!, time: incoming.candles.at(-1)!.time + DAY, close: 999 });
  const merged = mergeCryptoDataset(cached, incoming, start)!;

  assert.equal(merged.candles[0].close, 100);
  assert.equal(merged.candles.find(candle => candle.time === start)!.close, cached.candles.find(candle => candle.time === start)!.close + 1);
  assert.equal(merged.candles.at(-1)!.close, 999);
  assert.equal(merged.retrievedAt, incoming.retrievedAt);
});

test("on-demand sync is same-origin and skips provider access when D1 is current", async () => {
  const database = {
    prepare() {
      return {
        bind() {
          return {
            async first() { return { last_candle: Date.now(), checked_at: new Date().toISOString() }; },
            async all() { return { results: [], success: true }; },
            async run() { return { results: [], success: true }; },
          };
        },
      };
    },
    async batch() { return []; },
  };
  const invoke = (origin: string) => onRequestPost({
    request: new Request("https://example.test/api/v1/sync", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ market: "crypto", asset: "btc", source: "bitstamp" }) }),
    env: { REGIME_DB: database as never },
    waitUntil() {},
    next: async () => new Response(),
  });

  const rejected = await invoke("https://attacker.test");
  assert.equal(rejected.status, 403);
  const current = await invoke("https://example.test");
  assert.equal(current.status, 200);
  assert.equal((await current.json() as { status: string }).status, "current");
});
