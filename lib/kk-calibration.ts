import { calculateIndicators, KK_SUPERTREND_PRESETS, type Candle, type Timeframe } from "./regimes.ts";
import type { AssetId } from "./markets.ts";
import { ETH_KK_CALIBRATION, SOL_KK_CALIBRATION, XMR_KK_CALIBRATION, DOGE_KK_CALIBRATION, LINK_KK_CALIBRATION, SUI_KK_CALIBRATION, type OhlcRow } from "./kk-reference-data.ts";

export const KK_CALIBRATION_VERSION = "2026-09-06";
type Reference = { id: string; asset: AssetId; label: string; venue: string; denomination: string; start: number; rows: readonly OhlcRow[]; target: number; state: "bull" | "bear"; flipCandle: number; tolerance: number; previous: { atrLength: number; factor: number }; reason: string };
export const KK_REFERENCES: Reference[] = [
  { id: "eth-original", asset: "eth", label: "Original ETH weekly reference", venue: "Bitfinex", denomination: "USD", start: Date.UTC(2025, 0, 20), rows: ETH_KK_CALIBRATION, target: 1709.38, state: "bull", flipCandle: Date.UTC(2026, 7, 17), tolerance: .01, previous: { atrLength: 10, factor: 3 }, reason: "Multiplier 3 → 2, ATR unchanged: a closer trail reproduces the bullish state and bearish reversal level." },
  { id: "sol-original", asset: "sol", label: "Original SOL weekly reference", venue: "Coinbase", denomination: "USD", start: Date.UTC(2024, 8, 23), rows: SOL_KK_CALIBRATION, target: 65.89, state: "bull", flipCandle: Date.UTC(2026, 7, 17), tolerance: .01, previous: { atrLength: 10, factor: 3 }, reason: "Multiplier 3 → 2, ATR unchanged: matches a bullish state with the reversal below price." },
  { id: "sol-later", asset: "sol", label: "Later SOL weekly reference · sol-weekly-supertrend.png", venue: "Coinbase", denomination: "USD", start: Date.UTC(2024, 8, 23), rows: [...SOL_KK_CALIBRATION, [95.44, 110.65, 93.22, 101.75]], target: 78.07, state: "bull", flipCandle: Date.UTC(2026, 7, 17), tolerance: .01, previous: { atrLength: 10, factor: 2 }, reason: "No change needed. The later candle raises the existing 10/2 trail; this is a later-reference check, not a new fit." },
  { id: "xmr-weekly", asset: "xmr", label: "xmr-super.png", venue: "Kraken", denomination: "USD", start: Date.UTC(2025, 6, 7), rows: XMR_KK_CALIBRATION, target: 350.93, state: "bull", flipCandle: Date.UTC(2026, 7, 24), tolerance: .05, previous: { atrLength: 10, factor: 3 }, reason: "ATR 10 → 15 and multiplier 3 → 2: smoother volatility and a closer trail reproduce the bullish reversal and approximate level." },
  { id: "doge-weekly", asset: "doge", label: "doge-weekly-supertrend.png", venue: "Poloniex", denomination: "USDT", start: Date.UTC(2024, 4, 13), rows: DOGE_KK_CALIBRATION, target: .097006, state: "bear", flipCandle: Date.UTC(2025, 10, 3), tolerance: .00002, previous: { atrLength: 10, factor: 3 }, reason: "ATR 10 → 15 and multiplier 3 → 2: moves the bearish regime's bullish reversal level toward the supplied reference." },
  { id: "link-weekly", asset: "link", label: "link-weekly-supertrend.png", venue: "Coinbase", denomination: "USD", start: Date.UTC(2024, 4, 13), rows: LINK_KK_CALIBRATION, target: 8.745, state: "bull", flipCandle: Date.UTC(2026, 7, 17), tolerance: .001, previous: { atrLength: 10, factor: 3 }, reason: "ATR 10 → 15 and multiplier 3 → 2: preserves the bullish regime while matching the reference trail more closely." },
  { id: "sui-weekly", asset: "sui", label: "sui-weekly-supertrend.png", venue: "Coinbase", denomination: "USD", start: Date.UTC(2024, 4, 13), rows: SUI_KK_CALIBRATION, target: 1.0413, state: "bear", flipCandle: Date.UTC(2025, 9, 27), tolerance: .0002, previous: { atrLength: 10, factor: 3 }, reason: "ATR 10 → 15 and multiplier 3 → 2: fits the bearish regime, reversal threshold, and historical flip timing." },
];

export function calibrationStatus(asset: AssetId | undefined, timeframe: Timeframe) {
  if (!asset) return "Uncalibrated equity preset";
  if (timeframe === "1w") return asset === "btc" ? "Legacy screenshot preset · reference not archived" : KK_REFERENCES.some(reference => reference.asset === asset) ? "Screenshot-calibrated weekly preset" : "Uncalibrated weekly preset";
  return ["btc", "eth", "sol"].includes(asset) ? "Inherited preset · no separate daily reference" : "Uncalibrated daily preset";
}

export function evaluateReference(reference: Reference) {
  const candles: Candle[] = reference.rows.map(([open, high, low, close], index) => ({ time: reference.start + index * 7 * 86_400_000, open, high, low, close, volume: 1, complete: true }));
  const options = { asset: reference.asset, indicatorIds: ["kk_supertrend"] };
  const current = calculateIndicators(candles, "1w", options)[0];
  const previous = calculateIndicators(candles, "1w", { ...options, kkSupertrendAtrLength: reference.previous.atrLength, kkSupertrendFactor: reference.previous.factor })[0];
  const value = current.values.supertrend!;
  return { reference, current, previous, value, error: value - reference.target, relativeError: (value - reference.target) / reference.target, matched: Math.abs(value - reference.target) <= reference.tolerance && current.state === reference.state && current.lastFlip === reference.flipCandle, through: candles.at(-1)!.time + 6 * 86_400_000, atrRatio: current.values.atr! / candles.at(-1)!.close, preset: KK_SUPERTREND_PRESETS[reference.asset]["1w"] };
}
