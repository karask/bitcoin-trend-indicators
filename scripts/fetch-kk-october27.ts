/** Research only: extend the October 24 fixtures through the last completed
 * candle before the October 26 UTC / October 27 Athens captures. Never writes production D1. */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { marketDefinition, type AssetId, type SourceId } from "../lib/markets.ts";
import { STOCKS } from "../lib/stocks.ts";
import { COMMODITIES } from "../lib/commodities.ts";
import { fetchYahooStockHistory } from "../lib/yahoo.ts";
import { fetchCommodityHistory } from "../lib/yahoo-commodities.ts";
import { providerJson } from "../lib/provider-http.ts";
import { validateCandles } from "../lib/market-data.ts";
import type { Candle } from "../lib/regimes.ts";

const base = "research/kk-2026-10-24/daily", root = "research/kk-2026-10-27/daily";
const DAY = 86_400_000, cryptoCutoff = Date.UTC(2026, 9, 26), capture = Date.UTC(2026, 9, 26, 23, 5);
const read = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const failures: { file: string; error: string }[] = [];
fs.mkdirSync(root, { recursive: true });
if (!process.argv.includes("--fetch")) throw new Error("Pass --fetch to request read-only provider tails");
for (const file of fs.readdirSync(base).filter(name => /^[a-z]+-(bitstamp|coinbase|kraken|binance|yahoo)\.json$/.test(name)).sort()) {
  const out = `${root}/${file}`;
  if (fs.existsSync(out)) continue;
  try {
    const old = read(`${base}/${file}`), asset = old.asset as string, source = old.source as string;
    const start = old.candles.at(-1).time as number;
    const cutoff = source === "yahoo" ? Date.UTC(2026, 9, 27) : cryptoCutoff;
    const through = source === "yahoo" ? "2026-10-26" : "2026-10-25";
    let rows: Candle[], url = "", raw = "", revalidation: unknown = null;
    let baselineCandles = old.candles as Candle[];
    if (source !== "yahoo") {
      const symbol = asset === "jup" && source === "binance" ? "JUPUSDT" : marketDefinition(asset as AssetId, source as SourceId).providerSymbol;
      const p = new URLSearchParams({ granularity: "86400", start: new Date(start).toISOString(), end: new Date(cutoff).toISOString() });
      url = source === "coinbase" ? `https://api.exchange.coinbase.com/products/${symbol}/candles?${p}`
        : source === "bitstamp" ? `https://www.bitstamp.net/api/v2/ohlc/${symbol}/?step=86400&limit=1000&start=${start / 1000}&end=${cutoff / 1000 - 1}`
        : source === "binance" ? `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&startTime=${start}&endTime=${cutoff - 1}&limit=1000`
        : `https://api.kraken.com/0/public/OHLC?pair=${symbol}&interval=1440&since=${start / 1000 - 1}`;
      const response = await providerJson(url, { "User-Agent": "Regime-Lab/1.0" });
      raw = response.raw;
      const body = response.body;
      if (source === "coinbase") rows = (body as number[][]).map(r => ({ time: +r[0] * 1000, low: +r[1], high: +r[2], open: +r[3], close: +r[4], volume: +r[5], complete: true }));
      else if (source === "binance") rows = (body as number[][]).map(r => ({ time: +r[0], open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[5], complete: true }));
      else if (source === "bitstamp") rows = (body as { data: { ohlc: Record<string, string>[] } }).data.ohlc.map(r => ({ time: +r.timestamp * 1000, open: +r.open, high: +r.high, low: +r.low, close: +r.close, volume: +r.volume, complete: true }));
      else {
        const b = body as { error: string[]; result: Record<string, number[][]> };
        if (b.error?.length) throw new Error(b.error.join(","));
        rows = Object.entries(b.result).find(([key]) => key !== "last")![1].map(r => ({ time: +r[0] * 1000, open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[6], complete: true }));
      }
    } else {
      const fetcher: typeof fetch = async (input, init) => { url = String(input); const r = await fetch(input, init); raw = await r.clone().text(); return r; };
      const stock = STOCKS.find(s => s.id === asset), commodity = COMMODITIES.find(c => c.id === asset);
      const from = new Date(start).toISOString().slice(0, 10);
      rows = stock ? (await fetchYahooStockHistory(stock.symbol, fetcher, capture, from)).candles
        : (await fetchCommodityHistory(commodity!.symbol, fetcher, Date.UTC(2026, 9, 27), from)).candles;
      const last = old.candles.at(-1) as Candle, overlap = rows.find(c => c.time === last.time);
      if (!overlap || (["open", "high", "low", "close"] as const).some(k => Math.abs(overlap[k] / last[k] - 1) > 1e-8)) {
        await new Promise(resolve => setTimeout(resolve, 1250));
        const fullFrom = new Date(old.candles[0].time).toISOString().slice(0, 10);
        rows = stock ? (await fetchYahooStockHistory(stock.symbol, fetcher, capture, fullFrom)).candles
          : (await fetchCommodityHistory(commodity!.symbol, fetcher, Date.UTC(2026, 9, 27), fullFrom)).candles;
        const previous = new Map<number, Candle>(baselineCandles.map(c => [c.time, c]));
        const changed = rows.flatMap(c => {
          const prior = previous.get(c.time);
          return prior && (["open", "high", "low", "close"] as const).some(k => c[k] !== prior[k]) ? [{ date: new Date(c.time).toISOString().slice(0, 10), previous: prior, current: c }] : [];
        });
        revalidation = { reason: "Yahoo revised overlapping OHLC; refetched and validated the entire archived period instead of splicing incompatible histories", start: fullFrom, changed };
        baselineCandles = [];
        console.log(file, `full-history revalidation: ${changed.length} changed candles`);
      }
    }
    const merged = new Map<number, Candle>(baselineCandles.map((c: Candle) => [c.time, c]));
    for (const c of rows) if (c.time < cutoff) merged.set(c.time, c);
    // Session-based providers already check their exchange calendars; weekends
    // are not missing daily candles. Still validate their OHLC and duplicates.
    const validated = validateCandles([...merged.values()], source === "yahoo" ? Infinity : DAY);
    if (validated.gaps || validated.duplicates || validated.malformed || validated.candles.at(-1)?.time !== cutoff - DAY) throw new Error("Missing or invalid completed tail");
    fs.writeFileSync(out, JSON.stringify({ asset, source, retrievedAt: new Date().toISOString(), quality: { gaps: validated.gaps, duplicates: validated.duplicates, malformed: validated.malformed }, provenance: { baseline: `${base}/${file}`, url, rawSha256: sha(raw), comparisonThrough: through, capturedAt: new Date(capture).toISOString(), note: source === "yahoo" && !STOCKS.some(s => s.id === asset) ? "Futures October 26 session was closed at capture; production 00:00 UTC availability is scored separately." : null, revalidation }, candles: validated.candles }) + "\n");
    console.log(file, validated.candles.length, `through ${through}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fetch failed";
    failures.push({ file, error: message });
    console.error(file, message);
  }
  await new Promise(resolve => setTimeout(resolve, 1250));
}
fs.writeFileSync(`${root}/fetch-failures.json`, JSON.stringify(failures, null, 2) + "\n");
if (failures.length) process.exitCode = 1;
