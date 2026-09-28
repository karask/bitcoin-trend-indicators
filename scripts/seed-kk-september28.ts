/** Prepare new-asset D1 seed files from audited fixtures; --apply-local persists only the two new local crypto datasets. No remote writes. */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { ASSETS, marketDefinition, minimumSourceCandles } from "../lib/markets.ts";
import { stockDefinition, STOCK_DATA_ADJUSTMENT, type StockId } from "../lib/stocks.ts";
import { persistDataset } from "../lib/market-store.ts";
import type { Candle, Timeframe } from "../lib/regimes.ts";
const root = "research/kk-2026-09-28", output = "data/cloudflare-seed";
const added = ["crcl", "vvv", "intc", "mrvl", "amd", "amzn", "meta", "qnt", "bot", "strc", "pltr"];
fs.mkdirSync(output, { recursive: true });
const quote = (s: string | null) => s == null ? "NULL" : `'${s.replaceAll("'", "''")}'`;
for (const asset of added) {
  const fixture = JSON.parse(fs.readFileSync(`${root}/${asset}.json`, "utf8")) as { source: string; retrievedAt: string; splitSignature: string | null; quality: Record<string, number>; daily: Candle[]; weekly: Candle[] };
  if (Object.values(fixture.quality).some(Boolean)) throw new Error(`${asset}: bad fixture quality`);
  const crypto = asset === "vvv" || asset === "qnt";
  const market = crypto ? marketDefinition(asset, "coinbase").market : `${stockDefinition(asset as StockId).exchange}:${asset.toUpperCase()}`;
  const retrievedAt = fixture.retrievedAt;
  if (!retrievedAt || !Number.isFinite(Date.parse(retrievedAt))) throw new Error(`${asset}: missing retrieval timestamp`);
  const metadata = crypto ? null : JSON.stringify({ adjustment: STOCK_DATA_ADJUSTMENT, splitSignature: fixture.splitSignature, terms: "personal-research" });
  const statements = ["PRAGMA foreign_keys=ON;"];
  for (const timeframe of (crypto ? ["1d", "1w"] : ["1d"]) as Timeframe[]) {
    const candles = timeframe === "1d" ? fixture.daily : fixture.weekly;
    if (!candles.length || !candles.every(c => c.complete)) throw new Error(`${asset}: empty or partial history`);
    const checksum = createHash("sha256").update(JSON.stringify(candles)).digest("hex");
    if (crypto && candles.length < minimumSourceCandles(asset, timeframe)) throw new Error(`${asset}: insufficient ${timeframe} seed`);
    statements.push(`DELETE FROM market_candles WHERE asset=${quote(asset)} AND source=${quote(fixture.source)} AND timeframe=${quote(timeframe)};`);
    const rows = candles.map(c => `(${quote(asset)},${quote(fixture.source)},${quote(timeframe)},${c.time},${quote(market)},${c.open},${c.high},${c.low},${c.close},${c.volume},1,${quote(retrievedAt)},${quote(checksum)})`);
    for (let i = 0; i < rows.length; i += 100) statements.push(`INSERT INTO market_candles (asset,source,timeframe,time,market,open,high,low,close,volume,complete,retrieved_at,raw_checksum) VALUES ${rows.slice(i, i + 100).join(",")};`);
    statements.push(`INSERT INTO provider_snapshots (asset,source,timeframe,market,retrieved_at,checksum,warning,first_candle,last_candle,candle_count) VALUES (${quote(asset)},${quote(fixture.source)},${quote(timeframe)},${quote(market)},${quote(retrievedAt)},${quote(checksum)},${quote(metadata)},${candles[0].time},${candles.at(-1)!.time},${candles.length}) ON CONFLICT(asset,source,timeframe) DO UPDATE SET market=excluded.market,retrieved_at=excluded.retrieved_at,checksum=excluded.checksum,warning=excluded.warning,first_candle=excluded.first_candle,last_candle=excluded.last_candle,candle_count=excluded.candle_count;`);
    if (crypto && process.argv.includes("--apply-local")) {
      const definition = marketDefinition(asset, "coinbase"), assetDefinition = ASSETS.find(a => a.id === asset)!;
      await persistDataset({ asset, assetLabel: assetDefinition.label, source: "coinbase", sourceLabel: definition.label, market, denomination: "USD", timeframe, candles, retrievedAt, checksum, warning: null, quality: { gaps: 0, duplicates: 0, malformed: 0 }, demo: false, stale: false, provisional: null, storage: "sqlite" });
    }
  }
  const dailyLast = fixture.daily.at(-1)!.time, weeklyLast = crypto ? fixture.weekly.at(-1)!.time : "NULL";
  statements.push(`INSERT INTO source_health (asset,source,checked_at,status,message,daily_last,weekly_last) VALUES (${quote(asset)},${quote(fixture.source)},${quote(retrievedAt)},'healthy','September 28 audited full history seed',${dailyLast},${weeklyLast}) ON CONFLICT(asset,source) DO UPDATE SET checked_at=excluded.checked_at,status=excluded.status,message=excluded.message,daily_last=excluded.daily_last,weekly_last=excluded.weekly_last;`);
  fs.writeFileSync(`${output}/september28-${asset}.sql`, statements.join("\n\n") + "\n");
  console.log(asset, fixture.daily.length, "daily", crypto ? `${fixture.weekly.length} weekly` : "stock seed");
}
