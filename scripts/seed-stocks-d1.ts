import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { STOCKS, type StockDefinition } from "../lib/stocks.ts";
import { fetchYahooStockHistory } from "../lib/yahoo.ts";

const remote = process.argv.includes("--remote");
const apply = process.argv.includes("--apply");
const requested = process.argv.find(argument => argument.startsWith("--symbol="))?.slice("--symbol=".length).toUpperCase();
const selected = requested ? STOCKS.filter(stock => stock.symbol === requested) : STOCKS;
if (!selected.length) throw new Error(`Unsupported stock symbol ${requested}`);

const output = path.join(process.cwd(), "data", "cloudflare-seed");
const wrangler = path.join(process.cwd(), "node_modules", ".bin", "wrangler");
fs.mkdirSync(output, { recursive: true });

function quoted(value: string | null): string {
  return value == null ? "NULL" : `'${value.replaceAll("'", "''")}'`;
}

async function seed(stock: StockDefinition): Promise<string> {
  process.stdout.write(`Preparing ${stock.symbol} from Yahoo Finance... `);
  const result = await fetchYahooStockHistory(stock.symbol);
  const checksum = createHash("sha256").update(JSON.stringify(result.candles)).digest("hex");
  const market = `NASDAQ:${stock.symbol}`;
  const rows = result.candles.map(candle => `(${quoted(stock.id)},'yahoo','1d',${candle.time},${quoted(market)},${candle.open},${candle.high},${candle.low},${candle.close},${candle.volume},1,${quoted(result.retrievedAt)},${quoted(checksum)})`);
  const statements = [
    "PRAGMA foreign_keys=ON;",
    `DELETE FROM market_candles WHERE asset=${quoted(stock.id)} AND source='yahoo' AND timeframe='1d';`,
  ];
  for (let index = 0; index < rows.length; index += 100) {
    statements.push(`INSERT INTO market_candles (asset,source,timeframe,time,market,open,high,low,close,volume,complete,retrieved_at,raw_checksum) VALUES\n${rows.slice(index, index + 100).join(",\n")}\nON CONFLICT(asset,source,timeframe,time) DO UPDATE SET market=excluded.market,open=excluded.open,high=excluded.high,low=excluded.low,close=excluded.close,volume=excluded.volume,complete=excluded.complete,retrieved_at=excluded.retrieved_at,raw_checksum=excluded.raw_checksum;`);
  }
  const first = result.candles[0]?.time ?? null;
  const last = result.candles.at(-1)?.time ?? null;
  const metadata = JSON.stringify({ adjustment: result.adjustment, splitSignature: result.splitSignature, terms: "personal-research" });
  statements.push(`INSERT INTO provider_snapshots (asset,source,timeframe,market,retrieved_at,checksum,warning,first_candle,last_candle,candle_count) VALUES (${quoted(stock.id)},'yahoo','1d',${quoted(market)},${quoted(result.retrievedAt)},${quoted(checksum)},${quoted(metadata)},${first ?? "NULL"},${last ?? "NULL"},${result.candles.length}) ON CONFLICT(asset,source,timeframe) DO UPDATE SET market=excluded.market,retrieved_at=excluded.retrieved_at,checksum=excluded.checksum,warning=excluded.warning,first_candle=excluded.first_candle,last_candle=excluded.last_candle,candle_count=excluded.candle_count;`);
  statements.push(`INSERT INTO source_health (asset,source,checked_at,status,message,daily_last,weekly_last) VALUES (${quoted(stock.id)},'yahoo',${quoted(result.retrievedAt)},'healthy','Yahoo Finance full history seeded for personal research',${last ?? "NULL"},NULL) ON CONFLICT(asset,source) DO UPDATE SET checked_at=excluded.checked_at,status=excluded.status,message=excluded.message,daily_last=excluded.daily_last;`);
  const file = path.join(output, `stock-${stock.id}-yahoo.sql`);
  fs.writeFileSync(file, `${statements.join("\n\n")}\n`);
  console.log(`${result.candles.length.toLocaleString()} daily candles through ${result.requiredThrough}`);
  return file;
}

const files: string[] = [];
for (const stock of selected) files.push(await seed(stock));
if (apply) {
  for (const file of files) execFileSync(wrangler, ["d1", "execute", "crypto-regime-data", remote ? "--remote" : "--local", `--file=${file}`, "--config=wrangler.jsonc"], { stdio: "inherit", env: process.env });
}
console.log(`${files.length} stock seed file(s) ${apply ? `applied to ${remote ? "remote" : "local"} D1` : "written"}.`);
