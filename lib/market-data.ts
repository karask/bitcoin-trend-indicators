import type { Candle, Timeframe } from "./regimes";
import { ASSETS, marketDefinition, type AssetId, type SourceDefinition, type SourceId } from "./markets.ts";

export { ASSETS, MIN_SOURCE_CANDLES, SOURCES, marketDefinition, resolveSourceForAsset, sourcesForAsset } from "./markets.ts";
export type { AssetDefinition, AssetId, SourceDefinition, SourceId } from "./markets.ts";

export interface MarketDataset {
  asset: AssetId;
  assetLabel: string;
  source: SourceId;
  sourceLabel: string;
  market: string;
  denomination: string;
  timeframe: Timeframe;
  candles: Candle[];
  retrievedAt: string;
  checksum: string;
  provisional: Candle | null;
  stale: boolean;
  demo: boolean;
  storage: "provider" | "sqlite" | "d1" | "demo";
  warning: string | null;
  quality: {
    gaps: number;
    duplicates: number;
    malformed: number;
  };
}

export interface SpotQuote {
  asset: AssetId;
  source: SourceId;
  sourceLabel: string;
  market: string;
  denomination: string;
  price: number;
  retrievedAt: string;
}

const DAY = 86_400_000;

function asCandle(time: unknown, open: unknown, high: unknown, low: unknown, close: unknown, volume: unknown, complete = true): Candle {
  return { time: Number(time), open: Number(open), high: Number(high), low: Number(low), close: Number(close), volume: Number(volume) || 0, complete };
}

export function validateCandles(candles: Candle[], expectedStep: number): { candles: Candle[]; gaps: number; duplicates: number; malformed: number } {
  const sorted = candles.filter(c => Number.isFinite(c.time)).sort((a, b) => a.time - b.time);
  const clean: Candle[] = [];
  let gaps = 0, duplicates = 0, malformed = 0;
  for (const candle of sorted) {
    if (![candle.open, candle.high, candle.low, candle.close].every(Number.isFinite) || candle.low > Math.min(candle.open, candle.close) || candle.high < Math.max(candle.open, candle.close) || candle.low > candle.high) {
      malformed++;
      continue;
    }
    if (clean.at(-1)?.time === candle.time) {
      duplicates++;
      clean[clean.length - 1] = candle;
      continue;
    }
    if (clean.length && candle.time - clean.at(-1)!.time > expectedStep * 1.5) gaps += Math.max(1, Math.round((candle.time - clean.at(-1)!.time) / expectedStep) - 1);
    clean.push(candle);
  }
  return { candles: clean, gaps, duplicates, malformed };
}

const rawCache = new Map<string, { expires: number; promise: Promise<Candle[]> }>();

function cached(key: string, loader: () => Promise<Candle[]>): Promise<Candle[]> {
  const existing = rawCache.get(key);
  if (existing && existing.expires > Date.now()) return existing.promise;
  const promise = loader().catch(error => { rawCache.delete(key); throw error; });
  rawCache.set(key, { expires: Date.now() + 15 * 60_000, promise });
  return promise;
}

async function checksum(candles: Candle[]): Promise<string> {
  const payload = candles.map(c => [c.time, c.open, c.high, c.low, c.close, c.volume]);
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map(v => v.toString(16).padStart(2, "0")).join("");
}

async function fetchJson(url: string, headers?: Record<string, string>): Promise<unknown> {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(12_000), cache: "no-store" });
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
  return response.json();
}

export function parseSpotPrice(source: SourceId, body: unknown): number {
  const record = body as Record<string, unknown>;
  let raw: unknown;
  if (source === "bitstamp") raw = record.last;
  else if (source === "binance") raw = record.price;
  else if (source === "coinbase") raw = record.price;
  else {
    const errors = Array.isArray(record.error) ? record.error : [];
    if (errors.length) throw new Error(errors.join(", "));
    const result = record.result as Record<string, { c?: unknown[] }> | undefined;
    raw = result ? Object.values(result)[0]?.c?.[0] : undefined;
  }
  const price = Number(raw);
  if (!Number.isFinite(price) || price <= 0) throw new Error("Provider returned an invalid spot price");
  return price;
}

export async function getSpotQuote(asset: AssetId, source: SourceId): Promise<SpotQuote> {
  const sourceDef = marketDefinition(asset, source);
  const url = source === "bitstamp"
    ? `https://www.bitstamp.net/api/v2/ticker/${sourceDef.providerSymbol}/`
    : source === "binance"
      ? `https://data-api.binance.vision/api/v3/ticker/price?symbol=${sourceDef.providerSymbol}`
      : source === "kraken"
        ? `https://api.kraken.com/0/public/Ticker?pair=${sourceDef.providerSymbol}`
        : `https://api.exchange.coinbase.com/products/${sourceDef.providerSymbol}/ticker`;
  const headers = source === "coinbase" ? { "User-Agent": "Crypto-Regime-Lab/1.0" } : undefined;
  const body = await fetchJson(url, headers);
  return {
    asset,
    source,
    sourceLabel: sourceDef.label,
    market: sourceDef.market,
    denomination: sourceDef.denomination,
    price: parseSpotPrice(source, body),
    retrievedAt: new Date().toISOString(),
  };
}

async function bitstampDaily(sourceDef: SourceDefinition): Promise<Candle[]> {
  const found = new Map<number, Candle>();
  let end = Math.floor(Date.now() / 1000);
  const pages = Math.min(20, Math.ceil((Date.now() - sourceDef.historyStart) / (1000 * DAY)) + 1);
  for (let page = 0; page < pages; page++) {
    const url = `https://www.bitstamp.net/api/v2/ohlc/${sourceDef.providerSymbol}/?step=86400&limit=1000&end=${end}&exclude_current_candle=true`;
    const body = await fetchJson(url) as { data?: { ohlc?: Array<Record<string, string>> } };
    const rows = body.data?.ohlc ?? [];
    for (const row of rows) {
      const candle = asCandle(Number(row.timestamp) * 1000, row.open, row.high, row.low, row.close, row.volume);
      found.set(candle.time, candle);
    }
    if (rows.length < 1000) break;
    end = Math.min(...rows.map(row => Number(row.timestamp))) - 1;
  }
  return [...found.values()];
}

async function binanceDaily(sourceDef: SourceDefinition): Promise<Candle[]> {
  const found: Candle[] = [];
  let startTime = sourceDef.historyStart;
  for (let page = 0; page < 20; page++) {
    const url = `https://data-api.binance.vision/api/v3/klines?symbol=${sourceDef.providerSymbol}&interval=1d&limit=1000&startTime=${startTime}`;
    const rows = await fetchJson(url) as Array<Array<number | string>>;
    if (!rows.length) break;
    for (const row of rows) found.push(asCandle(row[0], row[1], row[2], row[3], row[4], row[5]));
    startTime = Number(rows.at(-1)![0]) + DAY;
    if (rows.length < 1000 || startTime >= Date.now() - DAY) break;
  }
  const today = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  return found.filter(c => c.time < today);
}

async function krakenCandles(sourceDef: SourceDefinition, timeframe: Timeframe): Promise<Candle[]> {
  const interval = timeframe === "1w" ? 10080 : 1440;
  const body = await fetchJson(`https://api.kraken.com/0/public/OHLC?pair=${sourceDef.providerSymbol}&interval=${interval}`) as { error?: string[]; result?: Record<string, unknown> };
  if (body.error?.length) throw new Error(body.error.join(", "));
  const key = Object.keys(body.result ?? {}).find(k => k !== "last");
  const rows = key ? body.result?.[key] as Array<Array<number | string>> : [];
  return rows.slice(0, -1).map(row => asCandle(Number(row[0]) * 1000, row[1], row[2], row[3], row[4], row[6]));
}

async function coinbaseDaily(sourceDef: SourceDefinition): Promise<Candle[]> {
  const found = new Map<number, Candle>();
  let end = new Date(Date.now() - DAY);
  const pages = Math.min(30, Math.ceil((Date.now() - sourceDef.historyStart) / (299 * DAY)) + 1);
  for (let page = 0; page < pages; page++) {
    const start = new Date(end.getTime() - 299 * DAY);
    const params = new URLSearchParams({ granularity: "86400", start: start.toISOString(), end: end.toISOString() });
    const rows = await fetchJson(`https://api.exchange.coinbase.com/products/${sourceDef.providerSymbol}/candles?${params}`, { "User-Agent": "Crypto-Regime-Lab/1.0" }) as Array<Array<number>>;
    for (const row of rows) found.set(row[0] * 1000, asCandle(row[0] * 1000, row[3], row[2], row[1], row[4], row[5]));
    if (rows.length < 2) break;
    end = new Date(Math.min(...rows.map(row => row[0])) * 1000 - DAY);
    if (end.getTime() < sourceDef.historyStart) break;
  }
  return [...found.values()].filter(candle => candle.time >= sourceDef.historyStart);
}

export function aggregateWeekly(daily: Candle[]): Candle[] {
  const groups = new Map<number, Candle[]>();
  for (const candle of daily) {
    const date = new Date(candle.time);
    const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    const monday = midnight - ((date.getUTCDay() + 6) % 7) * DAY;
    const group = groups.get(monday) ?? [];
    group.push(candle);
    groups.set(monday, group);
  }
  const currentDay = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  return [...groups.entries()].sort(([a], [b]) => a - b).flatMap(([monday, rows]) => {
    const sorted = rows.sort((a, b) => a.time - b.time);
    if (monday + 7 * DAY > currentDay || sorted.length !== 7 || !sorted.every((c, i) => c.time === monday + i * DAY)) return [];
    return [{ time: monday, open: sorted[0].open, high: Math.max(...sorted.map(c => c.high)), low: Math.min(...sorted.map(c => c.low)), close: sorted[6].close, volume: sorted.reduce((sum, c) => sum + c.volume, 0), complete: true }];
  });
}

function fallbackDaily(asset: AssetId): Candle[] {
  const candles: Candle[] = [];
  const seeds: Record<AssetId, { start: number; first: number; target: number }> = {
    btc: { start: Date.UTC(2011, 7, 18), first: 10.2, target: 100_000 },
    eth: { start: Date.UTC(2015, 7, 8), first: 1.1, target: 4_000 },
    sol: { start: Date.UTC(2020, 7, 11), first: 3.0, target: 180 },
    doge: { start: Date.UTC(2019, 6, 5), first: 0.003, target: 0.2 },
    link: { start: Date.UTC(2019, 0, 16), first: 0.49, target: 20 },
    xmr: { start: Date.UTC(2014, 7, 21), first: 2.1, target: 300 },
  };
  const seed = seeds[asset];
  const start = seed.start;
  let previous = seed.first;
  const count = Math.floor((Date.now() - start) / DAY) - 1;
  for (let i = 0; i < count; i++) {
    const time = start + i * DAY;
    const trend = seed.first * Math.exp(Math.log(seed.target / seed.first) * i / count);
    const cycle = 1 + 0.34 * Math.sin(i / 195) + 0.1 * Math.sin(i / 29);
    const close = Math.max(2, trend * cycle);
    const open = previous;
    const width = close * (0.02 + 0.015 * (1 + Math.sin(i * 0.73)) / 2);
    candles.push({ time, open, high: Math.max(open, close) + width, low: Math.max(0.01, Math.min(open, close) - width), close, volume: 1000 + 500 * Math.abs(Math.sin(i / 17)), complete: true });
    previous = close;
  }
  return candles;
}

export async function getMarketData(asset: AssetId, source: SourceId, timeframe: Timeframe): Promise<MarketDataset> {
  const sourceDef = marketDefinition(asset, source);
  const assetDef = ASSETS.find(item => item.id === asset)!;
  try {
    const { readStoredDataset } = await import("./market-store.ts");
    const stored = await readStoredDataset(asset, sourceDef.id, timeframe);
    // Weekly research bars are always Monday-Sunday UTC. In particular,
    // Kraken's native weekly endpoint uses a different anchor, so an older
    // cache containing native bars must be rebuilt from its daily candles.
    if (stored && (timeframe !== "1w" || stored.candles.every(item => new Date(item.time).getUTCDay() === 1))) return stored;
  } catch {
    // The provider remains a safe fallback if the local SQLite cache is unavailable.
  }
  let raw: Candle[] = [], demo = false, warning: string | null = null;
  try {
    const cacheKey = `${asset}-${source}-daily`;
    raw = source === "bitstamp"
      ? await cached(cacheKey, () => bitstampDaily(sourceDef))
      : source === "binance"
        ? await cached(cacheKey, () => binanceDaily(sourceDef))
        : source === "kraken"
          ? await cached(cacheKey, () => krakenCandles(sourceDef, "1d"))
          : await cached(cacheKey, () => coinbaseDaily(sourceDef));
    if (raw.length < (timeframe === "1w" ? 120 : 250)) throw new Error(`Only ${raw.length} completed candles were returned`);
  } catch (error) {
    demo = true;
    raw = fallbackDaily(asset);
    warning = `Live ${sourceDef.label} data was unavailable. Deterministic demonstration history is shown and cannot confirm a new flip. ${error instanceof Error ? error.message : "Unknown provider error"}`;
  }

  const checkedDaily = validateCandles(raw, DAY);
  let candles = timeframe === "1w" ? aggregateWeekly(checkedDaily.candles) : checkedDaily.candles;
  const checkedFinal = validateCandles(candles, timeframe === "1w" ? 7 * DAY : DAY);
  candles = checkedFinal.candles;
  const malformed = checkedDaily.malformed + checkedFinal.malformed;
  const duplicates = checkedDaily.duplicates + checkedFinal.duplicates;
  const gaps = checkedDaily.gaps + checkedFinal.gaps;
  if (!demo && (malformed || duplicates || gaps)) warning = `Data-quality warning: ${gaps} gap(s), ${duplicates} duplicate(s), ${malformed} malformed candle(s). No prices were forward-filled.`;
  const lastTime = candles.at(-1)?.time ?? 0;
  const maxAge = timeframe === "1d" ? 3 * DAY : 14 * DAY;
  const stale = demo || Date.now() - lastTime > maxAge;
  const dataset: MarketDataset = {
    asset,
    assetLabel: assetDef.label,
    source: sourceDef.id,
    sourceLabel: sourceDef.label,
    market: sourceDef.market,
    denomination: sourceDef.denomination,
    timeframe,
    candles,
    retrievedAt: new Date().toISOString(),
    checksum: await checksum(candles),
    provisional: null,
    stale,
    demo,
    storage: demo ? "demo" : "provider",
    warning,
    quality: { gaps, duplicates, malformed },
  };
  if (!dataset.demo) {
    try {
      const { persistDataset } = await import("./market-store.ts");
      await persistDataset(dataset);
    } catch (error) {
      dataset.warning = dataset.warning ?? `Local SQLite cache unavailable; this response came directly from ${sourceDef.label}. ${error instanceof Error ? error.message : "Unknown storage error"}`;
    }
  }
  return dataset;
}
