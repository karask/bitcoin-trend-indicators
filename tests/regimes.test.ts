import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { ensureMarketSchema } from "../db/index.ts";
import { ASSETS, SOURCES, aggregateWeekly, marketDefinition, parseSpotPrice, sourcesForAsset, validateCandles, type MarketDataset } from "../lib/market-data.ts";
import { backtest, calculateIndicators, INDICATOR_SPECS, KK_SUPERTREND_ATR_LENGTH, KK_SUPERTREND_FACTORS, type Candle, type SignalSnapshot } from "../lib/regimes.ts";
import { completedBoundary, confirmationClock } from "../lib/confirmation-clock.ts";
import { nearestCandleIndex, periodLabel, priceAtY, resolveInitialTheme } from "../lib/chart-interaction.ts";

const DAY = 86_400_000;

test("chart inspection snaps safely and formats confirmed periods", () => {
  assert.equal(nearestCandleIndex(-50, 10, 500, 100), 0);
  assert.equal(nearestCandleIndex(260, 10, 500, 100), 50);
  assert.equal(nearestCandleIndex(999, 10, 500, 100), 99);
  assert.equal(nearestCandleIndex(10, 10, 0, 100), -1);
  assert.equal(priceAtY(20, 20, 200, 100, 300), 300);
  assert.equal(priceAtY(120, 20, 200, 100, 300), 200);
  assert.equal(priceAtY(500, 20, 200, 100, 300), 100);
  assert.equal(periodLabel(Date.UTC(2026, 7, 24), "1d"), "24 Aug 2026");
  assert.equal(periodLabel(Date.UTC(2026, 7, 24), "1w"), "24 Aug 2026 – 30 Aug 2026");
  assert.equal(resolveInitialTheme("dark", false), "dark");
  assert.equal(resolveInitialTheme(null, true), "dark");
  assert.equal(resolveInitialTheme("unknown", false), "light");
});

function history(count = 900): Candle[] {
  let prior = 100;
  return Array.from({ length: count }, (_, i) => {
    const close = 100 * Math.exp(i / 1300) * (1 + 0.16 * Math.sin(i / 22) + 0.04 * Math.sin(i / 5));
    const open = prior; prior = close;
    return { time: Date.UTC(2020, 0, 6) + i * DAY, open, high: Math.max(open, close) * 1.025, low: Math.min(open, close) * 0.975, close, volume: 1000 + i, complete: true };
  });
}

test("every registered daily preset calculates a non-repainting state vector", () => {
  const candles = history();
  const results = calculateIndicators(candles, "1d");
  const expected = INDICATOR_SPECS.filter(spec => spec.supportedTimeframes.includes("1d")).map(spec => spec.id).sort();
  assert.deepEqual(results.map(result => result.id).sort(), expected);
  for (const result of results) {
    assert.equal(result.states.length, candles.length, result.id);
    assert.ok(["bull", "bear", "neutral"].includes(result.state), result.id);
  }
  const changed = history(); changed[changed.length - 1] = { ...changed.at(-1)!, high: 999, low: 1, close: 500 };
  const revised = calculateIndicators(changed, "1d");
  for (const result of results) assert.deepEqual(result.states.slice(0, -1), revised.find(item => item.id === result.id)!.states.slice(0, -1), `${result.id} repainted confirmed history`);
});

test("indicator golden states and trigger classifications remain stable", () => {
  const results = calculateIndicators(history(), "1d");
  const vector = Object.fromEntries(results.map(result => [result.id, [result.state, result.thresholdKind]]));
  assert.deepEqual(vector, {
    support_band: ["bear", "fixed"], supertrend: ["bear", "provisional"], kk_supertrend: ["bear", "provisional"], smma_ribbon: ["neutral", "conditional"], super_guppy: ["neutral", "conditional"], long_sma: ["bull", "fixed"],
    donchian_20_10: ["neutral", "fixed"], ichimoku: ["bear", "conditional"], macd: ["bear", "conditional"],
    psar: ["bear", "provisional"], vortex: ["bear", "provisional"], heikin_ashi: ["bear", "provisional"],
    golden_cross: ["bull", "conditional"], adx: ["bear", "conditional"], chandelier: ["bull", "provisional"], mayer: ["neutral", "conditional"],
  });
  const support = results.find(item => item.id === "support_band")!;
  const prior19 = history().slice(-19).reduce((sum, candle) => sum + candle.close, 0) / 19;
  assert.equal(support.bullTrigger, Math.max(prior19, support.values.ema!));
  assert.equal(support.bearTrigger, Math.min(prior19, support.values.ema!));
});

type OhlcRow = readonly [open: number, high: number, low: number, close: number];

function weeklyFixture(start: number, rows: readonly OhlcRow[]): Candle[] {
  return rows.map(([open, high, low, close], index) => ({ time: start + index * 7 * DAY, open, high, low, close, volume: 1, complete: true }));
}

// Fixed Monday–Sunday OHLC from Bitfinex ETH/USD, 20 Jan 2025–23 Aug 2026.
// The open 24 Aug week shown in the screenshot is deliberately not included.
const ETH_KK_CALIBRATION: readonly OhlcRow[] = [
  [3211.5, 3451.8, 3143.3, 3234], [3232.1, 3436, 2747.8, 2866.6], [2865.1, 2918.5, 2100, 2633.4],
  [2632.5, 2798.5, 2552.2, 2665.6], [2662.2, 2860.9, 2612.3, 2823.7], [2823.9, 2844.3, 2084.2, 2523.7],
  [2525.2, 2529.7, 1992.3, 2024.9], [2026.9, 2156.2, 1761.9, 1892], [1891.6, 2073.4, 1877.5, 2009],
  [2010.3, 2106.8, 1768.7, 1810.5], [1810.9, 1953, 1539.2, 1580.3], [1580.9, 1687.7, 1385.5, 1596.1],
  [1596.9, 1689.8, 1538.7, 1584.4], [1585.1, 1857.3, 1536, 1792.6], [1791.8, 1873.8, 1736, 1815.3],
  [1814.5, 2605.7, 1757.3, 2514.4], [2514.2, 2737.7, 2319.6, 2495.5], [2500.4, 2730, 2349.6, 2549.1],
  [2549, 2784.9, 2469, 2539.2], [2540, 2675, 2386.4, 2510.8], [2511.5, 2875.9, 2439.3, 2551.2],
  [2551.2, 2682.2, 2117.4, 2229.6], [2232.6, 2523.7, 2192.8, 2500.4], [2500.5, 2639.5, 2379.7, 2574.4],
  [2574.4, 3036, 2514.4, 2968.1], [2968.4, 3820.8, 2933.6, 3757.1], [3757.1, 3882.8, 3511.4, 3878.2],
  [3878.1, 3942.5, 3361.8, 3501.2], [3501.2, 4333, 3497.6, 4255.1], [4255, 4783.9, 4154.9, 4477.8],
  [4476.8, 4958.7, 4069.6, 4788.1], [4788, 4804.4, 4265.8, 4397.3], [4397.1, 4498.8, 4219.7, 4307.2],
  [4307.1, 4761.2, 4276.5, 4615.3], [4614.9, 4679.7, 4417.8, 4453.1], [4452.6, 4462.2, 3832, 4151.8],
  [4153, 4616.5, 4094.2, 4513.9], [4513.9, 4752.1, 3500, 4162.3], [4162.4, 4295.7, 3683.6, 3989.6],
  [3989.6, 4177, 3710.9, 4155.8], [4157.1, 4250.9, 3687.1, 3913.5], [3913.7, 3917.7, 3061.1, 3585.9],
  [3585.4, 3655.3, 3020.7, 3106.2], [3105.6, 3226.7, 2630.1, 2807.2], [2807.1, 3101.4, 2766.7, 2992.8],
  [2993.5, 3240, 2724.4, 3062.6], [3061.7, 3446.4, 2760, 3062.3], [3063.2, 3178.9, 2779.6, 3004.7],
  [3005.1, 3077.5, 2889.4, 2953.3], [2953.5, 3163, 2911.8, 3142.8], [3141.3, 3303.6, 3054.3, 3122.6],
  [3122.2, 3401.9, 3064.2, 3282.8], [3281.7, 3283.4, 2786.7, 2816.8], [2816.8, 3045.6, 2222.2, 2271.7],
  [2271.9, 2399.6, 1747, 2091.5], [2090.8, 2149, 1899, 1968.2], [1967.5, 2040.6, 1909.1, 1959.9],
  [1960.1, 2151.6, 1801.4, 1940.5], [1940.6, 2199.1, 1910.3, 1937.2], [1936.8, 2209, 1930, 2178.6],
  [2178.4, 2386.3, 2027.2, 2054.4], [2054.6, 2199.2, 1938, 1983.7], [1984.8, 2165.5, 1980.9, 2108.3],
  [2108.8, 2330, 2059.7, 2190.1], [2190.3, 2464.7, 2174, 2263.2], [2263.4, 2423.7, 2260.5, 2370.7],
  [2370.9, 2405.5, 2221.4, 2322.1], [2322.2, 2422.4, 2263.7, 2369.4], [2370.5, 2373.1, 2089, 2130.7],
  [2130.8, 2159, 2009.1, 2101.7], [2101.9, 2142.9, 1967.2, 2007.9], [2008, 2021.6, 1507.2, 1692.8],
  [1694.6, 1729.6, 1604.4, 1722.9], [1723.5, 1848.3, 1669.5, 1706.6], [1707, 1779.3, 1512.6, 1572],
  [1571.9, 1808, 1550.1, 1786.7], [1786.8, 1834.1, 1713.1, 1806.5], [1806.6, 1948.6, 1749, 1873.3],
  [1873.7, 1968, 1844.1, 1955.9], [1956.1, 1981.8, 1822.5, 1886.4], [1886.3, 1942.2, 1829.1, 1912.2],
  [1911.1, 1931.7, 1855, 1876.6], [1876.6, 2549, 1872.8, 2463.9],
];

// Fixed Monday–Sunday OHLC from Coinbase SOL/USD, 23 Sep 2024–23 Aug 2026.
const SOL_KK_CALIBRATION: readonly OhlcRow[] = [
  [144.65, 161.8, 142.13, 158.49], [158.49, 159.77, 133.1, 146.48], [146.47, 152.27, 135.36, 147.69],
  [147.72, 167.9, 146.73, 167.37], [167.34, 179.12, 159.05, 176.44], [176.43, 183.3, 157.8, 162.46],
  [162.43, 215.62, 155.01, 210.22], [210.22, 241.99, 201, 237.53], [237.5, 264.63, 230.02, 253.03],
  [253.03, 256.82, 221.57, 236.95], [236.92, 247.1, 215, 237.19], [237.19, 237.45, 203.27, 224.25],
  [224.2, 229.03, 175.01, 180.35], [180.33, 201.74, 176.33, 189.6], [189.6, 219.69, 185.54, 213.35],
  [213.35, 223.18, 182.01, 188.4], [188.4, 295, 169.22, 252.34], [252.33, 273.29, 229.19, 240.39],
  [240.36, 244.7, 192.7, 203.45], [203.49, 220.14, 176, 200.51], [200.51, 209.2, 186.01, 188.29],
  [188.29, 189.73, 160.78, 167.95], [167.95, 180, 125.36, 178.72], [178.72, 179.45, 124.7, 126.45],
  [126.48, 136.71, 112, 126.1], [126.09, 136.18, 121.69, 132.85], [132.85, 147.6, 122.68, 124.8],
  [124.81, 136.18, 103.71, 105.82], [105.81, 134.11, 95.16, 128.32], [128.32, 141.97, 123.46, 137.85],
  [137.86, 157.08, 133.82, 148.04], [148.03, 154.04, 140.4, 143.97], [143.96, 180.16, 141.34, 173.23],
  [173.22, 184.86, 164.1, 173.39], [173.39, 187.73, 159.48, 175.8], [175.81, 179.5, 150.65, 157.76],
  [157.78, 163.76, 141.53, 152.53], [152.54, 168.38, 140.89, 152.99], [153, 158.82, 126.03, 131.76],
  [131.76, 154.8, 130.72, 153.34],
  [153.34, 163.9, 144.86, 151.9], [151.9, 168.23, 147.7, 161.22], [161.22, 184.79, 157.13, 181.52],
  [181.54, 206.42, 175.73, 188.71], [188.72, 195.37, 155.75, 162.02], [162.02, 186.18, 161.15, 182.7],
  [182.71, 210, 173.42, 191.15], [191.13, 211.98, 175.65, 205.98], [205.96, 217.95, 185.41, 200.63],
  [200.62, 213, 194.2, 206.34], [206.33, 250, 205.56, 239.86], [239.85, 253.61, 230.18, 236.31],
  [236.28, 237.08, 190.82, 210.89], [210.9, 237.27, 204.25, 228.68], [228.68, 237.96, 172.78, 197.2],
  [197.2, 211.47, 174.1, 187.94], [187.94, 202.19, 177.24, 200.07], [200.05, 205.32, 178.58, 187.67],
  [187.67, 189.05, 146.44, 164.52], [164.5, 171.89, 134.34, 137.07], [137.07, 144.66, 121.47, 130.53],
  [130.54, 144.74, 128.35, 133.47], [133.48, 146.92, 123.08, 132.28], [132.28, 144.9, 128, 129.41],
  [129.39, 135.43, 116.82, 126], [126, 128.7, 119.17, 125.17], [125.17, 135.49, 122.21, 134.04],
  [134.05, 143.44, 132.54, 139.5], [139.5, 148.9, 137.62, 137.81], [137.78, 137.78, 117.12, 118.73],
  [118.73, 128.16, 96.52, 100.66], [100.67, 106.04, 67.48, 86.92], [86.93, 91.21, 76.53, 86.1],
  [86.1, 87.63, 79.58, 82.75], [82.75, 92.12, 75.63, 83.6], [83.61, 94.11, 80.25, 81.59],
  [81.6, 93.23, 81.54, 92.33], [92.33, 97.7, 85.12, 86.2], [86.2, 93.44, 79, 81.37],
  [81.37, 86.63, 76.69, 81.85], [81.86, 87, 78.36, 81.54], [81.54, 90.8, 81.4, 83.48],
  [83.5, 89.36, 83.36, 86.95], [86.96, 88.1, 81.35, 83.91], [83.9, 96.9, 83.24, 96.44],
  [96.44, 98.39, 83.41, 85.19], [85.19, 87.91, 81.31, 85.17], [85.17, 86.44, 79.88, 82.32],
  [82.31, 82.98, 60.11, 66.46], [66.47, 71.24, 62.28, 71.24], [71.24, 76.05, 67.86, 72.38],
  [72.37, 74.92, 63.94, 71.28], [71.28, 83.91, 70.24, 81.52], [81.52, 83.65, 75.6, 76.88],
  [76.86, 78.96, 73.31, 76.33], [76.33, 78.81, 73.38, 76.69], [76.71, 77.42, 70.51, 73.54],
  [73.55, 77.75, 71.88, 76.21], [76.2, 77.23, 74.09, 74.54], [74.54, 102.7, 74.36, 95.43],
];

test("KK Supertrend is registered immediately after SuperTrend with fixed asset presets", () => {
  const supertrendIndex = INDICATOR_SPECS.findIndex(spec => spec.id === "supertrend");
  const kkIndex = INDICATOR_SPECS.findIndex(spec => spec.id === "kk_supertrend");
  assert.equal(kkIndex, supertrendIndex + 1);
  assert.equal(KK_SUPERTREND_ATR_LENGTH, 10);
  assert.deepEqual(KK_SUPERTREND_FACTORS, { btc: 3, eth: 2, sol: 2 });
  assert.deepEqual(INDICATOR_SPECS[kkIndex].parameters, { atr: 10, btcFactor: 3, ethFactor: 2, solFactor: 2 });
  assert.match(INDICATOR_SPECS[kkIndex].disclaimer!, /screenshot-calibrated/i);
  assert.match(INDICATOR_SPECS[kkIndex].disclaimer!, /does not claim to reproduce/i);
});

test("KK Supertrend reproduces the ETH and SOL factor-two calibration levels", () => {
  const cases = [
    { asset: "eth", expected: 1709.38, candles: weeklyFixture(Date.UTC(2025, 0, 20), ETH_KK_CALIBRATION) },
    { asset: "sol", expected: 65.89, candles: weeklyFixture(Date.UTC(2024, 8, 23), SOL_KK_CALIBRATION) },
  ] as const;
  for (const { asset, expected, candles } of cases) {
    const result = calculateIndicators(candles, "1w", { asset }).find(item => item.id === "kk_supertrend")!;
    assert.equal(result.state, "bull", asset);
    assert.equal(Number(result.values.supertrend!.toFixed(2)), expected, `${asset} level ${result.values.supertrend}`);
    assert.equal(Number(result.bearTrigger!.toFixed(2)), expected, asset);
    assert.equal(result.bullTrigger, null, asset);
    assert.equal(result.values.factor, 2, asset);
    assert.equal(result.lastFlip, candles.at(-1)!.time, asset);
  }
});

test("BTC KK Supertrend is point-for-point identical to SuperTrend 10/3", () => {
  const results = calculateIndicators(history(), "1d", { asset: "btc" });
  const standard = results.find(item => item.id === "supertrend")!;
  const kk = results.find(item => item.id === "kk_supertrend")!;
  assert.deepEqual(kk.states, standard.states);
  assert.deepEqual(kk.overlays[0].points.map(point => [point.time, point.value]), standard.overlays[0].points.map(point => [point.time, point.value]));
  assert.equal(kk.state, standard.state);
  assert.equal(kk.lastFlip, standard.lastFlip);
  assert.equal(kk.bullTrigger, standard.bullTrigger);
  assert.equal(kk.bearTrigger, standard.bearTrigger);
  assert.deepEqual(kk.values, standard.values);
});

test("KK Supertrend is included in every asset backtest and cost-sensitivity path", () => {
  for (const asset of ASSETS.map(item => item.id)) {
    const candles = history();
    const snapshots = calculateIndicators(candles, "1d", { asset });
    const costs = [5, 15, 30].map(cost => backtest(candles, snapshots, "1d", cost).find(item => item.indicatorId === "kk_supertrend")!);
    assert.ok(costs.every(Boolean), asset);
    assert.ok(costs.every(result => result.flips > 0), asset);
    assert.ok(costs[0].totalReturn >= costs[1].totalReturn && costs[1].totalReturn >= costs[2].totalReturn, asset);
    assert.equal(costs[0].turnover, costs[1].turnover, asset);
    assert.equal(costs[1].turnover, costs[2].turnover, asset);
    if (asset === "btc") {
      const standard = backtest(candles, snapshots, "1d", 15).find(item => item.indicatorId === "supertrend")!;
      assert.deepEqual({ ...costs[1], indicatorId: standard.indicatorId, displayName: standard.displayName }, standard);
    }
  }
});

test("Super Guppy implements the published R1.2 groups, colors, and events", () => {
  const series = (direction: 1 | -1 | 0): Candle[] => Array.from({ length: 160 }, (_, index) => {
    const close = direction === 0 ? 100 : direction === 1 ? 100 + index : 300 - index;
    return { time: Date.UTC(2024, 0, 1) + index * DAY, open: close, high: close + 1, low: close - 1, close, volume: 1, complete: true };
  });
  const rising = calculateIndicators(series(1), "1d").find(item => item.id === "super_guppy")!;
  const falling = calculateIndicators(series(-1), "1d").find(item => item.id === "super_guppy")!;
  const flat = calculateIndicators(series(0), "1d").find(item => item.id === "super_guppy")!;
  assert.equal(rising.state, "bull");
  assert.equal(falling.state, "bear");
  assert.equal(flat.state, "neutral");
  assert.equal(rising.states[0], "neutral");
  assert.equal(rising.states[68], "bull");
  assert.deepEqual(rising.overlays.map(line => line.name), ["EMA 3", "EMA 5", "EMA 9", "EMA 13", "EMA 17", "EMA 21", "EMA 23", "EMA 25", "EMA 28", "EMA 34", "EMA 40", "EMA 49", "EMA 55", "EMA 70"]);
  assert.equal(rising.overlays[0].points.at(-1)?.color, "#00ffff");
  assert.equal(rising.overlays[7].points.at(-1)?.color, "#00ff00");
  assert.equal(falling.overlays[0].points.at(-1)?.color, "#0000ff");
  assert.equal(falling.overlays[7].points.at(-1)?.color, "#ff0000");
  assert.equal(flat.overlays[0].points.at(-1)?.color, "#808080");
  assert.equal(rising.ribbons.length, 2);
  assert.ok(rising.ribbons.every(ribbon => ribbon.points.length === rising.states.length));
  assert.ok(rising.ribbons.every(ribbon => ribbon.points.every(point => point.upper >= point.lower)));
  const events = calculateIndicators(history(), "1d").find(item => item.id === "super_guppy")!.events;
  assert.deepEqual(events.slice(0, 6).map(event => [(event.time - history()[0].time) / DAY, event.kind, event.direction]), [[23, "swing", "bull"], [56, "trend_break", "bear"], [71, "swing", "bear"], [109, "swing", "bear"], [127, "trend_break", "bull"], [132, "swing", "bull"]]);
  assert.ok(events.every(event => event.effectiveAt == null || event.effectiveAt > event.confirmedAt));
  const configured = calculateIndicators(history(), "1d", { superGuppy: { showSwing: false, showBreak: false, showAverages: true, showEma200: true, ema200Filter: true, colorBars: true, source: "hlc3", fastLengths: [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24], slowLengths: [26, 29, 32, 35, 38, 41, 44, 47, 50, 53, 56, 59, 62, 65, 68, 71] } }).find(item => item.id === "super_guppy")!;
  assert.equal(configured.events.length, 0);
  assert.deepEqual(configured.overlays.slice(-3).map(line => line.name), ["Trader average", "Investor average", "EMA 200"]);
  assert.equal(configured.overlays[0].name, "EMA 4");
  assert.equal(configured.barColors.length, history().length);
  assert.equal(INDICATOR_SPECS.findIndex(item => item.id === "super_guppy"), INDICATOR_SPECS.findIndex(item => item.id === "smma_ribbon") + 1);
});

test("every indicator exposes role-aware interpretation guidance", () => {
  for (const spec of INDICATOR_SPECS) {
    assert.ok(spec.guidance.summary.length > 20, spec.id);
    assert.ok(spec.guidance.positive.rule.length > 20, spec.id);
    assert.ok(spec.guidance.neutral.rule.length > 20, spec.id);
    assert.ok(spec.guidance.negative.rule.length > 20, spec.id);
    assert.ok(spec.guidance.rationale.length > 20, spec.id);
    assert.ok(spec.guidance.caveats.length, spec.id);
  }
  assert.match(INDICATOR_SPECS.find(spec => spec.id === "chandelier")!.guidance.positive.rule, /not a new-entry signal/i);
  assert.match(INDICATOR_SPECS.find(spec => spec.id === "mayer")!.guidance.summary, /does not issue entries or exits/i);
});

test("SMMA proxy renders a gold, grey, and blue range without warm-up misclassification", () => {
  const result = calculateIndicators(history(120), "1d").find(item => item.id === "smma_ribbon")!;
  assert.equal(result.ribbons.length, 1);
  assert.deepEqual(result.ribbons[0].palette, { bull: "#d7a928", neutral: "#919896", bear: "#264f66" });
  assert.equal(result.ribbons[0].points[0].time, history(120)[28].time);
  assert.ok(result.ribbons[0].points.every(point => point.upper >= point.lower));
  assert.ok(result.overlays.every(overlay => overlay.showInLegend === false));
});

test("Donchian uses prior-period channels and retains state between breakouts", () => {
  const candles: Candle[] = Array.from({ length: 70 }, (_, i) => ({ time: i * DAY, open: 100, high: i === 25 ? 120 : 105, low: i === 45 ? 80 : 95, close: i === 26 ? 121 : i === 46 ? 79 : 100, volume: 1, complete: true }));
  const result = calculateIndicators(candles, "1d").find(item => item.id === "donchian_20_10")!;
  assert.equal(result.states[26], "bull"); assert.equal(result.states[40], "bull"); assert.equal(result.states[46], "bear");
});

test("UTC aggregation admits only complete Monday-through-Sunday weeks", () => {
  const monday = Date.UTC(2024, 0, 1);
  const daily: Candle[] = Array.from({ length: 10 }, (_, i) => ({ time: monday + i * DAY, open: 100 + i, high: 102 + i, low: 99 + i, close: 101 + i, volume: 10, complete: true }));
  const weekly = aggregateWeekly(daily);
  assert.equal(weekly.length, 1);
  assert.deepEqual([weekly[0].time, weekly[0].open, weekly[0].high, weekly[0].low, weekly[0].close, weekly[0].volume], [monday, 100, 108, 99, 107, 70]);
});

test("quality validation rejects malformed bars, detects gaps and deduplicates without filling", () => {
  const rows: Candle[] = [
    { time: 0, open: 10, high: 12, low: 9, close: 11, volume: 1, complete: true },
    { time: 0, open: 10, high: 13, low: 9, close: 12, volume: 2, complete: true },
    { time: 2 * DAY, open: 12, high: 11, low: 10, close: 12, volume: 1, complete: true },
    { time: 3 * DAY, open: 12, high: 14, low: 11, close: 13, volume: 1, complete: true },
  ];
  const result = validateCandles(rows, DAY);
  assert.deepEqual({ gaps: result.gaps, duplicates: result.duplicates, malformed: result.malformed, length: result.candles.length }, { gaps: 2, duplicates: 1, malformed: 1, length: 2 });
});

test("backtest enters at the next open and charges one-way turnover", () => {
  const candles: Candle[] = [100, 100, 200, 200].map((open, i) => ({ time: i * DAY, open, high: open, low: open, close: open, volume: 1, complete: true }));
  const snapshot = { id: "test", displayName: "Test", shortName: "Test", role: "regime", family: "test", state: "bull", previousState: "bull", lastFlip: 0, thresholdKind: "fixed", bullTrigger: null, bearTrigger: null, triggerLabel: "", explanation: "", guidance: INDICATOR_SPECS[0].guidance, values: {}, overlays: [], ribbons: [], events: [], barColors: [], states: ["bull", "bull", "bull", "bull"] } satisfies SignalSnapshot;
  const result = backtest(candles, [snapshot], "1d", 15)[0];
  assert.ok(Math.abs(result.totalReturn - 0.9985) < 1e-10); assert.equal(result.turnover, 1);
});

test("confirmation clocks follow UTC daily and Monday weekly boundaries", () => {
  const now = Date.UTC(2026, 7, 21, 16, 45, 53);
  assert.deepEqual(confirmationClock("1d", now), { title: "Next daily close", boundary: "Today 23:59:59 UTC · confirms at 00:00 UTC", remaining: "7h 14m", target: Date.UTC(2026, 7, 22) });
  assert.deepEqual(confirmationClock("1w", now), { title: "Next weekly close", boundary: "Sunday 23:59:59 UTC · confirms Monday at 00:00 UTC", remaining: "2d 7h 14m", target: Date.UTC(2026, 7, 24) });
  assert.equal(completedBoundary("1d", now), Date.UTC(2026, 7, 20));
  assert.equal(completedBoundary("1w", now), Date.UTC(2026, 7, 10));
});

test("spot ticker payloads are parsed for every supported venue", () => {
  assert.equal(parseSpotPrice("bitstamp", { last: "117500.25" }), 117500.25);
  assert.equal(parseSpotPrice("binance", { symbol: "BTCUSDT", price: "117501.50" }), 117501.5);
  assert.equal(parseSpotPrice("kraken", { error: [], result: { XXBTZUSD: { c: ["117499.75", "0.01"] } } }), 117499.75);
  assert.equal(parseSpotPrice("coinbase", { price: "117502.00" }), 117502);
  assert.throws(() => parseSpotPrice("bitstamp", { last: "not-a-price" }), /invalid spot price/);
});

test("BTC, ETH, and SOL expose isolated venue definitions and useful history", () => {
  assert.deepEqual(ASSETS.map(asset => asset.id), ["btc", "eth", "sol"]);
  for (const asset of ASSETS) assert.equal(sourcesForAsset(asset.id).length, 4);
  assert.equal(SOURCES.length, 12);
  assert.equal(marketDefinition("eth", "bitstamp").providerSymbol, "ethusd");
  assert.equal(marketDefinition("sol", "binance").providerSymbol, "SOLUSDT");
  assert.equal(marketDefinition("sol", "binance").historyStart, Date.UTC(2020, 7, 11));
});

test("legacy BTC-only SQLite tables migrate in place without losing candles", () => {
  const database = new DatabaseSync(":memory:");
  database.exec("CREATE TABLE market_candles (source TEXT NOT NULL, timeframe TEXT NOT NULL, time INTEGER NOT NULL, market TEXT NOT NULL, open REAL NOT NULL, high REAL NOT NULL, low REAL NOT NULL, close REAL NOT NULL, volume REAL NOT NULL, complete INTEGER NOT NULL, PRIMARY KEY (source,timeframe,time))");
  database.exec("CREATE TABLE provider_snapshots (source TEXT NOT NULL, timeframe TEXT NOT NULL, market TEXT NOT NULL, retrieved_at TEXT NOT NULL, checksum TEXT NOT NULL, warning TEXT, first_candle INTEGER, last_candle INTEGER, candle_count INTEGER NOT NULL, PRIMARY KEY (source,timeframe))");
  database.exec("CREATE TABLE signal_snapshots (source TEXT NOT NULL, timeframe TEXT NOT NULL, indicator_id TEXT NOT NULL, candle_close INTEGER NOT NULL, state TEXT NOT NULL, prior_state TEXT NOT NULL, last_flip INTEGER, threshold_kind TEXT NOT NULL, bull_trigger REAL, bear_trigger REAL, payload TEXT NOT NULL, generated_at TEXT NOT NULL, PRIMARY KEY (source,timeframe,indicator_id))");
  database.prepare("INSERT INTO market_candles VALUES (?,?,?,?,?,?,?,?,?,?)").run("bitstamp", "1d", 123, "BTC/USD", 1, 2, 0.5, 1.5, 10, 1);
  ensureMarketSchema(database);
  const row = database.prepare("SELECT asset,source,market,close FROM market_candles").get() as { asset: string; source: string; market: string; close: number };
  assert.deepEqual({ ...row }, { asset: "btc", source: "bitstamp", market: "BTC/USD", close: 1.5 });
  const primaryKey = (database.prepare("PRAGMA table_info(market_candles)").all() as Array<{ name: string; pk: number }>).filter(column => column.pk).sort((a, b) => a.pk - b.pk).map(column => column.name);
  assert.deepEqual(primaryKey, ["asset", "source", "timeframe", "time"]);
  database.close();
});

test("local SQLite storage persists normalized candles between reads", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "btc-regime-sqlite-"));
  const priorPath = process.env.REGIME_SQLITE;
  process.env.REGIME_SQLITE = path.join(directory, "market.sqlite");
  try {
    const { persistDataset, persistSignalSnapshots, readStoredDataset } = await import(`../lib/market-store.ts?test=${Date.now()}`);
    const boundary = completedBoundary("1d");
    const dataset = {
      asset: "btc",
      assetLabel: "Bitcoin",
      source: "bitstamp",
      sourceLabel: "Bitstamp",
      market: "BTC/USD",
      denomination: "USD",
      timeframe: "1d",
      candles: [boundary - DAY, boundary].map((time, index) => ({ time, open: 100 + index, high: 103 + index, low: 99 + index, close: 102 + index, volume: 10, complete: true })),
      retrievedAt: new Date().toISOString(),
      checksum: "test-checksum",
      provisional: null,
      stale: false,
      demo: false,
      storage: "provider",
      warning: null,
      quality: { gaps: 0, duplicates: 0, malformed: 0 },
    } satisfies MarketDataset;
    await persistDataset(dataset);
    const ethDataset = {
      ...dataset,
      asset: "eth",
      assetLabel: "Ethereum",
      market: "ETH/USD",
      candles: dataset.candles.map(candle => ({ ...candle, open: candle.open / 10, high: candle.high / 10, low: candle.low / 10, close: candle.close / 10 })),
      checksum: "eth-test-checksum",
    } satisfies MarketDataset;
    await persistDataset(ethDataset);
    const stored = await readStoredDataset("btc", "bitstamp", "1d");
    const storedEth = await readStoredDataset("eth", "bitstamp", "1d");
    assert.ok(stored);
    assert.ok(storedEth);
    assert.equal(stored.storage, "sqlite");
    assert.equal(stored.candles.length, 2);
    assert.equal(stored.candles.at(-1)?.close, 103);
    assert.equal(storedEth.candles.at(-1)?.close, 10.3);
    await persistSignalSnapshots("btc", "bitstamp", "1d", dataset.candles.at(-1)!.time, calculateIndicators(dataset.candles, "1d"));
    const { getDatabase } = await import("../db/index.ts");
    const signalPayload = JSON.parse((getDatabase().prepare("SELECT payload FROM signal_snapshots WHERE asset='btc' AND source='bitstamp' AND timeframe='1d' AND indicator_id='super_guppy'").get() as { payload: string }).payload);
    assert.equal(signalPayload.schemaVersion, 2);
    assert.ok(signalPayload.guidance.summary);
    assert.equal(signalPayload.ribbons.length, 2);
    assert.ok(Array.isArray(signalPayload.events));
    assert.ok(Array.isArray(signalPayload.barColors));
    const tables = getDatabase().prepare("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name").all() as Array<{ name: string }>;
    assert.deepEqual(tables.map(row => row.name), ["market_candles", "provider_snapshots", "signal_snapshots"]);
    getDatabase().close();
  } finally {
    if (priorPath == null) delete process.env.REGIME_SQLITE;
    else process.env.REGIME_SQLITE = priorPath;
    rmSync(directory, { recursive: true, force: true });
  }
});
