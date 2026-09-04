import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { ensureMarketSchema } from "../db/index.ts";
import { ASSETS, MIN_SOURCE_CANDLES, SOURCES, aggregateWeekly, marketDefinition, parseSpotPrice, resolveSourceForAsset, sourcesForAsset, validateCandles, type MarketDataset } from "../lib/market-data.ts";
import { backtest, buyAndHold, calculateIndicators, INDICATOR_SPECS, KK_SUPERTREND_ATR_LENGTH, KK_SUPERTREND_EQUITY_FACTOR, KK_SUPERTREND_FACTORS, KK_SUPERTREND_PRESETS, type Candle, type SignalSnapshot } from "../lib/regimes.ts";
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

// Fixed Monday–Sunday OHLC from Kraken XMR/USD, 7 Jul 2025–30 Aug 2026.
// The screenshot's 31 Aug effective flip date is the next weekly open.
const XMR_KK_CALIBRATION: readonly OhlcRow[] = `319.44,341.36,309.63,336.1;336.29,357.14,318,325.33;325.38,337.53,308,325.19;325.22,331.29,289.38,303.42;303.61,314.36,247.41,268.16;268.16,285,230.26,283.59;284.72,301,249.15,276.45;276.45,285,256,261.69;261.95,274.42,258.13,271.67;271.6,314.99,264.3,307.2;307.16,346.72,289.59,292.86;293,302,283.01,290.29;290.32,341.22,283.89,320.99;320.99,347.59,265.01,304.37;304.47,330.57,281.6,314.85;314.85,351.38,301.47,348.19;348.38,363.29,317.53,347.59;347.33,470,325.15,417.49;417.49,440,360.17,405.87;407.1,420.06,318.5,388.64;388.39,438.49,370,435;435.13,435.77,360.29,362.53;362.54,420.43,360.22,409.36;408.95,500,400.01,470.38;471.23,484,423.38,452.3;452.37,462.15,411.52,417.9;418.37,560.48,416.41,559.43;558.56,799.89,552.2,571.27;571.15,650,444.8,449.55;449.56,500.87,401.14,404.86;405.05,421.88,276.66,319.11;319.05,370,315.06,331.3;331.37,344.72,314.66,327.79;327.78,355.44,302.06,341.14;341.06,375.61,334.21,334.26;334.44,370,333.41,357.04;357.61,382.12,336.13,361.41;361.41,365,317.4,326.88;327.01,340,313.32,330.93;330.88,359.01,321.42,335.46;335.51,355.55,335.36,347.12;347.16,406.91,345.66,392.35;392.39,399.02,369.18,391.63;391.59,437.58,384.29,409.59;410.06,420.9,358.34,390.32;390.31,410.25,372.17,392.69;393.08,421.4,346.11,367.11;367.11,384.83,292,302.95;302.93,426.32,298.92,340.82;340.82,379.92,305,320.28;320.3,334,298.95,310.68;310.65,334.96,300.61,327.14;326.45,336.2,312.89,324.36;324.48,339.47,317.97,335.88;335.6,372.68,331.74,353.25;353.52,367.84,333.97,363.63;363.65,413.57,350,394.92;395.02,417.87,374,409.58;409.57,464.69,399.02,421.91;421.37,527.3,414.24,487.5`
  .split(";")
  .map(row => row.split(",").map(Number) as [number, number, number, number]);

// Fixed Monday–Sunday OHLC from Poloniex DOGE/USDT, 13 May 2024–30 Aug 2026.
// The screenshot's 10 Nov 2025 flip date is the next weekly open after the 3 Nov signal candle.
const DOGE_KK_CALIBRATION: readonly OhlcRow[] = `0.14136,0.159237,0.13601,0.149647;0.14964,0.17457,0.1486,0.166188;0.16622,0.173298,0.154593,0.157161;0.157104,0.165669,0.14,0.146848;0.146853,0.15053,0.13245,0.137164;0.13715,0.138234,0.1179,0.12237;0.122272,0.12862,0.1145,0.124434;0.124444,0.127451,0.092,0.104124;0.104131,0.116791,0.098814,0.115426;0.115364,0.1435,0.114547,0.140098;0.140099,0.142535,0.120191,0.130076;0.130056,0.134989,0.099052,0.103716;0.103722,0.110969,0.080604,0.10059;0.100575,0.108977,0.097581,0.100081;0.100069,0.115377,0.098603,0.10972;0.109719,0.11039,0.094109,0.095143;0.095106,0.100741,0.089032,0.096163;0.096145,0.108418,0.095684,0.102792;0.102755,0.110411,0.098463,0.106332;0.106389,0.131931,0.1042,0.124522;0.1245,0.12464,0.101097,0.111574;0.111615,0.115432,0.103257,0.111376;0.111408,0.146705,0.109341,0.142371;0.142015,0.149711,0.128072,0.144374;0.144227,0.179654,0.141147,0.151316;0.15139,0.297414,0.148277,0.278018;0.277759,0.437992,0.272868,0.366668;0.366808,0.478182,0.358,0.43006;0.430324,0.449232,0.366038,0.440426;0.440407,0.483968,0.389235,0.466628;0.466621,0.467503,0.366372,0.406584;0.406579,0.414362,0.262148,0.312612;0.312629,0.342072,0.303122,0.314325;0.314349,0.398485,0.307031,0.382267;0.382417,0.397,0.3142,0.335999;0.336219,0.43421,0.3101,0.358899;0.358386,0.403765,0.335296,0.336114;0.336063,0.342,0.256594,0.270062;0.270057,0.293776,0.223545,0.248939;0.248928,0.286073,0.241668,0.265564;0.265551,0.268829,0.234494,0.242762;0.242762,0.243959,0.181583,0.239475;0.239477,0.240713,0.165643,0.168083;0.168061,0.180935,0.142917,0.168178;0.168166,0.179112,0.163042,0.172495;0.172436,0.205712,0.164915,0.16662;0.16662,0.179846,0.146302,0.149326;0.149321,0.16948,0.13,0.16253;0.162536,0.169505,0.150239,0.155296;0.155302,0.19304,0.155036,0.179339;0.179327,0.184296,0.166951,0.170532;0.170515,0.259582,0.164333,0.231829;0.231811,0.253204,0.210829,0.232988;0.233058,0.254093,0.2141,0.224952;0.224955,0.231965,0.18567,0.193644;0.193648,0.200492,0.168093,0.184167;0.184171,0.206064,0.170001,0.175531;0.175514,0.181142,0.142824,0.151277;0.151276,0.169939,0.148621,0.169426;0.169435,0.175389,0.15666,0.171962;0.171944,0.213663,0.165678,0.198538;0.198577,0.278085,0.188559,0.273729;0.273766,0.287368,0.221054,0.240618;0.240685,0.248376,0.188587,0.198723;0.198878,0.246546,0.195689,0.233808;0.233809,0.255493,0.217326,0.234552;0.234498,0.244836,0.207979,0.231809;0.231832,0.234443,0.206005,0.213705;0.213657,0.229187,0.205001,0.228747;0.228748,0.306628,0.226541,0.277947;0.277903,0.288752,0.258173,0.260902;0.2609,0.26239,0.2208,0.2376;0.237651,0.265172,0.22647,0.252838;0.252844,0.270399,0.178259,0.207196;0.207196,0.2182,0.175801,0.195331;0.195203,0.206991,0.185195,0.205807;0.205768,0.209397,0.176562,0.186433;0.186407,0.186684,0.151896,0.179326;0.179302,0.18642,0.153823,0.158634;0.15851,0.164936,0.133333,0.144999;0.145008,0.156813,0.143006,0.145969;0.145986,0.153484,0.132,0.138567;0.138556,0.153204,0.132703,0.134099;0.134163,0.138465,0.120079,0.131164;0.131206,0.135318,0.120607,0.123914;0.123893,0.154065,0.116114,0.149507;0.14948,0.156546,0.136,0.138002;0.138091,0.151256,0.131422,0.131608;0.13168,0.13168,0.118001,0.119516;0.119516,0.127729,0.095,0.104238;0.104239,0.11071,0.080058,0.096559;0.096578,0.117482,0.087891,0.102652;0.102744,0.103664,0.094589,0.09557;0.09563,0.106068,0.08772,0.0919;0.091935,0.104237,0.086649,0.089155;0.089136,0.101933,0.08891,0.097391;0.09731,0.104467,0.089219,0.090137;0.090156,0.097911,0.088041,0.090446;0.090545,0.094479,0.089143,0.092404;0.092415,0.096,0.089973,0.090856;0.090894,0.102156,0.09072,0.093085;0.092996,0.099912,0.092924,0.099279;0.099296,0.11171,0.097006,0.108329;0.108212,0.117115,0.105615,0.112421;0.112532,0.118585,0.105842,0.108976;0.108899,0.109141,0.097493,0.102298;0.10229,0.103914,0.097,0.100422;0.100389,0.101547,0.0777,0.086301;0.086267,0.09236,0.081908,0.088878;0.088928,0.090966,0.08,0.082249;0.082128,0.084928,0.071471,0.073269;0.073325,0.079665,0.069587,0.077883;0.077854,0.07852,0.071055,0.072741;0.072898,0.07537,0.070945,0.07243;0.072387,0.0745,0.068261,0.07335;0.073419,0.073566,0.067637,0.070865;0.070901,0.071556,0.068238,0.069304;0.069314,0.072992,0.068945,0.069555;0.069578,0.100867,0.069412,0.093367;0.093432,0.093586,0.080827,0.082012`
  .split(";")
  .map(row => row.split(",").map(Number) as [number, number, number, number]);

// Fixed Monday–Sunday OHLC from Coinbase LINK/USD, 13 May 2024–30 Aug 2026.
// The screenshot's 24 Aug 2026 flip date is the next weekly open after the 17 Aug signal candle.
const LINK_KK_CALIBRATION: readonly OhlcRow[] = "13.559,17.115,12.838,16.561;16.562,17.901,15.418,17.032;17.032,19.208,16.878,18.138;18.137,18.343,15.5,16.375;16.376,16.392,14.423,15.131;15.131,15.209,12.93,13.184;13.186,14.578,12.69,14.251;14.258,14.73,11.042,12.352;12.353,13.531,11.775,13.46;13.45,15.008,13.34,14.821;14.824,14.878,12.461,13.305;13.301,13.903,10.484,10.884;10.884,10.973,8.082,10.001;10.001,10.754,9.917,10.087;10.083,12.561,9.947,12.111;12.11,12.698,10.233,10.368;10.365,10.88,9.28,10.351;10.351,11.566,10.172,10.811;10.812,11.737,10.289,11.13;11.132,12.974,10.915,12.467;12.467,12.474,10.342,11.276;11.275,11.745,10.24,10.751;10.75,12.034,10.599,11.968;11.97,12.33,10.79,10.968;10.966,12.458,10.511,10.757;10.758,14.862,10.067,14.272;14.274,15.361,12.723,13.789;13.794,18.4,13.754,17.924;17.931,19.456,16.183,18.939;18.93,27.401,18.588,26.116;26.118,30.949,19.85,29.248;29.249,30.812,20,22.061;22.064,25.966,20.732,20.904;20.911,24.057,19.655,23.573;23.574,24.779,19.136,19.827;19.828,26.68,17.837,24.306;24.315,27.2,23.368,24.863;24.869,26.4,19.31,20.457;20.459,22.067,16.01,18.269;18.267,19.849,17.648,18.698;18.692,19.785,17.119,17.611;17.613,17.813,13.436,17.419;17.415,17.664,13.074,13.8;13.802,14.683,11.842,13.373;13.37,15.172,13.34,14.469;14.467,15.999,13.199,13.412;13.413,14.394,11,11.279;11.281,13.287,10.1,12.625;12.625,13.596,11.91,13.283;13.285,15.362,12.886,14.562;14.562,15.24,13.813,13.86;13.86,17.469,13.203,17.109;17.112,17.979,14.907,15.876;15.884,17.157,14.846,15.54;15.543,16.193,13.403,14.074;14.074,14.485,12.641,13.731;13.73,15.663,12.758,13.298;13.299,14.171,10.936,11.66;11.66,13.875,11.406,13.71;13.711,14.079,12.734,13.497;13.498,15.953,13.202,15.669;15.67,19.95,15.14,19.288;19.288,20.284,17.172,19.233;19.241,19.563,15.43,16.306;16.307,22.693,16.034,22.072;22.065,26.338,20.85,25.657;25.655,27.865,23.354,25.82;25.81,26.45,22.825,23.198;23.196,23.965,21.876,22.456;22.455,25.65,22.229,24.104;24.102,24.884,22.76,22.966;22.961,23.059,19.836,21.679;21.682,23.16,20.921,22.007;22.01,23.734,15,19.015;19.009,20.199,15.7,17.29;17.289,19.194,16.75,18.552;18.542,19.057,16.324,17.583;17.588,17.655,13.693,15.923;15.922,16.784,13.387,13.724;13.722,14.261,11.596,12.519;12.518,13.568,12.287,12.958;12.957,14.933,11.745,13.635;13.636,15.008,13.089,13.276;13.275,13.736,11.726,12.433;12.433,12.949,11.973,12.483;12.484,13.571,12,13.416;13.418,14.233,13.007,13.194;13.187,14.399,12.915,13.307;13.304,13.304,11.351,11.509;11.509,12.174,8.996,9.395;9.394,10.024,7.197,8.817;8.816,9.24,8.121,8.778;8.776,9.041,8.34,8.67;8.67,9.586,8.05,8.674;8.673,9.637,8.396,8.515;8.514,9.61,8.483,9.51;9.512,10.079,8.572,8.689;8.69,9.495,8.202,8.405;8.408,9.189,8.392,8.82;8.821,9.413,8.569,8.736;8.734,9.871,8.69,9.068;9.065,9.558,9.055,9.483;9.487,9.595,8.91,9.131;9.128,10.867,9.09,10.716;10.72,10.8,9.337,9.559;9.56,10.023,9.057,9.427;9.425,9.671,8.761,9.137;9.134,9.2,7.001,7.912;7.911,8.18,7.478,8.18;8.18,8.589,7.759,7.773;7.774,8.144,7.001,7.257;7.257,8.173,7.068,8.054;8.053,8.161,7.517,7.992;7.99,8.627,7.788,8.379;8.378,8.833,8.258,8.816;8.816,8.907,7.883,8.374;8.375,8.39,8.06,8.183;8.182,9.736,8.161,9.381;9.38,12.605,9.323,11.539;11.542,12.064,11,11.146"
  .split(";")
  .map(row => row.split(",").map(Number) as [number, number, number, number]);

test("KK Supertrend is registered immediately after SuperTrend with fixed crypto presets", () => {
  const supertrendIndex = INDICATOR_SPECS.findIndex(spec => spec.id === "supertrend");
  const kkIndex = INDICATOR_SPECS.findIndex(spec => spec.id === "kk_supertrend");
  assert.equal(kkIndex, supertrendIndex + 1);
  assert.equal(KK_SUPERTREND_ATR_LENGTH, 10);
  assert.deepEqual(KK_SUPERTREND_FACTORS, { btc: 3, eth: 2, sol: 2, doge: 3, link: 3, xmr: 3, sui: 3 });
  assert.equal(KK_SUPERTREND_EQUITY_FACTOR, 3);
  assert.deepEqual(INDICATOR_SPECS[kkIndex].parameters, { atr: 10, btcFactor: 3, ethFactor: 2, solFactor: 2, dogeDailyAtr: 10, dogeDailyFactor: 3, dogeWeeklyAtr: 15, dogeWeeklyFactor: 2, linkDailyAtr: 10, linkDailyFactor: 3, linkWeeklyAtr: 15, linkWeeklyFactor: 2, xmrDailyAtr: 10, xmrDailyFactor: 3, xmrWeeklyAtr: 15, xmrWeeklyFactor: 2, suiFactor: 3 });
  assert.deepEqual(KK_SUPERTREND_PRESETS.doge, { "1d": { atrLength: 10, factor: 3 }, "1w": { atrLength: 15, factor: 2 } });
  assert.deepEqual(KK_SUPERTREND_PRESETS.link, { "1d": { atrLength: 10, factor: 3 }, "1w": { atrLength: 15, factor: 2 } });
  assert.deepEqual(KK_SUPERTREND_PRESETS.xmr, { "1d": { atrLength: 10, factor: 3 }, "1w": { atrLength: 15, factor: 2 } });
  assert.deepEqual(KK_SUPERTREND_PRESETS.sui, { "1d": { atrLength: 10, factor: 3 }, "1w": { atrLength: 10, factor: 3 } });
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

test("weekly XMR KK Supertrend reproduces the supplied 15/2 calibration level", () => {
  const candles = weeklyFixture(Date.UTC(2025, 6, 7), XMR_KK_CALIBRATION);
  const calibrated = calculateIndicators(candles, "1w", { asset: "xmr" }).find(item => item.id === "kk_supertrend")!;
  const previous = calculateIndicators(candles, "1w", { asset: "xmr", kkSupertrendAtrLength: 10, kkSupertrendFactor: 3 }).find(item => item.id === "kk_supertrend")!;

  assert.equal(calibrated.state, "bull");
  assert.equal(calibrated.values.atrLength, 15);
  assert.equal(calibrated.values.factor, 2);
  assert.ok(Math.abs(calibrated.bearTrigger! - 350.93) < 0.05, `XMR level ${calibrated.bearTrigger}`);
  assert.equal(calibrated.bullTrigger, null);
  assert.equal(calibrated.lastFlip, candles.at(-1)!.time);
  assert.equal(previous.state, "bear");
  assert.equal(previous.values.atrLength, 10);
  assert.equal(previous.values.factor, 3);

  const costs = [5, 15, 30].map(costBps => backtest(candles, [calibrated], "1w", costBps)[0]);
  assert.ok(costs.every(Boolean));
  assert.ok(costs[0]!.totalReturn >= costs[1]!.totalReturn);
  assert.ok(costs[1]!.totalReturn >= costs[2]!.totalReturn);
});

test("weekly DOGE KK Supertrend reproduces the supplied Poloniex 15/2 calibration", () => {
  const candles = weeklyFixture(Date.UTC(2024, 4, 13), DOGE_KK_CALIBRATION);
  const calibrated = calculateIndicators(candles, "1w", { asset: "doge" }).find(item => item.id === "kk_supertrend")!;
  const previous = calculateIndicators(candles, "1w", { asset: "doge", kkSupertrendAtrLength: 10, kkSupertrendFactor: 3 }).find(item => item.id === "kk_supertrend")!;

  assert.equal(calibrated.state, "bear");
  assert.equal(calibrated.values.atrLength, 15);
  assert.equal(calibrated.values.factor, 2);
  assert.ok(Math.abs(calibrated.bullTrigger! - 0.097006) < 0.00002, `DOGE level ${calibrated.bullTrigger}`);
  assert.equal(calibrated.bearTrigger, null);
  assert.equal(calibrated.lastFlip, Date.UTC(2025, 10, 3));
  assert.equal(previous.state, "bear");
  assert.ok(Math.abs(previous.bullTrigger! - 0.10047) < 0.0001);

  const costs = [5, 15, 30].map(costBps => backtest(candles, [calibrated], "1w", costBps)[0]);
  assert.ok(costs.every(Boolean));
  assert.ok(costs[0]!.totalReturn >= costs[1]!.totalReturn);
  assert.ok(costs[1]!.totalReturn >= costs[2]!.totalReturn);
});

test("weekly LINK KK Supertrend reproduces the supplied Coinbase 15/2 calibration", () => {
  const candles = weeklyFixture(Date.UTC(2024, 4, 13), LINK_KK_CALIBRATION);
  const calibrated = calculateIndicators(candles, "1w", { asset: "link" }).find(item => item.id === "kk_supertrend")!;
  const previous = calculateIndicators(candles, "1w", { asset: "link", kkSupertrendAtrLength: 10, kkSupertrendFactor: 3 }).find(item => item.id === "kk_supertrend")!;

  assert.equal(calibrated.state, "bull");
  assert.equal(calibrated.values.atrLength, 15);
  assert.equal(calibrated.values.factor, 2);
  assert.ok(Math.abs(calibrated.bearTrigger! - 8.745) < 0.001, `LINK level ${calibrated.bearTrigger}`);
  assert.equal(calibrated.bullTrigger, null);
  assert.equal(calibrated.lastFlip, Date.UTC(2026, 7, 17));
  assert.equal(candles.at(-1)!.time, Date.UTC(2026, 7, 24));
  assert.equal(candles.at(-1)!.open, 11.542);
  assert.equal(previous.state, "bull");
  assert.ok(Math.abs(previous.bearTrigger! - 7.6924) < 0.01);

  const costs = [5, 15, 30].map(costBps => backtest(candles, [calibrated], "1w", costBps)[0]);
  assert.ok(costs.every(Boolean));
  assert.ok(costs[0]!.totalReturn >= costs[1]!.totalReturn);
  assert.ok(costs[1]!.totalReturn >= costs[2]!.totalReturn);
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

test("SUI plus daily DOGE, LINK, and XMR KK Supertrend use the explicit uncalibrated SuperTrend 10/3 preset", () => {
  for (const asset of ["doge", "link", "xmr", "sui"] as const) {
    const results = calculateIndicators(history(), "1d", { asset });
    const standard = results.find(item => item.id === "supertrend")!;
    const kk = results.find(item => item.id === "kk_supertrend")!;
    assert.equal(kk.values.factor, 3, asset);
    assert.deepEqual(kk.states, standard.states, asset);
    assert.deepEqual(kk.overlays[0].points, standard.overlays[0].points, asset);
  }
  const weekly = calculateIndicators(history(), "1w", { asset: "sui" });
  assert.deepEqual(weekly.find(item => item.id === "kk_supertrend")!.states, weekly.find(item => item.id === "supertrend")!.states);
});

test("equity market context runs every applicable indicator and uses the uncalibrated factor-three KK preset", () => {
  const candles = history();
  for (const timeframe of ["1d", "1w"] as const) {
    const results = calculateIndicators(candles, timeframe, { market: "equity" });
    const expected = INDICATOR_SPECS.filter(spec => spec.supportedTimeframes.includes(timeframe)).map(spec => spec.id).sort();
    assert.deepEqual(results.map(result => result.id).sort(), expected, timeframe);
    assert.ok(results.every(result => result.states.length === candles.length), timeframe);
    const standard = results.find(item => item.id === "supertrend")!;
    const kk = results.find(item => item.id === "kk_supertrend")!;
    assert.equal(kk.values.factor, 3, timeframe);
    assert.deepEqual(kk.states, standard.states, timeframe);
    assert.deepEqual(kk.overlays[0].points, standard.overlays[0].points, timeframe);
    assert.deepEqual({ state: kk.state, flip: kk.lastFlip, bull: kk.bullTrigger, bear: kk.bearTrigger }, { state: standard.state, flip: standard.lastFlip, bull: standard.bullTrigger, bear: standard.bearTrigger }, timeframe);
  }
  const mayer = calculateIndicators(candles, "1d", { market: "equity" }).find(item => item.id === "mayer")!;
  assert.ok(Number.isFinite(mayer.values.multiple));

  const custom = calculateIndicators(candles, "1d", { market: "equity", kkSupertrendFactor: 2 }).find(item => item.id === "kk_supertrend")!;
  assert.equal(custom.values.factor, 2);
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
  const equityResult = backtest(candles, [snapshot], "1d", 15, { market: "equity" })[0];
  assert.equal(equityResult.totalReturn, result.totalReturn);
  assert.equal(equityResult.turnover, result.turnover);
});

test("equity backtests and buy-and-hold annualize daily returns at 252 sessions without changing crypto defaults", () => {
  const candles: Candle[] = Array.from({ length: 254 }, (_, i) => {
    const open = 100 * 1.001 ** i;
    return { time: i * DAY, open, high: open, low: open, close: open, volume: 1, complete: true };
  });
  const snapshot = { id: "test", displayName: "Test", shortName: "Test", role: "regime", family: "test", state: "bull", previousState: "bull", lastFlip: 0, thresholdKind: "fixed", bullTrigger: null, bearTrigger: null, triggerLabel: "", explanation: "", guidance: INDICATOR_SPECS[0].guidance, values: {}, overlays: [], ribbons: [], events: [], barColors: [], states: candles.map(() => "bull" as const) } satisfies SignalSnapshot;
  const equity = backtest(candles, [snapshot], "1d", 0, { market: "equity" })[0];
  const explicit = backtest(candles, [snapshot], "1d", 0, { periodsPerYear: 252 })[0];
  const cryptoDefault = backtest(candles, [snapshot], "1d", 0)[0];
  assert.ok(Math.abs(equity.cagr - (1.001 ** 252 - 1)) < 1e-10);
  assert.equal(equity.cagr, explicit.cagr);
  assert.ok(cryptoDefault.cagr > equity.cagr);
  assert.ok(Math.abs(cryptoDefault.cagr - (1.001 ** 365 - 1)) < 1e-10);

  const holdCandles = candles.slice(0, 253);
  const equityHold = buyAndHold(holdCandles, "1d", 0, { market: "equity" })!;
  const explicitHold = buyAndHold(holdCandles, "1d", 0, { periodsPerYear: 252 })!;
  const cryptoHold = buyAndHold(holdCandles, "1d", 0)!;
  assert.ok(Math.abs(equityHold.cagr - (1.001 ** 252 - 1)) < 1e-10);
  assert.equal(equityHold.cagr, explicitHold.cagr);
  assert.ok(cryptoHold.cagr > equityHold.cagr);

  const costs = [5, 15, 30].map(costBps => backtest(candles, [snapshot], "1d", costBps, { market: "equity" })[0]);
  assert.ok(costs[0].totalReturn > costs[1].totalReturn && costs[1].totalReturn > costs[2].totalReturn);
  assert.ok(costs.every(result => result.turnover === 1));
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

test("all crypto assets expose isolated venue definitions and useful history", () => {
  assert.deepEqual(ASSETS.map(asset => asset.id), ["btc", "eth", "sol", "doge", "link", "xmr", "sui"]);
  for (const asset of ASSETS.filter(asset => asset.id !== "xmr")) assert.equal(sourcesForAsset(asset.id).length, 4);
  assert.deepEqual(sourcesForAsset("xmr").map(source => source.id), ["kraken"]);
  assert.equal(ASSETS.find(asset => asset.id === "sol")!.defaultSource, "coinbase");
  assert.equal(SOURCES.length, 25);
  assert.equal(marketDefinition("eth", "bitstamp").providerSymbol, "ethusd");
  assert.equal(marketDefinition("eth", "coinbase").historyStart, Date.UTC(2016, 4, 23));
  assert.equal(marketDefinition("sol", "binance").providerSymbol, "SOLUSDT");
  assert.equal(marketDefinition("sol", "binance").historyStart, Date.UTC(2020, 7, 11));
  assert.equal(marketDefinition("doge", "kraken").providerSymbol, "XDGUSD");
  assert.equal(marketDefinition("doge", "coinbase").historyStart, Date.UTC(2021, 5, 3));
  assert.equal(marketDefinition("link", "binance").providerSymbol, "LINKUSDT");
  assert.equal(marketDefinition("link", "coinbase").historyStart, Date.UTC(2019, 5, 27));
  assert.equal(marketDefinition("xmr", "kraken").providerSymbol, "XMRUSD");
  assert.equal(marketDefinition("xmr", "kraken").market, "XMR/USD");
  assert.equal(ASSETS.find(asset => asset.id === "sui")!.defaultSource, "coinbase");
  assert.equal(marketDefinition("sui", "coinbase").providerSymbol, "SUI-USD");
  assert.equal(marketDefinition("sui", "coinbase").market, "SUI/USD");
  assert.equal(marketDefinition("sui", "binance").market, "SUI/USDT");
  assert.deepEqual(MIN_SOURCE_CANDLES, { "1d": 200, "1w": 52 });
});

test("asset changes preserve the selected exchange when it supports the next asset", () => {
  for (const asset of ASSETS) {
    for (const source of ["bitstamp", "binance", "kraken", "coinbase"] as const) {
      const expected = sourcesForAsset(asset.id).some(item => item.id === source) ? source : asset.defaultSource;
      assert.equal(resolveSourceForAsset(asset.id, source), expected, `${asset.id} source resolution for ${source}`);
    }
    assert.equal(resolveSourceForAsset(asset.id, "unsupported"), asset.defaultSource);
  }
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
    assert.deepEqual(tables.map(row => row.name), ["auth_challenges", "auth_rate_events", "auth_sessions", "auth_users", "market_candles", "provider_snapshots", "signal_snapshots"]);
    getDatabase().close();
  } finally {
    if (priorPath == null) delete process.env.REGIME_SQLITE;
    else process.env.REGIME_SQLITE = priorPath;
    rmSync(directory, { recursive: true, force: true });
  }
});
