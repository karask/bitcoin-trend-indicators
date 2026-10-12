/** Replays the October 3/5/9/12 daily charts with the applied presets and writes lib/kk-october12-evidence.ts. */
import fs from "node:fs";
import { calculateIndicators, kkSupertrendPreset, type Candle, type IndicatorCalculationOptions } from "../lib/regimes.ts";
import type { AssetId } from "../lib/markets.ts";
import type { StockId } from "../lib/stocks.ts";
import type { CommodityId } from "../lib/commodities.ts";

const read = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));
const day = (t: number | null) => t == null ? null : new Date(t).toISOString().slice(0, 10);
type Ref = { date: string; fixture: string; through: string; target: number; targetState: "bull" | "bear"; targetLastFlip: string | null };
const refs = new Map<string, Ref[]>();
const add = (asset: string, ref: Ref) => { if (fs.existsSync(ref.fixture)) refs.set(asset, [...(refs.get(asset) ?? []), ref]); };
// JUP charts use Binance JUP/USDT; every other asset has one archived venue per batch.
const preferred = (rows: { asset: string; source: string }[], row: { asset: string; source: string }) => row.asset !== "jup" || row.source === "binance" || !rows.some(r => r.asset === "jup" && r.source === "binance");
const o3 = new Map(read("research/kk-2026-10-03/observations.json").charts.map((c: { asset: string; imageLastFlipDate: string | null }) => [c.asset, c.imageLastFlipDate]));
const crypto3 = read("research/kk-2026-10-03/crypto/candidates.json");
for (const r of crypto3) if (r.target != null && preferred(crypto3, r)) add(r.asset, { date: "2026-10-03", fixture: r.fixture, through: r.primaryThrough, target: r.target, targetState: r.targetState, targetLastFlip: (o3.get(r.asset) as string | null) ?? null });
for (const r of read("research/kk-2026-10-03/stocks/candidates.json").observations) if (r.target != null) add(r.asset, { date: "2026-10-03", fixture: `research/kk-2026-10-03/stocks/${r.asset}-yahoo.json`, through: r.through, target: r.target, targetState: r.targetState, targetLastFlip: (o3.get(r.asset) as string | null) ?? null });
const c5 = read("research/kk-2026-10-05/candidates.json");
for (const r of c5) if (r.target != null && preferred(c5, r)) add(r.asset, { date: "2026-10-05", fixture: r.fixture, through: r.through, target: r.target, targetState: r.targetState, targetLastFlip: r.targetLastFlip });
for (const [date, through] of [["2026-10-09", { crypto: "2026-10-08", other: "2026-10-08" }], ["2026-10-12", { crypto: "2026-10-11", other: "2026-10-09" }]] as const) {
  const dir = `research/kk-${date}`;
  for (const c of read(`${dir}/observations.json`).charts) {
    const file = fs.readdirSync(dir).find(name => name.startsWith(`${c.asset}-`) && name.endsWith(".json") && (c.asset !== "jup" || name.includes("binance")))!;
    add(c.asset, { date, fixture: `${dir}/${file}`, through: c.assetClass === "crypto" ? through.crypto : through.other, target: c.target, targetState: c.targetState, targetLastFlip: c.targetLastFlip });
  }
}

const latest = read("research/kk-2026-10-12/observations.json").charts;
const rows = latest.map((c: { asset: string; assetClass: "crypto" | "stock" | "commodity"; image: string; imageSha256: string }) => {
  const options: IndicatorCalculationOptions = c.assetClass === "crypto" ? { asset: c.asset as AssetId } : c.assetClass === "stock" ? { market: "equity", stock: c.asset as StockId } : { market: "commodity", commodity: c.asset as CommodityId };
  const preset = kkSupertrendPreset("1d", options);
  const checks = refs.get(c.asset)!.map(ref => {
    const candles = (read(ref.fixture).candles as Candle[]).filter(x => x.complete !== false && day(x.time)! <= ref.through);
    const kk = calculateIndicators(candles, "1d", { ...options, indicatorIds: ["kk_supertrend"] })[0];
    const value = kk.values.supertrend as number;
    return { date: ref.date, fixture: ref.fixture, through: ref.through, target: ref.target, targetState: ref.targetState, targetLastFlip: ref.targetLastFlip, value, state: kk.state, errorPct: 100 * (value / ref.target - 1), lastFlip: day(kk.lastFlip) };
  });
  const fits = checks.every(x => x.state === x.targetState && Math.abs(x.errorPct) < 1);
  const status = fits ? "october-fit" : c.assetClass === "crypto" ? "tier" : "unresolved";
  const worst = Math.max(...checks.map(x => x.state === x.targetState ? Math.abs(x.errorPct) : Infinity));
  const note = fits ? `All ${checks.length} October charts within 1% (worst ${worst.toFixed(2)}%).`
    : status === "tier" ? `No setting fits all ${checks.length} October charts within 1%; uses the market-cap tier ${preset.atrLength}/${preset.factor} (worst ${Number.isFinite(worst) ? worst.toFixed(2) + "%" : "wrong state"}).`
    : `No setting fits all ${checks.length} October charts within 1%; earlier preset ${preset.atrLength}/${preset.factor} retained (worst ${Number.isFinite(worst) ? worst.toFixed(2) + "%" : "wrong state"}).`;
  return { asset: c.asset, assetClass: c.assetClass, timeframe: "1d", reviewedAt: "2026-10-12", captureDate: "2026-10-12", image: c.image, imageSha256: c.imageSha256, preset, status, note, checks };
});
fs.writeFileSync("lib/kk-october12-evidence.ts", "/** Generated by scripts/apply-kk-october12-evidence.ts: October 3/5/9/12 daily charts replayed with the applied presets. */\nexport const KK_OCTOBER12_EVIDENCE = " + JSON.stringify(rows, null, 2) + " as const;\n");
console.log(rows.map((r: { asset: string; status: string; preset: { atrLength: number; factor: number } }) => `${r.asset}:${r.status}:${r.preset.atrLength}/${r.preset.factor}`).join(" "));
