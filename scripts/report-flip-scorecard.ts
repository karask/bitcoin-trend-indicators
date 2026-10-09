// Cross-asset flip scorecard from the archived October 5 histories.
// Usage: node --experimental-strip-types scripts/report-flip-scorecard.ts [fixtureDir] [outDir]
import fs from "node:fs";
import path from "node:path";
import { calculateIndicators, type Candle, type IndicatorCalculationOptions, type MarketContext, type Timeframe } from "../lib/regimes.ts";
import { buildResearch } from "../lib/research.ts";
import { aggregateWeekly, type AssetId } from "../lib/market-data.ts";
import { aggregateStockWeeks, STOCKS, type StockId } from "../lib/stocks.ts";
import { aggregateCommodityWeeks, COMMODITIES, type CommodityId } from "../lib/commodities.ts";
import type { FlipScorecard } from "../lib/flip-scorecard.ts";

const fixtureDir = process.argv[2] ?? "research/kk-2026-10-05";
const outDir = process.argv[3] ?? "research/flip-scorecard-2026-10-09";
const asOf = Date.parse("2026-10-06T00:00:00Z");
const stockIds = new Set<string>(STOCKS.map(stock => stock.id));
const commodityIds = new Set<string>(COMMODITIES.map(commodity => commodity.id));

type Row = { asset: string; market: MarketContext; timeframe: Timeframe; start: number | null; cards: FlipScorecard[] };
const rows: Row[] = [];
const seen = new Set<string>();
for (const file of fs.readdirSync(fixtureDir).sort()) {
  const match = file.match(/^([a-z]+)-(bitstamp|coinbase|kraken|binance|yahoo)\.json$/);
  if (!match || seen.has(match[1])) continue; // one venue per asset (JUP has two archives)
  seen.add(match[1]);
  const asset = match[1];
  const market: MarketContext = commodityIds.has(asset) ? "commodity" : stockIds.has(asset) ? "equity" : "crypto";
  const daily: Candle[] = JSON.parse(fs.readFileSync(path.join(fixtureDir, file), "utf8")).candles.filter((candle: Candle) => candle.complete);
  const weekly = market === "crypto" ? aggregateWeekly(daily) : market === "equity" ? aggregateStockWeeks(daily, asOf) : aggregateCommodityWeeks(daily, asOf);
  const options: IndicatorCalculationOptions = market === "crypto" ? { asset: asset as AssetId } : market === "equity" ? { market, stock: asset as StockId } : { market, commodity: asset as CommodityId };
  for (const [timeframe, candles] of [["1d", daily], ["1w", weekly]] as const) {
    const research = buildResearch(candles, calculateIndicators(candles, timeframe, options), "kk_supertrend", timeframe, { market });
    rows.push({ asset, market, timeframe, start: research.start, cards: research.scorecards });
  }
}

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const pct = (value: number | null) => value == null ? "—" : `${(value * 100).toFixed(1)}%`;
const numbers = (values: Array<number | null | undefined>) => values.filter((value): value is number => value != null);

function summarize(selection: Row[]) {
  const ids = [...new Set(selection.flatMap(row => row.cards.map(card => card.indicatorId)))];
  return ids.map(id => {
    const cards = selection.flatMap(row => row.cards.filter(card => card.indicatorId === id));
    const mid = (card: FlipScorecard, side: "bull" | "bear") => card[side].horizons[card[side].horizons.length >> 1];
    const flipsPerAsset = cards.map(card => card.bull.flips + card.bear.flips);
    const buyRight = median(numbers(cards.map(card => mid(card, "bull").hitRate)));
    const sellRight = median(numbers(cards.map(card => mid(card, "bear").hitRate)));
    return {
      id, name: cards[0].displayName, assets: cards.length,
      flipsPerAsset: median(flipsPerAsset),
      buyRight, afterBuy: median(numbers(cards.map(card => mid(card, "bull").medianReturn))),
      sellRight, afterSell: median(numbers(cards.map(card => mid(card, "bear").medianReturn))),
      quickReversals: median(numbers(cards.flatMap(card => [card.bull.whipsawRate, card.bear.whipsawRate]))),
      buyLag: median(numbers(cards.map(card => card.bull.medianLagPct))),
      sellLag: median(numbers(cards.map(card => card.bear.medianLagPct))),
      score: buyRight == null || sellRight == null ? null : (buyRight + sellRight) / 2,
    };
  }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

const groups: Array<{ title: string; timeframe: Timeframe; market?: MarketContext; horizon: string }> = [
  { title: "Daily · all assets", timeframe: "1d", horizon: "30 bars" },
  { title: "Daily · crypto", timeframe: "1d", market: "crypto", horizon: "30 days" },
  { title: "Daily · stocks", timeframe: "1d", market: "equity", horizon: "30 sessions" },
  { title: "Weekly · all assets", timeframe: "1w", horizon: "13 weeks" },
  { title: "Weekly · crypto", timeframe: "1w", market: "crypto", horizon: "13 weeks" },
  { title: "Weekly · stocks", timeframe: "1w", market: "equity", horizon: "13 weeks" },
];
const results = groups.map(group => ({ ...group, rows: summarize(rows.filter(row => row.timeframe === group.timeframe && (!group.market || row.market === group.market))) }));

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify({ generatedFrom: fixtureDir, perAsset: rows, groups: results }));
const table = (group: typeof results[number]) => [
  `### ${group.title} (right = after ${group.horizon})`, "",
  "| Model | Assets | Flips/asset | Buys right | After buy | Sells right | After sell | Quick reversals | Buy lag | Sell lag |",
  "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
  ...group.rows.map(row => `| ${row.name} | ${row.assets} | ${row.flipsPerAsset ?? "—"} | ${pct(row.buyRight)} | ${pct(row.afterBuy)} | ${pct(row.sellRight)} | ${pct(row.afterSell)} | ${pct(row.quickReversals)} | ${pct(row.buyLag)} | ${pct(row.sellLag)} |`),
  "",
].join("\n");
fs.writeFileSync(path.join(outDir, "TABLES.md"), results.map(table).join("\n"));
console.log(`${rows.length} asset/timeframe series scored → ${outDir}`);
