import { mkdirSync, writeFileSync } from "node:fs";
import { calculateIndicators, type Candle } from "../lib/regimes.ts";
import { aggregateWeekly } from "../lib/market-data.ts";

const cutoff = Date.UTC(2026, 8, 21);
const response = await fetch("https://api.kraken.com/0/public/OHLC?pair=RAYUSD&interval=1440", { signal: AbortSignal.timeout(12_000) });
if (!response.ok) throw new Error(`Kraken returned HTTP ${response.status}`);
const body = await response.json() as { error?: string[]; result?: Record<string, unknown> };
if (body.error?.length) throw new Error(body.error.join(", "));
const key = Object.keys(body.result ?? {}).find(item => item !== "last");
const rows = key ? body.result?.[key] as Array<Array<number | string>> : [];
const daily: Candle[] = rows.map(row => ({ time: Number(row[0]) * 1000, open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4]), volume: Number(row[6]), complete: true })).filter(row => row.time < cutoff);
const candles = aggregateWeekly(daily);
const kk = calculateIndicators(candles, "1w", { asset: "ray", indicatorIds: ["kk_supertrend"] })[0];
const output = new URL("../research/kk-2026-09-22/", import.meta.url);
mkdirSync(output, { recursive: true });
writeFileSync(new URL("ray.json", output), `${JSON.stringify({ source: "Kraken RAY/USD", cutoff, candles }, null, 2)}\n`);
console.log(JSON.stringify({ candles: candles.length, through: new Date(candles.at(-1)!.time).toISOString(), state: kk.state, value: kk.values.supertrend, lastFlip: new Date(kk.lastFlip!).toISOString(), effectiveFlip: new Date(kk.lastFlip! + 7 * 86_400_000).toISOString() }, null, 2));
