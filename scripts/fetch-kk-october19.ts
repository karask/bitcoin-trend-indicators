/** Extends the October 16 fixtures to the last candle completed before the 19 October capture (crypto: 18 Oct UTC; stocks/futures: 16 Oct session). Research only. */
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

const base = "research/kk-2026-10-16/daily", root = "research/kk-2026-10-19/daily";
const DAY = 86_400_000, cryptoCutoff = Date.UTC(2026, 9, 19), capture = Date.UTC(2026, 9, 19, 18, 50);
const read = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
fs.mkdirSync(root, { recursive: true });

for (const file of fs.readdirSync(base).filter(name => /^[a-z]+-(bitstamp|coinbase|kraken|binance|yahoo)\.json$/.test(name)).sort()) {
  const out = `${root}/${file}`;
  if (fs.existsSync(out)) continue;
  const old = read(`${base}/${file}`);
  const asset = old.asset as string, source = old.source as string;
  let candles: Candle[], url = "", raw = "";
  if (source !== "yahoo") {
    const start = old.candles.at(-1).time as number;
    const symbol = asset === "jup" && source === "binance" ? "JUPUSDT" : marketDefinition(asset as AssetId, source as SourceId).providerSymbol;
    const p = new URLSearchParams({ granularity: "86400", start: new Date(start).toISOString(), end: new Date(cryptoCutoff).toISOString() });
    url = source === "coinbase" ? `https://api.exchange.coinbase.com/products/${symbol}/candles?${p}`
      : source === "bitstamp" ? `https://www.bitstamp.net/api/v2/ohlc/${symbol}/?step=86400&limit=1000&start=${start / 1000}&end=${cryptoCutoff / 1000 - 1}`
      : source === "binance" ? `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&startTime=${start}&endTime=${cryptoCutoff - 1}&limit=1000`
      : `https://api.kraken.com/0/public/OHLC?pair=${symbol}&interval=1440&since=${start / 1000 - 1}`;
    const response = await providerJson(url, { "User-Agent": "Regime-Lab/1.0" });
    raw = response.raw;
    const body = response.body as never;
    let rows: Candle[];
    if (source === "coinbase") rows = (body as number[][]).map(r => ({ time: +r[0] * 1000, low: +r[1], high: +r[2], open: +r[3], close: +r[4], volume: +r[5], complete: true }));
    else if (source === "binance") rows = (body as number[][]).map(r => ({ time: +r[0], open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[5], complete: true }));
    else if (source === "bitstamp") rows = (body as { data: { ohlc: Record<string, string>[] } }).data.ohlc.map(r => ({ time: +r.timestamp * 1000, open: +r.open, high: +r.high, low: +r.low, close: +r.close, volume: +r.volume, complete: true }));
    else {
      const b = body as { error: string[]; result: Record<string, number[][]> };
      if (b.error?.length) throw new Error(b.error.join(","));
      rows = Object.entries(b.result).find(([key]) => key !== "last")![1].map(r => ({ time: +r[0] * 1000, open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[6], complete: true }));
    }
    const merged = new Map<number, Candle>(old.candles.map((c: Candle) => [c.time, c]));
    for (const c of rows) if (c.time < cryptoCutoff) merged.set(c.time, c);
    const validated = validateCandles([...merged.values()], DAY);
    if (validated.gaps || validated.duplicates || validated.malformed || validated.candles.at(-1)?.time !== cryptoCutoff - DAY) throw new Error(`${asset}-${source}: incomplete or invalid tail`);
    candles = validated.candles;
  } else {
    let body = "";
    const fetcher: typeof fetch = async (input, init) => { const r = await fetch(input, init); body = await r.clone().text(); return r; };
    const stock = STOCKS.find(s => s.id === asset), commodity = COMMODITIES.find(c => c.id === asset);
    if (stock) {
      const tail = await fetchYahooStockHistory(stock.symbol, fetcher, capture, "2026-10-12");
      const last = old.candles.at(-1) as Candle, overlap = tail.candles.find(c => c.time === last.time);
      if (!overlap || (["open", "high", "low", "close"] as const).some(k => Math.abs(overlap[k] / last[k] - 1) > 1e-8)) throw new Error(`${asset}: Yahoo adjustment changed; reload full history`);
      const merged = new Map<number, Candle>(old.candles.map((c: Candle) => [c.time, c]));
      for (const c of tail.candles) merged.set(c.time, c);
      candles = [...merged.values()].sort((a, b) => a.time - b.time);
    } else {
      candles = (await fetchCommodityHistory(commodity!.symbol, fetcher, capture)).candles;
    }
    raw = body;
    url = "yahoo chart API";
  }
  fs.writeFileSync(out, JSON.stringify({ asset, source, retrievedAt: new Date().toISOString(), provenance: { baseline: `${base}/${file}`, url, rawSha256: sha(raw) }, candles }) + "\n");
  console.log(file, new Date(candles.at(-1)!.time).toISOString().slice(0, 10), candles.length);
  await pause(400);
}
