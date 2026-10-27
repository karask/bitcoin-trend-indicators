/** Four paced read-only diagnostic requests. Never changes production sources. */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { providerJson } from "../lib/provider-http.ts";
import { validateCandles } from "../lib/market-data.ts";
import type { Candle } from "../lib/regimes.ts";
const root = "research/kk-2026-10-27/weekly", cutoff = Date.UTC(2026, 9, 26), DAY = 86_400_000;
if (!process.argv.includes("--fetch")) throw new Error("Pass --fetch for read-only alternate-feed diagnostics");
for (const [asset, source, symbol] of [["ray", "binance", "RAYUSDT"], ["ada", "binance", "ADAUSDT"], ["hype", "kucoin", "HYPE-USDT"], ["xmr", "kucoin", "XMR-USDT"]]) {
  const out = `${root}/${asset}-${source}-daily.json`;
  if (fs.existsSync(out)) continue;
  const baseline = `research/kk-2026-10-19/weekly/${asset}-${source}-daily.json`;
  const old: Candle[] = fs.existsSync(baseline) ? JSON.parse(fs.readFileSync(baseline, "utf8")) : [];
  const start = old.at(-1)?.time ?? Date.UTC(2023, 0, 1);
  const url = source === "binance" ? `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&startTime=${start}&endTime=${cutoff - 1}&limit=1000`
    : `https://api.kucoin.com/api/v1/market/candles?symbol=${symbol}&type=1day&startAt=${start / 1000}&endAt=${cutoff / 1000 - 1}`;
  const response = await providerJson(url, { "User-Agent": "Regime-Lab/1.0" });
  const body = response.body as { code: string; data: number[][] };
  if (source === "kucoin" && body.code !== "200000") throw new Error(`${asset}: KuCoin history failed`);
  const rows: Candle[] = source === "binance" ? (response.body as number[][]).map(r => ({ time: +r[0], open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[5], complete: true }))
    : body.data.map(r => ({ time: +r[0] * 1000, open: +r[1], close: +r[2], high: +r[3], low: +r[4], volume: +r[5], complete: true }));
  const merged = new Map<number, Candle>(old.map(c => [c.time, c]));
  for (const row of rows) if (row.time < cutoff) merged.set(row.time, row);
  const quality = validateCandles([...merged.values()], DAY);
  if (quality.gaps || quality.malformed || quality.duplicates || quality.candles.at(-1)?.time !== cutoff - DAY) throw new Error(`${asset}: Invalid alternate history`);
  fs.writeFileSync(out, JSON.stringify({ asset, source, provenance: { url, baseline: old.length ? baseline : null, rawSha256: createHash("sha256").update(response.raw).digest("hex"), retrievedAt: new Date().toISOString(), denomination: "USDT, diagnostic only; not assumed identical to composite USD" }, quality: { gaps: quality.gaps, malformed: quality.malformed, duplicates: quality.duplicates }, candles: quality.candles }) + "\n");
  console.log(asset, source, quality.candles.length);
  await new Promise(resolve => setTimeout(resolve, 1250));
}
