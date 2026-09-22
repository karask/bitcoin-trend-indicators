import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculateIndicators, type Candle } from "../lib/regimes.ts";

test("independent daily grid winners reproduce archived levels and require matching regimes", () => {
  type Candidate = { atrLength: number; factor: number; value: number; state: string; errorPct: number };
  type Row = { asset: string; source: string; timeframe: string; target: number; state: string; best: Candidate; shared: Candidate | null; candidates: Candidate[] };
  const root = new URL("../research/kk-2026-09-21-archives/", import.meta.url);
  const { results } = JSON.parse(readFileSync(new URL("daily-patterns.json", root), "utf8")) as { results: Row[] };
  assert.equal(results.length, 25);
  for (const row of results) {
    assert.equal(row.timeframe, "1d");
    const suffix = ["gold", "silver"].includes(row.asset) ? "-futures" : "";
    const candles: Candle[] = JSON.parse(readFileSync(new URL(`${row.asset}-${row.source}${suffix}.json`, root), "utf8")).candles;
    for (const candidate of [row.best, row.shared].filter(c => c != null)) {
      assert.equal(candidate.state, row.state);
      assert.ok(Number.isInteger(candidate.atrLength) && Number.isInteger(candidate.factor));
      const signal = calculateIndicators(candles, "1d", { indicatorIds: ["kk_supertrend"], kkSupertrendAtrLength: candidate.atrLength, kkSupertrendFactor: candidate.factor })[0];
      assert.equal(signal.values.supertrend, candidate.value);
      assert.equal(signal.state, candidate.state);
      assert.equal(candidate.errorPct, 100 * (candidate.value / row.target - 1));
    }
    assert.ok(row.candidates.filter(c => c.state === row.state).every(c => Math.abs(c.errorPct) >= Math.abs(row.best.errorPct)));
  }
  assert.ok(Math.abs(results.find(r => r.asset === "sui")!.best.errorPct) > 10);
  assert.ok(Math.abs(results.find(r => r.asset === "op")!.best.errorPct) > 10);
});
