/** Fixed-date October 3 daily stock calibration; provider requests are sequential and cached. */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { STOCKS, type StockId } from "../lib/stocks.ts";
import { fetchYahooStockHistory } from "../lib/yahoo.ts";
import { calculateIndicators, type Candle } from "../lib/regimes.ts";

const root = "research/kk-2026-10-03/stocks", rawRoot = "data/kk-research-2026-10-03/stocks";
const imageRoot = "/tmp/kk-charts-audit-XLo7Ux/TradingView-MoneyLine";
const cutoff = Date.UTC(2026, 9, 4), fetchRequested = process.argv.includes("--fetch");
const reviewedAt = "2026-10-04", imageCaptureDate = "2026-10-03";
const family = [[10, 3], [15, 3], [15, 4], [30, 2], [30, 4], [50, 6]] as const;
// Freeze the deployed baseline so rerunning research after preset edits preserves comparisons.
const previousPresets: Record<StockId, [number, number]> = {
  tsla: [30, 4], googl: [15, 3], nvda: [30, 2], spcx: [15, 4], mu: [15, 3], sndk: [30, 4],
  bmnr: [15, 3], mstr: [10, 3], crcl: [50, 6], intc: [10, 3], mrvl: [10, 3], amd: [10, 3],
  amzn: [10, 3], meta: [10, 3], bot: [10, 3], strc: [30, 4], pltr: [10, 3],
};
const observations: [StockId, number, "bull" | "bear"][] = [
  ["tsla", 311.71, "bull"], ["googl", 370.44, "bear"], ["nvda", 225.58, "bear"],
  ["spcx", 115.88, "bull"], ["mu", 845.10, "bull"], ["sndk", 1249.03, "bull"],
  ["bmnr", 21.51, "bull"], ["mstr", 125.30, "bull"], ["crcl", 57.74, "bull"],
  ["intc", 99.80, "bull"], ["mrvl", 206.14, "bull"], ["amd", 540.92, "bull"],
  ["amzn", 233.26, "bull"], ["meta", 713.35, "bull"], ["bot", 18.62, "bull"],
  ["strc", 95.31, "bull"], ["pltr", 160.21, "bull"],
];
fs.mkdirSync(root, { recursive: true });
fs.mkdirSync(rawRoot, { recursive: true });
const date = (t: number | null | undefined) => t == null ? null : new Date(t).toISOString().slice(0, 10);
const previousSeptember21 = JSON.parse(fs.readFileSync("research/kk-2026-09-21-archives/results.json", "utf8")) as { asset: string; timeframe: string; target: number; state: "bull" | "bear"; pending?: number }[];
const previousSeptember28 = JSON.parse(fs.readFileSync("research/kk-2026-09-28/observations.json", "utf8")) as { asset: string; timeframe: string; target: number; targetState: "bull" | "bear" }[];
const imageAudit = JSON.parse(fs.readFileSync("research/kk-2026-10-03/observations.json", "utf8")) as { charts: { asset: string; visualLastOfficialFlipWindow: string | null; notes: string[] }[] };
const results = [];
for (const [index, [asset, target, targetState]] of observations.entries()) {
  const stock = STOCKS.find(s => s.id === asset)!;
  const rawFile = `${rawRoot}/${asset}-yahoo-raw.json`, metadataFile = `${rawRoot}/${asset}-provenance.json`;
  if (!fs.existsSync(rawFile)) {
    if (!fetchRequested) throw new Error(`Missing ${rawFile}; explicitly pass --fetch to download history`);
    let rawText = "";
    const history = await fetchYahooStockHistory(stock.symbol, async (url, init) => {
      const response = await fetch(url, init);
      rawText = await response.clone().text();
      return response;
    }, cutoff);
    fs.writeFileSync(rawFile, rawText + "\n");
    fs.writeFileSync(metadataFile, JSON.stringify({ asset, symbol: stock.symbol, source: "yahoo", adjustment: history.adjustment, requestedAt: new Date().toISOString(), asOf: new Date(cutoff).toISOString(), requestedStart: history.requestedStart, requiredThrough: history.requiredThrough, quality: history.quality, splitSignature: history.splitSignature }, null, 2) + "\n");
    if (index !== observations.length - 1) await new Promise(resolve => setTimeout(resolve, 800));
  }
  const raw = fs.readFileSync(rawFile, "utf8"), provenance = JSON.parse(fs.readFileSync(metadataFile, "utf8"));
  const history = await fetchYahooStockHistory(stock.symbol, async () => new Response(raw, { status: 200 }), cutoff);
  const candles = history.candles;
  if (date(candles.at(-1)?.time) !== "2026-10-02") throw new Error(`${asset} history does not reach the fixed October 2 session`);
  const image = `${String(index + 21).padStart(2, "0")}-${stock.symbol}.jpg`;
  const imagePath = `${imageRoot}/${image}`;
  const fixture = { asset, source: "yahoo", adjustment: history.adjustment, timeframe: "1d", reviewedAt, imageCaptureDate, cutoff: new Date(cutoff).toISOString(), through: "2026-10-02", retrievedAt: provenance.requestedAt, rawFile, rawSha256: createHash("sha256").update(raw).digest("hex"), splitSignature: history.splitSignature, quality: history.quality, candles };
  fs.writeFileSync(`${root}/${asset}-yahoo.json`, JSON.stringify(fixture) + "\n");
  const references = [
    ...previousSeptember21.filter(r => r.asset === asset && r.timeframe === "1d").map(r => ({ date: "2026-09-21", target: r.target, state: r.state, candles: (JSON.parse(fs.readFileSync(`research/kk-2026-09-21-archives/${asset}-yahoo.json`, "utf8")) as { candles: Candle[] }).candles })),
    ...previousSeptember28.filter(r => r.asset === asset && r.timeframe === "1d").map(r => ({ date: "2026-09-28", target: r.target, state: r.targetState, candles: (JSON.parse(fs.readFileSync(`research/kk-2026-09-28/${asset}.json`, "utf8")) as { daily: Candle[] }).daily })),
  ];
  function score(input: Candle[], atrLength: number, factor: number, level = target, state = targetState) {
    const signal = calculateIndicators(input, "1d", { market: "equity", stock: asset, indicatorIds: ["kk_supertrend"], kkSupertrendAtrLength: atrLength, kkSupertrendFactor: factor })[0];
    const value = signal.values.supertrend;
    return { atrLength, factor, value, state: signal.state, stateMatch: signal.state === state, errorPct: value == null ? null : 100 * (value / level - 1), lastFlip: date(signal.lastFlip), confirmation: signal.confirmation ?? null, ready: signal.readiness?.ready ?? true };
  }
  const [previousAtrLength, previousFactor] = previousPresets[asset];
  const candidates = family.map(([atrLength, factor]) => ({ ...score(candles, atrLength, factor), priorReferences: references.map(r => ({ referenceDate: r.date, target: r.target, targetState: r.state, ...score(r.candles, atrLength, factor, r.target, r.state) })) }));
  const ranking = candidates.filter(c => c.stateMatch && c.ready && c.errorPct != null).sort((a, b) => Math.abs(a.errorPct!) - Math.abs(b.errorPct!));
  const audit = imageAudit.charts.find(r => r.asset === asset)!;
  const row = { asset, ticker: stock.ticker, timeframe: "1d", image, imageSha256: fs.existsSync(imagePath) ? createHash("sha256").update(fs.readFileSync(imagePath)).digest("hex") : null, reviewedAt, imageCaptureDate, target, targetState, pendingDirection: asset === "nvda" ? "bull" : null, pendingCount: null, pendingCountScored: false, visualLastOfficialFlipWindow: audit.visualLastOfficialFlipWindow, notes: audit.notes, through: "2026-10-02", source: "yahoo", adjustment: history.adjustment, bars: candles.length, quality: history.quality, current: score(candles, previousAtrLength, previousFactor), bestStateMatch: ranking[0] ?? null, candidates };
  results.push(row);
  console.log(asset.toUpperCase(), "current", `${row.current.atrLength}/${row.current.factor}`, row.current.state, row.current.value?.toFixed(5), row.current.errorPct?.toFixed(3) + "%", "best", row.bestStateMatch ? `${row.bestStateMatch.atrLength}/${row.bestStateMatch.factor} ${row.bestStateMatch.state} ${row.bestStateMatch.value?.toFixed(5)} ${row.bestStateMatch.errorPct?.toFixed(3)}%` : "no state match");
}
fs.writeFileSync(`${root}/candidates.json`, JSON.stringify({ reviewedAt, imageCaptureDate, asOf: new Date(cutoff).toISOString(), timeframe: "1d", officialConfirmationCloses: 5, family, observations: results }, null, 2) + "\n");
