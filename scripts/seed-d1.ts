import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ASSETS, SOURCES, type SourceDefinition } from "../lib/markets.ts";
import { getMarketData, type MarketDataset } from "../lib/market-data.ts";

const all = process.argv.includes("--all");
const remote = process.argv.includes("--remote");
const apply = process.argv.includes("--apply");
const requestedAsset = process.argv.find(argument => argument.startsWith("--asset="))?.slice("--asset=".length);
const requestedSource = process.argv.find(argument => argument.startsWith("--source="))?.slice("--source=".length);
const output = path.join(process.cwd(), "data", "cloudflare-seed");
const wrangler = path.join(process.cwd(), "node_modules", ".bin", "wrangler");

fs.mkdirSync(output, { recursive: true });

function quoted(value: string | null): string {
  return value == null ? "NULL" : `'${value.replaceAll("'", "''")}'`;
}

function candleStatements(dataset: MarketDataset): string[] {
  const rows = dataset.candles.map(item => `(${quoted(dataset.asset)},${quoted(dataset.source)},${quoted(dataset.timeframe)},${item.time},${quoted(dataset.market)},${item.open},${item.high},${item.low},${item.close},${item.volume},${item.complete ? 1 : 0},${quoted(dataset.retrievedAt)},${quoted(dataset.checksum)})`);
  const statements: string[] = [`DELETE FROM market_candles WHERE asset=${quoted(dataset.asset)} AND source=${quoted(dataset.source)} AND timeframe=${quoted(dataset.timeframe)};`];
  for (let index = 0; index < rows.length; index += 100) {
    statements.push(`INSERT INTO market_candles (asset,source,timeframe,time,market,open,high,low,close,volume,complete,retrieved_at,raw_checksum) VALUES\n${rows.slice(index, index + 100).join(",\n")}\nON CONFLICT(asset,source,timeframe,time) DO UPDATE SET market=excluded.market,open=excluded.open,high=excluded.high,low=excluded.low,close=excluded.close,volume=excluded.volume,complete=excluded.complete,retrieved_at=excluded.retrieved_at,raw_checksum=excluded.raw_checksum;`);
  }
  const first = dataset.candles[0]?.time ?? null;
  const last = dataset.candles.at(-1)?.time ?? null;
  statements.push(`INSERT INTO provider_snapshots (asset,source,timeframe,market,retrieved_at,checksum,warning,first_candle,last_candle,candle_count) VALUES (${quoted(dataset.asset)},${quoted(dataset.source)},${quoted(dataset.timeframe)},${quoted(dataset.market)},${quoted(dataset.retrievedAt)},${quoted(dataset.checksum)},${quoted(dataset.warning)},${first ?? "NULL"},${last ?? "NULL"},${dataset.candles.length}) ON CONFLICT(asset,source,timeframe) DO UPDATE SET market=excluded.market,retrieved_at=excluded.retrieved_at,checksum=excluded.checksum,warning=excluded.warning,first_candle=excluded.first_candle,last_candle=excluded.last_candle,candle_count=excluded.candle_count;`);
  return statements;
}

async function seed(definition: SourceDefinition): Promise<string | null> {
  process.stdout.write(`Preparing ${definition.market} from ${definition.label}... `);
  const [daily, weekly] = await Promise.all([
    getMarketData(definition.asset, definition.id, "1d"),
    getMarketData(definition.asset, definition.id, "1w"),
  ]);
  if (daily.demo || weekly.demo) {
    console.log("skipped (provider unavailable)");
    return null;
  }
  if (daily.quality.gaps || daily.quality.duplicates || daily.quality.malformed || weekly.quality.gaps || weekly.quality.duplicates || weekly.quality.malformed) {
    console.log("skipped (quality failure)");
    return null;
  }
  const checkedAt = new Date().toISOString();
  const statements = [
    "PRAGMA foreign_keys=ON;",
    ...candleStatements(daily),
    ...candleStatements(weekly),
    `INSERT INTO source_health (asset,source,checked_at,status,message,daily_last,weekly_last) VALUES (${quoted(definition.asset)},${quoted(definition.id)},${quoted(checkedAt)},'healthy','Full history seeded locally with checksum provenance',${daily.candles.at(-1)?.time ?? "NULL"},${weekly.candles.at(-1)?.time ?? "NULL"}) ON CONFLICT(asset,source) DO UPDATE SET checked_at=excluded.checked_at,status=excluded.status,message=excluded.message,daily_last=excluded.daily_last,weekly_last=excluded.weekly_last;`,
  ];
  const file = path.join(output, `${definition.asset}-${definition.id}.sql`);
  fs.writeFileSync(file, `${statements.join("\n\n")}\n`);
  console.log(`${daily.candles.length.toLocaleString()} daily + ${weekly.candles.length.toLocaleString()} weekly candles`);
  return file;
}

const selected = requestedAsset || requestedSource
  ? SOURCES.filter(definition => (!requestedAsset || definition.asset === requestedAsset) && (!requestedSource || definition.id === requestedSource))
  : all
    ? SOURCES
    : ASSETS.map(asset => SOURCES.find(source => source.asset === asset.id && source.id === asset.defaultSource)!);
if (!selected.length) throw new Error(`No market matches asset=${requestedAsset ?? "*"} source=${requestedSource ?? "*"}`);
const files: string[] = [];
for (const definition of selected) {
  const file = await seed(definition);
  if (file) files.push(file);
}

if (!files.length) throw new Error("No provider histories passed validation; D1 was not changed");

if (apply) {
  for (const file of files) {
    execFileSync(wrangler, ["d1", "execute", "crypto-regime-data", remote ? "--remote" : "--local", `--file=${file}`, "--config=wrangler.jsonc"], { stdio: "inherit", env: process.env });
  }
}

console.log(`${files.length} seed file(s) ${apply ? `applied to ${remote ? "remote" : "local"} D1` : `written to ${path.relative(process.cwd(), output)}`}.`);
