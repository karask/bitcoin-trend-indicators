import type { AssetId } from "./markets";

export type RegimeState = "bull" | "bear" | "neutral";
export type ThresholdKind = "fixed" | "provisional" | "conditional";
export type IndicatorRole = "regime" | "confirmation" | "exit" | "valuation";
export type Timeframe = "1d" | "1w";
export type MarketContext = "crypto" | "equity";
export type SuperGuppySource = "close" | "open" | "high" | "low" | "hl2" | "hlc3" | "ohlc4";

export interface SuperGuppyConfig {
  fastLengths: number[];
  slowLengths: number[];
  source: SuperGuppySource;
  anchorMinutes: number;
  showBreak: boolean;
  showSwing: boolean;
  requireConfluence: boolean;
  candleChangeRetriggers: boolean;
  lookback: number;
  showAverages: boolean;
  showEma200: boolean;
  ema200Filter: boolean;
  colorBars: boolean;
}

export interface IndicatorCalculationOptions {
  asset?: AssetId;
  market?: MarketContext;
  kkSupertrendFactor?: number;
  kkSupertrendAtrLength?: number;
  superGuppy?: Partial<SuperGuppyConfig>;
}

export interface AnnualizationOptions {
  market?: MarketContext;
  periodsPerYear?: number;
}

export const KK_SUPERTREND_ATR_LENGTH = 10;
export const KK_SUPERTREND_FACTORS = { btc: 3, eth: 2, sol: 2, doge: 3, link: 3, xmr: 3, sui: 3 } as const satisfies Record<AssetId, number>;
export const KK_SUPERTREND_EQUITY_FACTOR = 3;
export const KK_SUPERTREND_PRESETS = {
  btc: { "1d": { atrLength: 10, factor: 3 }, "1w": { atrLength: 10, factor: 3 } },
  eth: { "1d": { atrLength: 10, factor: 2 }, "1w": { atrLength: 10, factor: 2 } },
  sol: { "1d": { atrLength: 10, factor: 2 }, "1w": { atrLength: 10, factor: 2 } },
  doge: { "1d": { atrLength: 10, factor: 3 }, "1w": { atrLength: 15, factor: 2 } },
  link: { "1d": { atrLength: 10, factor: 3 }, "1w": { atrLength: 15, factor: 2 } },
  xmr: { "1d": { atrLength: 10, factor: 3 }, "1w": { atrLength: 15, factor: 2 } },
  sui: { "1d": { atrLength: 10, factor: 3 }, "1w": { atrLength: 10, factor: 3 } },
} as const satisfies Record<AssetId, Record<Timeframe, { atrLength: number; factor: number }>>;

export const SUPER_GUPPY_R12_DEFAULTS: SuperGuppyConfig = {
  fastLengths: Array.from({ length: 11 }, (_, index) => 3 + index * 2),
  slowLengths: Array.from({ length: 16 }, (_, index) => 25 + index * 3),
  source: "close",
  anchorMinutes: 0,
  showBreak: true,
  showSwing: true,
  requireConfluence: false,
  candleChangeRetriggers: false,
  lookback: 6,
  showAverages: false,
  showEma200: false,
  ema200Filter: false,
  colorBars: false,
};

export interface GuidanceItem {
  label: string;
  rule: string;
}

export interface IndicatorGuidance {
  summary: string;
  positive: GuidanceItem;
  neutral: GuidanceItem;
  negative: GuidanceItem;
  rationale: string;
  caveats: string[];
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  complete: boolean;
}

export interface IndicatorSpec {
  id: string;
  displayName: string;
  shortName: string;
  role: IndicatorRole;
  family: string;
  supportedTimeframes: Timeframe[];
  parameters: Record<string, number | string>;
  thresholdKind: ThresholdKind;
  description: string;
  guidance: IndicatorGuidance;
  disclaimer?: string;
  sourceUrl?: string;
}

export interface LinePoint { time: number; value: number; color?: string }
export interface OverlaySeries { name: string; legendLabel?: string; color: string; points: LinePoint[]; dashed?: boolean; width?: number; pointStyle?: "line" | "circles"; showInLegend?: boolean }

export interface RibbonPoint { time: number; upper: number; lower: number; state: RegimeState }
export interface RibbonBand {
  id: string;
  name: string;
  palette: Record<RegimeState, string>;
  fillOpacity: number;
  showInLegend?: boolean;
  points: RibbonPoint[];
}

export type SignalEventKind = "swing" | "trend_break";
export interface SignalEvent {
  time: number;
  kind: SignalEventKind;
  direction: "bull" | "bear";
  label: string;
  price: number;
  color: string;
  confirmedAt: number;
  effectiveAt: number | null;
}

export interface BarColorPoint { time: number; color: string }

export interface SignalSnapshot {
  id: string;
  displayName: string;
  shortName: string;
  role: IndicatorRole;
  family: string;
  state: RegimeState;
  previousState: RegimeState;
  lastFlip: number | null;
  thresholdKind: ThresholdKind;
  bullTrigger: number | null;
  bearTrigger: number | null;
  triggerLabel: string;
  explanation: string;
  guidance: IndicatorGuidance;
  values: Record<string, number | null>;
  disclaimer?: string;
  sourceUrl?: string;
  overlays: OverlaySeries[];
  ribbons: RibbonBand[];
  events: SignalEvent[];
  barColors: BarColorPoint[];
  states: Array<RegimeState | null>;
}

export interface BacktestSummary {
  indicatorId: string;
  displayName: string;
  totalReturn: number;
  cagr: number;
  maxDrawdown: number;
  calmar: number | null;
  sharpe: number | null;
  sortino: number | null;
  volatility: number;
  exposure: number;
  turnover: number;
  flips: number;
  upsideCapture: number | null;
  downsideCapture: number | null;
  timeInState: Record<RegimeState, number>;
}

const BASE_INDICATOR_SPECS: Array<Omit<IndicatorSpec, "guidance">> = [
  { id: "support_band", displayName: "20 SMA / 21 EMA Support Band", shortName: "Support Band", role: "regime", family: "smoothing/order", supportedTimeframes: ["1d", "1w"], parameters: { sma: 20, ema: 21 }, thresholdKind: "fixed", description: "Above both averages is bullish, below both is bearish, and between is neutral." },
  { id: "supertrend", displayName: "SuperTrend 10/3", shortName: "SuperTrend", role: "regime", family: "ATR/trailing stop", supportedTimeframes: ["1d", "1w"], parameters: { atr: 10, factor: 3 }, thresholdKind: "provisional", description: "A transparent ATR trailing regime line with close-based reversals.", disclaimer: "A transparent alternative commonly compared with private one-line systems; not a MoneyLine clone.", sourceUrl: "https://www.tradingview.com/support/solutions/43000634738-supertrend/" },
  { id: "kk_supertrend", displayName: "KK Supertrend", shortName: "KK Supertrend", role: "regime", family: "ATR/trailing stop", supportedTimeframes: ["1d", "1w"], parameters: { atr: KK_SUPERTREND_ATR_LENGTH, btcFactor: KK_SUPERTREND_FACTORS.btc, ethFactor: KK_SUPERTREND_FACTORS.eth, solFactor: KK_SUPERTREND_FACTORS.sol, dogeDailyAtr: 10, dogeDailyFactor: 3, dogeWeeklyAtr: 15, dogeWeeklyFactor: 2, linkDailyAtr: 10, linkDailyFactor: 3, linkWeeklyAtr: 15, linkWeeklyFactor: 2, xmrDailyAtr: 10, xmrDailyFactor: 3, xmrWeeklyAtr: 15, xmrWeeklyFactor: 2, suiFactor: KK_SUPERTREND_FACTORS.sui }, thresholdKind: "provisional", description: "A SuperTrend variation with fixed screenshot-calibrated weekly presets: BTC ATR 10/factor 3, ETH and SOL ATR 10/factor 2, and DOGE/LINK/XMR ATR 15/factor 2. SUI plus daily DOGE/LINK/XMR retain uncalibrated 10/3 presets.", disclaimer: "KK Supertrend is a transparent preset built on the standard SuperTrend recurrence. BTC, ETH, SOL, and weekly DOGE/LINK/XMR use screenshot-calibrated presets; SUI plus daily DOGE/LINK/XMR use explicitly uncalibrated factor-3 presets. It does not claim to reproduce a private or proprietary implementation.", sourceUrl: "https://www.tradingview.com/support/solutions/43000634738-supertrend/" },
  { id: "smma_ribbon", displayName: "SMMA Ribbon 15/19/25/29", shortName: "SMMA Ribbon", role: "regime", family: "smoothing/order", supportedTimeframes: ["1d", "1w"], parameters: { lengths: "15/19/25/29", source: "HL2" }, thresholdKind: "conditional", description: "Fully ordered averages are bullish or bearish; tangled averages are neutral.", disclaimer: "Community Larsson-style proxy only. The official Larsson Line formula is private." },
  { id: "super_guppy", displayName: "Super Guppy R1.2 by JustUncleL", shortName: "Super Guppy R1.2", role: "regime", family: "smoothing/order", supportedTimeframes: ["1d", "1w"], parameters: { revision: "R1.2", fast: "3–23 step 2", slow: "25–70 step 3", source: "Close", averages: 27, plottedByDefault: 14, showSwing: 1, showBreak: 1, lookback: 6, confluence: 0, ema200Filter: 0, anchorMinutes: 0 }, thresholdKind: "conditional", description: "The published R1.2 Trader and Investor EMA groups, dynamic colors, pullback signals, and aggressive trend-break signals.", disclaimer: "Independent implementation of JustUncleL's open-source Super Guppy R1.2 rules. The intraday anchor input is exposed for parity but cannot change a daily or weekly chart because its published maximum is one day.", sourceUrl: "https://www.tradingview.com/script/Lj6d7UxQ-Super-Guppy-R1-0-by-JustUncleL/" },
  { id: "long_sma", displayName: "Long SMA Filter", shortName: "Long SMA", role: "regime", family: "smoothing/order", supportedTimeframes: ["1d", "1w"], parameters: { daily: 200, weekly: 30 }, thresholdKind: "fixed", description: "Price above the long average is bullish; below is bearish." },
  { id: "donchian_20_10", displayName: "Donchian Close 20/10", shortName: "Donchian 20/10", role: "regime", family: "breakout", supportedTimeframes: ["1d", "1w"], parameters: { entry: 20, exit: 10 }, thresholdKind: "fixed", description: "Close above the prior 20-period high turns bullish; below the prior 10-period low turns bearish." },
  { id: "ichimoku", displayName: "Ichimoku Cloud 9/26/52", shortName: "Ichimoku", role: "regime", family: "cloud/projected support", supportedTimeframes: ["1d", "1w"], parameters: { tenkan: 9, kijun: 26, spanB: 52 }, thresholdKind: "conditional", description: "Above the correctly displaced cloud is bullish, below is bearish, inside is neutral." },
  { id: "macd", displayName: "MACD Regime 12/26/9", shortName: "MACD", role: "regime", family: "momentum", supportedTimeframes: ["1d", "1w"], parameters: { fast: 12, slow: 26, signal: 9 }, thresholdKind: "conditional", description: "MACD above its signal line is bullish; below is bearish." },
  { id: "psar", displayName: "Parabolic SAR", shortName: "Parabolic SAR", role: "regime", family: "ATR/trailing stop", supportedTimeframes: ["1d", "1w"], parameters: { step: 0.02, maximum: 0.2 }, thresholdKind: "provisional", description: "SAR below price is bullish; above price is bearish." },
  { id: "vortex", displayName: "Vortex 14", shortName: "Vortex", role: "regime", family: "momentum", supportedTimeframes: ["1d", "1w"], parameters: { length: 14 }, thresholdKind: "provisional", description: "VI+ above VI− is bullish; the inverse is bearish." },
  { id: "heikin_ashi", displayName: "Heikin Ashi Color", shortName: "Heikin Ashi", role: "regime", family: "smoothing/order", supportedTimeframes: ["1d", "1w"], parameters: { method: "standard recursive" }, thresholdKind: "provisional", description: "Synthetic candle color is used as an exploratory regime filter." },
  { id: "golden_cross", displayName: "Golden / Death Cross", shortName: "50/200 Cross", role: "regime", family: "smoothing/order", supportedTimeframes: ["1d"], parameters: { fast: 50, slow: 200 }, thresholdKind: "conditional", description: "Daily 50 SMA above 200 SMA is bullish; below is bearish." },
  { id: "adx", displayName: "ADX / DMI 14", shortName: "ADX / DMI", role: "confirmation", family: "trend strength", supportedTimeframes: ["1d", "1w"], parameters: { length: 14, weak: 20, strong: 25 }, thresholdKind: "conditional", description: "Direction comes from DMI ordering; ADX labels trend strength rather than a price regime." },
  { id: "chandelier", displayName: "Chandelier Exit 22/3", shortName: "Chandelier", role: "exit", family: "ATR/trailing stop", supportedTimeframes: ["1d", "1w"], parameters: { length: 22, factor: 3 }, thresholdKind: "provisional", description: "A volatility-adjusted trailing exit overlay, excluded from family agreement." },
  { id: "mayer", displayName: "Mayer Multiple", shortName: "Mayer Multiple", role: "valuation", family: "valuation", supportedTimeframes: ["1d"], parameters: { average: 200 }, thresholdKind: "conditional", description: "Price divided by the 200-day average; shown as valuation context, not a regime vote." },
  { id: "ma_200w", displayName: "200-Week Moving Average", shortName: "200W MA", role: "valuation", family: "valuation", supportedTimeframes: ["1w"], parameters: { average: 200 }, thresholdKind: "fixed", description: "A slow cycle reference, not an ordinary allocation switch." },
];

const INDICATOR_GUIDANCE: Record<string, IndicatorGuidance> = {
  support_band: {
    summary: "Treat the two averages as a support zone and act only on completed closes outside it.",
    positive: { label: "Positive / entry", rule: "A completed close strictly above both the 20 SMA and 21 EMA supports a bullish trend regime." },
    neutral: { label: "Wait", rule: "A close inside or touching the band is transitional. Wait for a completed close outside the zone." },
    negative: { label: "Negative / exit", rule: "A completed close strictly below both averages indicates that trend support has been lost." },
    rationale: "Two nearby smoothers form a zone, making the decision less brittle than one moving-average line.",
    caveats: ["Signals are effective at the next open, not at the historical closing price."],
  },
  supertrend: {
    summary: "Use the ATR trail as a close-confirmed trend switch and trailing risk level.",
    positive: { label: "Bullish reversal", rule: "A completed close reverses above the active upper band; the SuperTrend line then trails below price." },
    neutral: { label: "No neutral state", rule: "Keep the prior regime until a confirmed reversal. The still-open candle remains provisional." },
    negative: { label: "Bearish reversal / exit", rule: "A completed close reverses below the active lower band; a long/cash model moves risk-off next open." },
    rationale: "ATR widens or narrows the reversal distance with volatility while the final bands trail favorable movement.",
    caveats: ["Sideways markets can produce repeated reversals."],
  },
  kk_supertrend: {
    summary: "Use the asset-calibrated ATR trail as a close-confirmed trend switch and trailing risk level.",
    positive: { label: "Bullish reversal", rule: "A completed close above the active upper band reverses the preset bullish; its KK Supertrend line then trails below price." },
    neutral: { label: "No neutral state", rule: "Retain the prior regime until a completed close confirms a reversal; an unfinished daily or weekly candle remains provisional." },
    negative: { label: "Bearish reversal / exit", rule: "A completed close below the active lower band reverses the preset bearish; the long/cash backtest moves risk-off at the next open." },
    rationale: "Wilder ATR adapts the trail to current volatility. Supplied weekly references fit 10/3 for BTC, 10/2 for ETH and SOL, and the slower-smoothed 15/2 preset for DOGE, LINK, and XMR.",
    caveats: ["The calibration is fixed by asset and, for DOGE/LINK/XMR, timeframe rather than optimized for backtest performance; SUI remains uncalibrated and venue candles can produce small line and flip differences.", "Shorter ATR lengths react faster to new volatility; smaller factors pull the trail closer and can cause earlier but more frequent reversals."],
  },
  smma_ribbon: {
    summary: "Use full SMMA stacking as the signal; crossings and tangles are deliberately neutral.",
    positive: { label: "Gold / bullish", rule: "SMMA 15 > 19 > 25 > 29 on HL2 shows agreement from fast through slow horizons." },
    neutral: { label: "Grey / wait", rule: "Any crossing, equality, or tangled ordering means the horizons disagree. Wait for full alignment." },
    negative: { label: "Blue / bearish", rule: "SMMA 15 < 19 < 25 < 29 shows fully aligned downside structure." },
    rationale: "Strict stacking filters isolated crosses at the cost of later signals.",
    caveats: ["This is a community Larsson-style proxy; the official Larsson Line formula is private."],
  },
  super_guppy: {
    summary: "Read the Trader and Investor groups separately, then use R1.2 arrows as events rather than treating every gray bar as a trade.",
    positive: { label: "Uptrend / long evidence", rule: "Aqua Trader EMAs and lime Investor EMAs show established upside alignment. A lime Swing Buy arrow marks a pullback-entry setup; an aqua Trend Break Buy arrow is the more aggressive group-average crossover setup." },
    neutral: { label: "Gray / wait", rule: "Gray means a group is unestablished or in pullback. It is not automatically an exit; wait for renewed alignment or an explicit opposite event." },
    negative: { label: "Downtrend / risk-off", rule: "Blue Trader EMAs and red Investor EMAs show downside structure. Red Swing Sell and blue Trend Break Sell arrows are bearish events; for long-only use they are exit/risk-off evidence." },
    rationale: "The fast group approximates trader behavior and the slow group investor behavior. Expansion and agreement suggest trend strength; compression shows disagreement.",
    caveats: ["The dashboard's one regime state follows the active R1.2 Swing conditions; the chart preserves both original group states.", "Confluence, EMA-200 filtering, candle recoloring, average plots, and the anchor are off in the published defaults; the R1.2 settings panel can enable them."],
  },
  long_sma: {
    summary: "Use the long average as a slow trend filter, not as an early turning-point forecast.",
    positive: { label: "Positive / invested", rule: "A completed close at or above the configured 200-day or 30-week SMA supports the long-horizon trend." },
    neutral: { label: "No neutral state", rule: "When price is near the line, wait for the completed close rather than anticipating it." },
    negative: { label: "Negative / cash", rule: "A completed close below the long SMA defines the negative long-horizon filter." },
    rationale: "A slow baseline suppresses short-term noise but reacts late.",
    caveats: ["Repeated whipsaws are possible when price hugs the average."],
  },
  donchian_20_10: {
    summary: "Enter on a prior-20-bar breakout and exit on a faster prior-10-bar breakdown.",
    positive: { label: "Breakout entry", rule: "A close strictly above the highest high of the prior 20 bars starts the bullish state." },
    neutral: { label: "Retain prior state", rule: "Before the first breakout the state is neutral; afterward, closes between the two channels preserve the existing state." },
    negative: { label: "Breakdown exit", rule: "A close strictly below the lowest low of the prior 10 bars ends the bullish state." },
    rationale: "A slower entry and faster exit create hysteresis: demand meaningful upside confirmation while cutting failed trends sooner.",
    caveats: ["Neutral in the generic backtest means 50% exposure; that is a dashboard convention, not the classic Donchian rule."],
  },
  ichimoku: {
    summary: "Use price versus the displaced cloud as a regime filter.",
    positive: { label: "Above cloud", rule: "A completed close strictly above both displaced cloud spans supports a positive cloud regime." },
    neutral: { label: "Inside cloud / wait", rule: "Inside or touching the cloud signals equilibrium or uncertainty; wait for a decisive close outside." },
    negative: { label: "Below cloud", rule: "A completed close strictly below both spans supports a negative cloud regime." },
    rationale: "The cloud combines projected medium- and longer-horizon equilibrium.",
    caveats: ["This implementation is price versus cloud only, not full Tenkan/Kijun/Chikou confirmation."],
  },
  macd: {
    summary: "Use the MACD/signal crossover as momentum evidence, not a complete long-term trend system.",
    positive: { label: "Improving momentum", rule: "MACD at or above its signal line means momentum is improving relative to its recent trend." },
    neutral: { label: "No neutral state", rule: "A bullish crossover below zero is still only improving momentum, not proof of a long-term uptrend." },
    negative: { label: "Weakening momentum", rule: "MACD below its signal line means momentum is weakening." },
    rationale: "The difference between two EMAs measures trend acceleration; the signal EMA smooths that difference.",
    caveats: ["Use a trend or price filter if the strategy requires directional context."],
  },
  psar: {
    summary: "Use SAR as a fast trailing reversal system based on intrabar extremes.",
    positive: { label: "Bullish reversal", rule: "A reversal occurs when the bar's high penetrates projected SAR from a bearish state; dots then move below price." },
    neutral: { label: "No neutral state", rule: "The current bar's unfinished high or low can still change the provisional result." },
    negative: { label: "Bearish reversal / exit", rule: "A reversal occurs when the bar's low penetrates projected SAR from a bullish state; dots move above price." },
    rationale: "The acceleration factor tightens the trail as new extremes form.",
    caveats: ["Its responsiveness makes it vulnerable to sideways whipsaw."],
  },
  vortex: {
    summary: "Use the relative VI lines as directional evidence over the last 14 bars.",
    positive: { label: "Positive direction", rule: "VI+ at or above VI− means positive directional movement dominates." },
    neutral: { label: "No neutral state", rule: "Near-equal lines imply weak separation; wait for bar completion or other confirmation." },
    negative: { label: "Negative direction", rule: "VI− above VI+ means negative directional movement dominates." },
    rationale: "Directional path movement is normalized by true range so positive and negative evidence can be compared.",
    caveats: ["A crossover alone does not measure whether separation is economically meaningful."],
  },
  heikin_ashi: {
    summary: "Use synthetic candle color to smooth direction; do not treat synthetic prices as executable prices.",
    positive: { label: "Bullish color", rule: "Synthetic Heikin-Ashi close at or above its synthetic open produces a bullish state." },
    neutral: { label: "No neutral state", rule: "Wait for completion because current OHLC changes the synthetic candle; multi-bar confirmation is not implemented." },
    negative: { label: "Bearish color / exit", rule: "Synthetic close below synthetic open produces a bearish state." },
    rationale: "Recursive synthetic candles smooth visual noise.",
    caveats: ["Heikin-Ashi lags and its displayed OHLC is not directly tradable."],
  },
  golden_cross: {
    summary: "Use the 50/200 SMA relationship as a lagging long-horizon filter.",
    positive: { label: "Golden cross", rule: "The daily 50 SMA at or above the 200 SMA defines the bullish state." },
    neutral: { label: "No neutral state", rule: "Near convergence, wait for the completed crossover; this is not an early-entry tool." },
    negative: { label: "Death cross", rule: "The 50 SMA below the 200 SMA defines the bearish state." },
    rationale: "Comparing medium- and long-horizon averages filters noise.",
    caveats: ["Both averages materially lag turning points."],
  },
  adx: {
    summary: "Use DMI for direction and ADX for strength as confirmation of another regime.",
    positive: { label: "Positive confirmation", rule: "ADX at least 20 with +DI at or above −DI confirms positive direction; 20–25 is transitional and 25+ strong." },
    neutral: { label: "No confirmation", rule: "ADX below 20 means direction is too weak to confirm a trend, regardless of DI ordering." },
    negative: { label: "Negative confirmation", rule: "ADX at least 20 with −DI above +DI confirms negative direction; it is not a standalone exit." },
    rationale: "DMI supplies direction while ADX measures directional strength without regard to direction.",
    caveats: ["Combine it with an entry/exit regime rather than trading the label in isolation."],
  },
  chandelier: {
    summary: "Use the long Chandelier line as a volatility-adjusted exit, not as a new-entry signal.",
    positive: { label: "Long stop intact", rule: "A completed close at or above the long-exit line means the long volatility stop remains intact; this is not a new-entry signal." },
    neutral: { label: "No neutral state", rule: "Continue monitoring the stop until a completed close breach." },
    negative: { label: "Long-exit condition", rule: "A completed close below highest high(22) − 3 × ATR(22) triggers the implemented long exit." },
    rationale: "The stop allows more room when volatility is high and follows the highest recent price.",
    caveats: ["The displayed short-exit reference is context for short positions, not a buy threshold."],
  },
  mayer: {
    summary: "Read the multiple as continuous valuation context; this model does not issue entries or exits.",
    positive: { label: "Lower extension", rule: "A lower multiple means less extension above the 200-day average, not an automatic buy." },
    neutral: { label: "Reference context", rule: "A Mayer Multiple of 1.0 means price equals its 200-day SMA." },
    negative: { label: "Higher extension", rule: "A higher multiple means greater extension, but this implementation defines no sell threshold." },
    rationale: "Price divided by its long average creates a scale-free measure of trend-relative valuation.",
    caveats: ["Excluded from regime agreement and backtest allocation decisions."],
  },
  ma_200w: {
    summary: "Use the 200-week average as very slow cycle context, not as a precise trade switch.",
    positive: { label: "Above cycle baseline", rule: "Price above the average is above its slow cycle baseline; that is not independently a buy instruction." },
    neutral: { label: "Reference context", rule: "Near the line, treat it as context rather than a precise allocation decision." },
    negative: { label: "Below cycle baseline", rule: "Price below the line indicates cycle compression, not automatically a sell and potentially the opposite from a valuation perspective." },
    rationale: "The roughly four-year average supplies a stable but necessarily late cycle reference.",
    caveats: ["Excluded from family agreement."],
  },
};

export const INDICATOR_SPECS: IndicatorSpec[] = BASE_INDICATOR_SPECS.map(spec => ({ ...spec, guidance: INDICATOR_GUIDANCE[spec.id] }));

const finite = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

export function normalizeSuperGuppyConfig(input: Partial<SuperGuppyConfig> = {}): SuperGuppyConfig {
  const lengths = (candidate: number[] | undefined, fallback: number[], expected: number) => Array.isArray(candidate) && candidate.length === expected && candidate.every(value => Number.isInteger(value) && value > 0 && value <= 1000) ? [...candidate] : [...fallback];
  const sources: SuperGuppySource[] = ["close", "open", "high", "low", "hl2", "hlc3", "ohlc4"];
  return {
    fastLengths: lengths(input.fastLengths, SUPER_GUPPY_R12_DEFAULTS.fastLengths, 11),
    slowLengths: lengths(input.slowLengths, SUPER_GUPPY_R12_DEFAULTS.slowLengths, 16),
    source: sources.includes(input.source as SuperGuppySource) ? input.source as SuperGuppySource : SUPER_GUPPY_R12_DEFAULTS.source,
    anchorMinutes: finite(input.anchorMinutes) ? Math.max(0, Math.min(1_440, Math.round(input.anchorMinutes!))) : 0,
    showBreak: input.showBreak ?? SUPER_GUPPY_R12_DEFAULTS.showBreak,
    showSwing: input.showSwing ?? SUPER_GUPPY_R12_DEFAULTS.showSwing,
    requireConfluence: input.requireConfluence ?? SUPER_GUPPY_R12_DEFAULTS.requireConfluence,
    candleChangeRetriggers: input.candleChangeRetriggers ?? SUPER_GUPPY_R12_DEFAULTS.candleChangeRetriggers,
    lookback: finite(input.lookback) ? Math.max(0, Math.min(100, Math.round(input.lookback!))) : SUPER_GUPPY_R12_DEFAULTS.lookback,
    showAverages: input.showAverages ?? SUPER_GUPPY_R12_DEFAULTS.showAverages,
    showEma200: input.showEma200 ?? SUPER_GUPPY_R12_DEFAULTS.showEma200,
    ema200Filter: input.ema200Filter ?? SUPER_GUPPY_R12_DEFAULTS.ema200Filter,
    colorBars: input.colorBars ?? SUPER_GUPPY_R12_DEFAULTS.colorBars,
  };
}

function sma(values: number[], length: number): Array<number | null> {
  const out: Array<number | null> = Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= length) sum -= values[i - length];
    if (i >= length - 1) out[i] = sum / length;
  }
  return out;
}

function ema(values: number[], length: number): Array<number | null> {
  const out: Array<number | null> = Array(values.length).fill(null);
  if (!values.length) return out;
  const alpha = 2 / (length + 1);
  let current = values[0];
  out[0] = current;
  for (let i = 1; i < values.length; i++) {
    current = alpha * values[i] + (1 - alpha) * current;
    out[i] = current;
  }
  return out;
}

function rma(values: number[], length: number): Array<number | null> {
  const out: Array<number | null> = Array(values.length).fill(null);
  if (values.length < length) return out;
  let seed = 0;
  for (let i = 0; i < length; i++) seed += values[i];
  let current = seed / length;
  out[length - 1] = current;
  for (let i = length; i < values.length; i++) {
    current = (current * (length - 1) + values[i]) / length;
    out[i] = current;
  }
  return out;
}

function rollingMid(candles: Candle[], length: number): Array<number | null> {
  return candles.map((_, i) => {
    if (i < length - 1) return null;
    const window = candles.slice(i - length + 1, i + 1);
    return (Math.max(...window.map(c => c.high)) + Math.min(...window.map(c => c.low))) / 2;
  });
}

function trueRanges(candles: Candle[]): number[] {
  return candles.map((c, i) => i === 0 ? c.high - c.low : Math.max(c.high - c.low, Math.abs(c.high - candles[i - 1].close), Math.abs(c.low - candles[i - 1].close)));
}

function points(candles: Candle[], values: Array<number | null>, name: string, color: string, dashed = false): OverlaySeries {
  return { name, color, dashed, points: candles.flatMap((c, i) => finite(values[i]) ? [{ time: c.time, value: values[i] as number }] : []) };
}

function lastState(states: Array<RegimeState | null>): { state: RegimeState; previous: RegimeState; lastFlip: number | null; flipIndex: number | null } {
  let idx = states.length - 1;
  while (idx >= 0 && states[idx] === null) idx--;
  const state = idx >= 0 ? states[idx] as RegimeState : "neutral";
  let prev = state;
  let flipIndex: number | null = null;
  for (let i = idx - 1; i >= 0; i--) {
    if (states[i] !== null && states[i] !== state) { prev = states[i] as RegimeState; flipIndex = i + 1; break; }
  }
  return { state, previous: prev, lastFlip: null, flipIndex };
}

function buildSnapshot(
  spec: IndicatorSpec,
  candles: Candle[],
  states: Array<RegimeState | null>,
  overlays: OverlaySeries[],
  values: Record<string, number | null>,
  bullTrigger: number | null,
  bearTrigger: number | null,
  triggerLabel: string,
  explanation?: string,
  visuals: { ribbons?: RibbonBand[]; events?: SignalEvent[]; barColors?: BarColorPoint[] } = {},
): SignalSnapshot {
  const stateMeta = lastState(states);
  return { id: spec.id, displayName: spec.displayName, shortName: spec.shortName, role: spec.role, family: spec.family, state: stateMeta.state, previousState: stateMeta.previous, lastFlip: stateMeta.flipIndex === null ? null : candles[stateMeta.flipIndex]?.time ?? null, thresholdKind: spec.thresholdKind, bullTrigger, bearTrigger, triggerLabel, explanation: explanation ?? spec.description, guidance: spec.guidance, values, disclaimer: spec.disclaimer, sourceUrl: spec.sourceUrl, overlays, ribbons: visuals.ribbons ?? [], events: visuals.events ?? [], barColors: visuals.barColors ?? [], states };
}

function supportBand(candles: Candle[], spec: IndicatorSpec): SignalSnapshot {
  const closes = candles.map(c => c.close), s = sma(closes, 20), e = ema(closes, 21);
  const states = closes.map((c, i): RegimeState | null => !finite(s[i]) || !finite(e[i]) ? null : c > Math.max(s[i]!, e[i]!) ? "bull" : c < Math.min(s[i]!, e[i]!) ? "bear" : "neutral");
  const prev19 = closes.length >= 19 ? closes.slice(-19).reduce((a, b) => a + b, 0) / 19 : null;
  const lastEma = e.at(-1) ?? null;
  const bull = finite(prev19) && finite(lastEma) ? Math.max(prev19, lastEma) : null;
  const bear = finite(prev19) && finite(lastEma) ? Math.min(prev19, lastEma) : null;
  return buildSnapshot(spec, candles, states, [points(candles, s, "20 SMA", "#d7a928"), points(candles, e, "21 EMA", "#264f66")], { sma: s.at(-1) ?? null, ema: e.at(-1) ?? null }, bull, bear, "Exact close thresholds fixed from completed candles");
}

function supertrend(candles: Candle[], spec: IndicatorSpec, length: number, factor: number, overlay: { name: string; color: string }): SignalSnapshot {
  const atr = rma(trueRanges(candles), length), upper: Array<number | null> = Array(candles.length).fill(null), lower = [...upper], st = [...upper], states: Array<RegimeState | null> = Array(candles.length).fill(null);
  for (let i = 0; i < candles.length; i++) {
    if (!finite(atr[i])) continue;
    const hl2 = (candles[i].high + candles[i].low) / 2;
    const bu = hl2 + factor * atr[i]!, bl = hl2 - factor * atr[i]!;
    if (i === 0 || !finite(upper[i - 1]) || !finite(lower[i - 1])) {
      upper[i] = bu; lower[i] = bl; states[i] = "bear"; st[i] = bu; continue;
    }
    upper[i] = bu < upper[i - 1]! || candles[i - 1].close > upper[i - 1]! ? bu : upper[i - 1];
    lower[i] = bl > lower[i - 1]! || candles[i - 1].close < lower[i - 1]! ? bl : lower[i - 1];
    const wasUpper = st[i - 1] === upper[i - 1];
    states[i] = wasUpper ? (candles[i].close > upper[i]! ? "bull" : "bear") : (candles[i].close < lower[i]! ? "bear" : "bull");
    st[i] = states[i] === "bull" ? lower[i] : upper[i];
  }
  const meta = lastState(states), level = st.at(-1) ?? null;
  return buildSnapshot(spec, candles, states, [points(candles, st, overlay.name, overlay.color)], { atr: atr.at(-1) ?? null, atrLength: length, supertrend: level, factor }, meta.state === "bear" ? level : null, meta.state === "bull" ? level : null, "Provisional until the open candle completes");
}

function ribbon(candles: Candle[], spec: IndicatorSpec): SignalSnapshot {
  const source = candles.map(c => (c.high + c.low) / 2), lengths = [15, 19, 25, 29], lines = lengths.map(n => rma(source, n));
  const states = candles.map((_, i): RegimeState | null => {
    const v = lines.map(line => line[i]); if (v.some(x => !finite(x))) return null;
    if (v[0]! > v[1]! && v[1]! > v[2]! && v[2]! > v[3]!) return "bull";
    if (v[0]! < v[1]! && v[1]! < v[2]! && v[2]! < v[3]!) return "bear";
    return "neutral";
  });
  const rangePoints: RibbonPoint[] = candles.flatMap((candle, i) => {
    const values = lines.map(line => line[i]);
    return states[i] && values.every(finite) ? [{ time: candle.time, upper: Math.max(...values as number[]), lower: Math.min(...values as number[]), state: states[i]! }] : [];
  });
  const overlays = lines.map((line, i) => ({ ...points(candles, line, `SMMA ${lengths[i]}`, "#66716c"), width: 0.8, showInLegend: false }));
  return buildSnapshot(spec, candles, states, overlays, Object.fromEntries(lengths.map((n, i) => [`smma${n}`, lines[i].at(-1) ?? null])), null, null, "Gold = fully bullish · grey = tangled/neutral · blue = fully bearish", undefined, {
    ribbons: [{ id: "smma-range", name: "SMMA regime range", palette: { bull: "#d7a928", neutral: "#919896", bear: "#264f66" }, fillOpacity: 0.5, points: rangePoints }],
  });
}

function superGuppy(candles: Candle[], spec: IndicatorSpec, timeframe: Timeframe, input: Partial<SuperGuppyConfig> = {}): SignalSnapshot {
  const config = normalizeSuperGuppyConfig(input);
  const baseMinutes = timeframe === "1d" ? 1_440 : 7_200;
  const anchorMultiplier = config.anchorMinutes > baseMinutes ? Math.max(1, Math.round(config.anchorMinutes / baseMinutes)) : 1;
  const fastBaseLengths = config.fastLengths, slowBaseLengths = config.slowLengths;
  const fastLengths = fastBaseLengths.map(length => length * anchorMultiplier);
  const slowLengths = slowBaseLengths.map(length => length * anchorMultiplier);
  const lengths = [...fastLengths, ...slowLengths];
  const source = candles.map(candle => config.source === "open" ? candle.open : config.source === "high" ? candle.high : config.source === "low" ? candle.low : config.source === "hl2" ? (candle.high + candle.low) / 2 : config.source === "hlc3" ? (candle.high + candle.low + candle.close) / 3 : config.source === "ohlc4" ? (candle.open + candle.high + candle.low + candle.close) / 4 : candle.close);
  const lines = lengths.map(length => ema(source, length));
  const fastLines = lines.slice(0, fastLengths.length), slowLines = lines.slice(fastLengths.length);
  const fastAverages: number[] = candles.map((_, i) => fastLines.reduce((sum, line) => sum + line[i]!, 0) / fastLines.length);
  const slowAverages: number[] = candles.map((_, i) => slowLines.reduce((sum, line) => sum + line[i]!, 0) / slowLines.length);
  const ema200 = ema(source, 200 * anchorMultiplier);
  const fastStates: RegimeState[] = [], slowStates: RegimeState[] = [];
  const fastLongFlags: boolean[] = [], fastShortFlags: boolean[] = [];
  const buyConditions: boolean[] = [], sellConditions: boolean[] = [], buyBreakConditions: boolean[] = [], sellBreakConditions: boolean[] = [];
  const states: RegimeState[] = [];
  const strictlyFalling = (values: number[]) => values.every((value, index) => index === 0 || values[index - 1] > value);
  const strictlyRising = (values: number[]) => values.every((value, index) => index === 0 || values[index - 1] < value);
  for (let i = 0; i < candles.length; i++) {
    const fast = fastLines.map(line => line[i]!), slow = slowLines.map(line => line[i]!);
    const fastLong = strictlyFalling(fast), fastShort = strictlyRising(fast), slowLong = strictlyFalling(slow), slowShort = strictlyRising(slow);
    fastLongFlags[i] = fastLong; fastShortFlags[i] = fastShort;
    fastStates[i] = fastLong && slow[0] > slow.at(-1)! ? "bull" : fastShort && slow[0] < slow.at(-1)! ? "bear" : "neutral";
    slowStates[i] = slowLong ? "bull" : slowShort ? "bear" : "neutral";
    buyConditions[i] = fastAverages[i] > slowAverages[i] && slow[0] > slow.at(-1)! && !slowShort && fastLong && (!config.requireConfluence || slowLong) && (!config.ema200Filter || fastAverages[i] > ema200[i]!);
    sellConditions[i] = fastAverages[i] < slowAverages[i] && slow[0] < slow.at(-1)! && !slowLong && fastShort && (!config.requireConfluence || slowShort) && (!config.ema200Filter || fastAverages[i] < ema200[i]!);
    buyBreakConditions[i] = fastAverages[i] > slowAverages[i] && !slowShort && (!config.ema200Filter || fastAverages[i] > ema200[i]!);
    sellBreakConditions[i] = fastAverages[i] < slowAverages[i] && !slowLong && (!config.ema200Filter || fastAverages[i] < ema200[i]!);
    states[i] = buyConditions[i] ? "bull" : sellConditions[i] ? "bear" : "neutral";
  }

  const fastColors = fastStates.map(state => state === "bull" ? "#00ffff" : state === "bear" ? "#0000ff" : "#808080");
  const slowColors = slowStates.map(state => state === "bull" ? "#00ff00" : state === "bear" ? "#ff0000" : "#808080");
  const visibleIndices = new Set([0, 1, 3, 5, 7, 9, 10, ...[0, 1, 3, 5, 8, 10, 15].map(index => fastLengths.length + index)]);
  const overlays: OverlaySeries[] = lines.flatMap((line, lineIndex) => {
    if (!visibleIndices.has(lineIndex)) return [];
    const fast = lineIndex < fastLengths.length, baseLength = fast ? fastBaseLengths[lineIndex] : slowBaseLengths[lineIndex - fastLengths.length], colors = fast ? fastColors : slowColors;
    return {
      name: `EMA ${baseLength}${anchorMultiplier > 1 ? ` × ${anchorMultiplier}` : ""}`,
      legendLabel: lineIndex === 0 ? "Trader EMAs" : lineIndex === fastLengths.length ? "Investor EMAs" : undefined,
      color: colors.at(-1) ?? "#808080",
      width: 1,
      showInLegend: lineIndex === 0 || lineIndex === fastLengths.length,
      points: candles.map((candle, i) => ({ time: candle.time, value: line[i]!, color: colors[i] })),
    };
  });
  if (config.showAverages) {
    overlays.push({ name: "Trader average", color: "#ffd700", width: 1.4, pointStyle: "circles", points: candles.map((candle, i) => ({ time: candle.time, value: fastAverages[i] })) });
    overlays.push({ name: "Investor average", color: "#ff00ff", width: 1.4, pointStyle: "circles", points: candles.map((candle, i) => ({ time: candle.time, value: slowAverages[i] })) });
  }
  if (config.showEma200) overlays.push(points(candles, ema200, "EMA 200", "#111111"));

  const counter = (conditions: boolean[]) => {
    const out: number[] = [];
    for (let i = 0; i < conditions.length; i++) out[i] = conditions[i] ? (out[i - 1] ?? 0) + 1 : 0;
    return out;
  };
  const swingCounter = (conditions: boolean[], direction: "bull" | "bear") => {
    const out: number[] = [];
    for (let i = 0; i < conditions.length; i++) {
      out[i] = conditions[i] ? (out[i - 1] ?? 0) + 1 : 0;
      if (!config.candleChangeRetriggers || out[i] <= 1 || i === 0) continue;
      const changed = direction === "bull"
        ? fastLongFlags[i] && candles[i - 1].close < candles[i - 1].open && candles[i].close > candles[i].open
        : fastShortFlags[i] && candles[i - 1].close > candles[i - 1].open && candles[i].close < candles[i].open;
      if (changed) out[i] = 1;
    }
    return out;
  };
  const buy = swingCounter(buyConditions, "bull"), sell = swingCounter(sellConditions, "bear"), buyBreak = counter(buyBreakConditions), sellBreak = counter(sellBreakConditions);
  const barsSinceShiftedStart = (series: number[]) => {
    const out: number[] = [];
    let last = 0;
    for (let i = 0; i < series.length; i++) {
      if ((i === 0 ? 1 : series[i - 1]) === 1) last = i;
      out[i] = i - last;
    }
    return out;
  };
  const sinceBuy = barsSinceShiftedStart(buy), sinceSell = barsSinceShiftedStart(sell), sinceBuyBreak = barsSinceShiftedStart(buyBreak), sinceSellBreak = barsSinceShiftedStart(sellBreak);
  const events: SignalEvent[] = [];
  const addEvent = (i: number, kind: SignalEventKind, direction: "bull" | "bear", label: string, color: string) => events.push({
    time: candles[i].time,
    kind,
    direction,
    label,
    price: direction === "bull" ? candles[i].low : candles[i].high,
    color,
    confirmedAt: candles[i].time,
    effectiveAt: candles[i + 1]?.time ?? null,
  });
  for (let i = 0; i < candles.length; i++) {
    if (config.showSwing && buy[i] === 1 && sinceBuy[i] > config.lookback) addEvent(i, "swing", "bull", "Swing Buy", "#00ff00");
    if (config.showSwing && sell[i] === 1 && sinceSell[i] > config.lookback) addEvent(i, "swing", "bear", "Swing Sell", "#ff0000");
    if (config.showBreak && buyBreak[i] === 1 && sinceBuyBreak[i] > config.lookback && sinceSellBreak[i] > config.lookback) addEvent(i, "trend_break", "bull", "Trend Break Buy", "#00ffff");
    if (config.showBreak && sellBreak[i] === 1 && sinceSellBreak[i] > config.lookback && sinceBuyBreak[i] > config.lookback) addEvent(i, "trend_break", "bear", "Trend Break Sell", "#0000ff");
  }

  const ribbons: RibbonBand[] = [
    {
      id: "guppy-trader",
      name: "Trader group",
      palette: { bull: "#c0c0c0", neutral: "#c0c0c0", bear: "#c0c0c0" },
      fillOpacity: 0.05,
      showInLegend: false,
      points: candles.map((candle, i) => ({ time: candle.time, upper: Math.max(fastLines[0][i]!, fastLines.at(-1)![i]!), lower: Math.min(fastLines[0][i]!, fastLines.at(-1)![i]!), state: fastStates[i] })),
    },
    {
      id: "guppy-investor",
      name: "Investor group",
      palette: { bull: "#c0c0c0", neutral: "#c0c0c0", bear: "#c0c0c0" },
      fillOpacity: 0.05,
      showInLegend: false,
      points: candles.map((candle, i) => ({ time: candle.time, upper: Math.max(slowLines[0][i]!, slowLines.at(-1)![i]!), lower: Math.min(slowLines[0][i]!, slowLines.at(-1)![i]!), state: slowStates[i] })),
    },
  ];
  const fastFirst = fastLines[0].at(-1) ?? null, fastLast = fastLines.at(-1)!.at(-1) ?? null, slowFirst = slowLines[0].at(-1) ?? null, slowLast = slowLines.at(-1)!.at(-1) ?? null;
  const barColors: BarColorPoint[] = config.colorBars ? candles.map((candle, i) => ({ time: candle.time, color: fastColors[i] })) : [];
  return buildSnapshot(spec, candles, states, overlays, {
    fastFirst,
    fastLast,
    slowFirst,
    slowLast,
    fastAverage: fastAverages.at(-1) ?? null,
    slowAverage: slowAverages.at(-1) ?? null,
    ema200: ema200.at(-1) ?? null,
    anchorMultiplier,
    lookback: config.lookback,
    confluenceEnabled: config.requireConfluence ? 1 : 0,
    candleChangeRetriggersEnabled: config.candleChangeRetriggers ? 1 : 0,
    ema200FilterEnabled: config.ema200Filter ? 1 : 0,
    fastGroupState: fastStates.at(-1) === "bull" ? 1 : fastStates.at(-1) === "bear" ? -1 : 0,
    slowGroupState: slowStates.at(-1) === "bull" ? 1 : slowStates.at(-1) === "bear" ? -1 : 0,
    fastSpread: finite(fastFirst) && finite(fastLast) ? fastFirst / fastLast - 1 : null,
    slowSpread: finite(slowFirst) && finite(slowLast) ? slowFirst / slowLast - 1 : null,
  }, null, null, `R1.2 · ${config.showSwing ? "Swing on" : "Swing off"} · ${config.showBreak ? "Trend Break on" : "Trend Break off"} · ${config.lookback}-bar repeat filter`, `Trader: aqua up / blue down / gray · Investor: lime up / red down / gray · source ${config.source.toUpperCase()}`, { ribbons, events, barColors });
}

function longSma(candles: Candle[], spec: IndicatorSpec, timeframe: Timeframe): SignalSnapshot {
  const n = timeframe === "1d" ? 200 : 30, closes = candles.map(c => c.close), avg = sma(closes, n);
  const states = closes.map((c, i): RegimeState | null => !finite(avg[i]) ? null : c >= avg[i]! ? "bull" : "bear");
  const trigger = closes.length >= n - 1 ? closes.slice(-(n - 1)).reduce((a, b) => a + b, 0) / (n - 1) : null;
  return buildSnapshot(spec, candles, states, [points(candles, avg, `${n} SMA`, "#d7a928")], { sma: avg.at(-1) ?? null, slope: finite(avg.at(-1)) && finite(avg.at(-2)) ? avg.at(-1)! - avg.at(-2)! : null }, trigger, trigger, `Exact next-close threshold from the prior ${n - 1} closes`);
}

function donchian(candles: Candle[], spec: IndicatorSpec, entry: number, exit: number): SignalSnapshot {
  const upper: Array<number | null> = Array(candles.length).fill(null), lower = [...upper], states: Array<RegimeState | null> = Array(candles.length).fill(null);
  let state: RegimeState = "neutral";
  for (let i = 0; i < candles.length; i++) {
    if (i >= entry) upper[i] = Math.max(...candles.slice(i - entry, i).map(c => c.high));
    if (i >= exit) lower[i] = Math.min(...candles.slice(i - exit, i).map(c => c.low));
    if (finite(upper[i]) && candles[i].close > upper[i]!) state = "bull";
    else if (finite(lower[i]) && candles[i].close < lower[i]!) state = "bear";
    states[i] = i >= Math.max(entry, exit) ? state : null;
  }
  return buildSnapshot(spec, candles, states, [points(candles, upper, `${entry}-period high`, "#0b8a61", true), points(candles, lower, `${exit}-period low`, "#c95545", true)], { upper: upper.at(-1) ?? null, lower: lower.at(-1) ?? null }, upper.at(-1) ?? null, lower.at(-1) ?? null, "Fixed from prior completed candles");
}

function ichimoku(candles: Candle[], spec: IndicatorSpec): SignalSnapshot {
  const tenkan = rollingMid(candles, 9), kijun = rollingMid(candles, 26), rawB = rollingMid(candles, 52), spanA: Array<number | null> = Array(candles.length).fill(null), spanB = [...spanA];
  for (let i = 0; i < candles.length; i++) if (i + 26 < candles.length) {
    if (finite(tenkan[i]) && finite(kijun[i])) spanA[i + 26] = (tenkan[i]! + kijun[i]!) / 2;
    if (finite(rawB[i])) spanB[i + 26] = rawB[i];
  }
  const states = candles.map((c, i): RegimeState | null => !finite(spanA[i]) || !finite(spanB[i]) ? null : c.close > Math.max(spanA[i]!, spanB[i]!) ? "bull" : c.close < Math.min(spanA[i]!, spanB[i]!) ? "bear" : "neutral");
  return buildSnapshot(spec, candles, states, [points(candles, spanA, "Senkou A", "#0b8a61"), points(candles, spanB, "Senkou B", "#c95545")], { spanA: spanA.at(-1) ?? null, spanB: spanB.at(-1) ?? null, tenkan: tenkan.at(-1) ?? null, kijun: kijun.at(-1) ?? null }, null, null, "Cloud condition; no single guaranteed flip price");
}

function macd(candles: Candle[], spec: IndicatorSpec): SignalSnapshot {
  const closes = candles.map(c => c.close), fast = ema(closes, 12), slow = ema(closes, 26), line = closes.map((_, i) => finite(fast[i]) && finite(slow[i]) ? fast[i]! - slow[i]! : 0), signal = ema(line, 9);
  const states = line.map((v, i): RegimeState | null => !finite(signal[i]) ? null : v >= signal[i]! ? "bull" : "bear");
  return buildSnapshot(spec, candles, states, [], { macd: line.at(-1) ?? null, signal: signal.at(-1) ?? null, histogram: finite(signal.at(-1)) ? line.at(-1)! - signal.at(-1)! : null }, null, null, "Momentum crossover condition; displayed in the evidence panel");
}

function psar(candles: Candle[], spec: IndicatorSpec): SignalSnapshot {
  const sar: Array<number | null> = Array(candles.length).fill(null), states: Array<RegimeState | null> = Array(candles.length).fill(null);
  if (candles.length < 2) return buildSnapshot(spec, candles, states, [], {}, null, null, "Insufficient data");
  let bull = candles[1].close >= candles[0].close, af = 0.02, ep = bull ? Math.max(candles[0].high, candles[1].high) : Math.min(candles[0].low, candles[1].low);
  sar[1] = bull ? Math.min(candles[0].low, candles[1].low) : Math.max(candles[0].high, candles[1].high); states[1] = bull ? "bull" : "bear";
  for (let i = 2; i < candles.length; i++) {
    let next = sar[i - 1]! + af * (ep - sar[i - 1]!);
    if (bull) {
      next = Math.min(next, candles[i - 1].low, candles[i - 2].low);
      if (candles[i].low < next) { bull = false; next = ep; ep = candles[i].low; af = 0.02; }
      else if (candles[i].high > ep) { ep = candles[i].high; af = Math.min(0.2, af + 0.02); }
    } else {
      next = Math.max(next, candles[i - 1].high, candles[i - 2].high);
      if (candles[i].high > next) { bull = true; next = ep; ep = candles[i].high; af = 0.02; }
      else if (candles[i].low < ep) { ep = candles[i].low; af = Math.min(0.2, af + 0.02); }
    }
    sar[i] = next; states[i] = bull ? "bull" : "bear";
  }
  const meta = lastState(states), level = sar.at(-1) ?? null;
  return buildSnapshot(spec, candles, states, [points(candles, sar, "SAR", "#8769c3")], { sar: level }, meta.state === "bear" ? level : null, meta.state === "bull" ? level : null, "Provisional while the current high/low can change");
}

function vortex(candles: Candle[], spec: IndicatorSpec): SignalSnapshot {
  const tr = trueRanges(candles), plus = candles.map((c, i) => i ? Math.abs(c.high - candles[i - 1].low) : 0), minus = candles.map((c, i) => i ? Math.abs(c.low - candles[i - 1].high) : 0);
  const vip: Array<number | null> = Array(candles.length).fill(null), vim = [...vip], n = 14;
  for (let i = n; i < candles.length; i++) {
    const sumTr = tr.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0);
    if (sumTr) { vip[i] = plus.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / sumTr; vim[i] = minus.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / sumTr; }
  }
  const states = candles.map((_, i): RegimeState | null => !finite(vip[i]) || !finite(vim[i]) ? null : vip[i]! >= vim[i]! ? "bull" : "bear");
  return buildSnapshot(spec, candles, states, [], { viPlus: vip.at(-1) ?? null, viMinus: vim.at(-1) ?? null }, null, null, "Directional crossover depends on completed OHLC");
}

function heikinAshi(candles: Candle[], spec: IndicatorSpec): SignalSnapshot {
  const ho: number[] = [], hc: number[] = [], hh: number[] = [], hl: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    hc[i] = (candles[i].open + candles[i].high + candles[i].low + candles[i].close) / 4;
    ho[i] = i === 0 ? (candles[i].open + candles[i].close) / 2 : (ho[i - 1] + hc[i - 1]) / 2;
    hh[i] = Math.max(candles[i].high, ho[i], hc[i]); hl[i] = Math.min(candles[i].low, ho[i], hc[i]);
  }
  const states = hc.map((c, i): RegimeState => c >= ho[i] ? "bull" : "bear");
  return buildSnapshot(spec, candles, states, [], { haOpen: ho.at(-1) ?? null, haHigh: hh.at(-1) ?? null, haLow: hl.at(-1) ?? null, haClose: hc.at(-1) ?? null }, null, null, "Synthetic candle color remains provisional until close");
}

function goldenCross(candles: Candle[], spec: IndicatorSpec): SignalSnapshot {
  const closes = candles.map(c => c.close), fast = sma(closes, 50), slow = sma(closes, 200);
  const states = candles.map((_, i): RegimeState | null => !finite(fast[i]) || !finite(slow[i]) ? null : fast[i]! >= slow[i]! ? "bull" : "bear");
  return buildSnapshot(spec, candles, states, [points(candles, fast, "50 SMA", "#d7a928"), points(candles, slow, "200 SMA", "#264f66")], { sma50: fast.at(-1) ?? null, sma200: slow.at(-1) ?? null }, null, null, "Average crossover condition; no single displayed price");
}

function adx(candles: Candle[], spec: IndicatorSpec): SignalSnapshot {
  const tr = trueRanges(candles), plusDm = candles.map((c, i) => i ? (c.high - candles[i - 1].high > candles[i - 1].low - c.low && c.high > candles[i - 1].high ? c.high - candles[i - 1].high : 0) : 0), minusDm = candles.map((c, i) => i ? (candles[i - 1].low - c.low > c.high - candles[i - 1].high && c.low < candles[i - 1].low ? candles[i - 1].low - c.low : 0) : 0);
  const atr = rma(tr, 14), plusR = rma(plusDm, 14), minusR = rma(minusDm, 14), pdi: Array<number | null> = [], mdi: Array<number | null> = [], dx: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    pdi[i] = finite(atr[i]) && atr[i]! > 0 && finite(plusR[i]) ? 100 * plusR[i]! / atr[i]! : null;
    mdi[i] = finite(atr[i]) && atr[i]! > 0 && finite(minusR[i]) ? 100 * minusR[i]! / atr[i]! : null;
    dx[i] = finite(pdi[i]) && finite(mdi[i]) && pdi[i]! + mdi[i]! > 0 ? 100 * Math.abs(pdi[i]! - mdi[i]!) / (pdi[i]! + mdi[i]!) : 0;
  }
  const adxLine = rma(dx, 14), states = candles.map((_, i): RegimeState | null => !finite(adxLine[i]) ? null : adxLine[i]! < 20 ? "neutral" : pdi[i]! >= mdi[i]! ? "bull" : "bear");
  const strength = !finite(adxLine.at(-1)) ? "unavailable" : adxLine.at(-1)! < 20 ? "weak" : adxLine.at(-1)! < 25 ? "transitional" : "strong";
  return buildSnapshot(spec, candles, states, [], { adx: adxLine.at(-1) ?? null, plusDI: pdi.at(-1) ?? null, minusDI: mdi.at(-1) ?? null }, null, null, `${strength} trend strength; confirmation only`);
}

function chandelier(candles: Candle[], spec: IndicatorSpec): SignalSnapshot {
  const atr = rma(trueRanges(candles), 22), longExit: Array<number | null> = Array(candles.length).fill(null), shortExit = [...longExit];
  for (let i = 21; i < candles.length; i++) if (finite(atr[i])) {
    longExit[i] = Math.max(...candles.slice(i - 21, i + 1).map(c => c.high)) - 3 * atr[i]!;
    shortExit[i] = Math.min(...candles.slice(i - 21, i + 1).map(c => c.low)) + 3 * atr[i]!;
  }
  const states = candles.map((c, i): RegimeState | null => !finite(longExit[i]) ? null : c.close >= longExit[i]! ? "bull" : "bear");
  return buildSnapshot(spec, candles, states, [points(candles, longExit, "Long exit", "#c95545", true)], { longExit: longExit.at(-1) ?? null, shortExit: shortExit.at(-1) ?? null }, shortExit.at(-1) ?? null, longExit.at(-1) ?? null, "Trailing exit level is provisional until close");
}

function valuation(candles: Candle[], spec: IndicatorSpec, timeframe: Timeframe): SignalSnapshot {
  const closes = candles.map(c => c.close), avg = sma(closes, 200);
  if (spec.id === "mayer") {
    const multiple = finite(avg.at(-1)) ? closes.at(-1)! / avg.at(-1)! : null;
    return buildSnapshot(spec, candles, candles.map(() => null), [], { multiple, sma200: avg.at(-1) ?? null }, null, null, "Valuation context only; excluded from regime agreement");
  }
  const states = closes.map((c, i): RegimeState | null => !finite(avg[i]) ? null : c >= avg[i]! ? "bull" : "bear");
  return buildSnapshot(spec, candles, states, [points(candles, avg, "200W MA", "#d7a928")], { sma200: avg.at(-1) ?? null }, avg.at(-1) ?? null, avg.at(-1) ?? null, timeframe === "1w" ? "Cycle reference only; excluded from regime agreement" : "Weekly only");
}

export function calculateIndicators(candles: Candle[], timeframe: Timeframe, options: IndicatorCalculationOptions = {}): SignalSnapshot[] {
  const configuredKk = options.market === "equity"
    ? { atrLength: KK_SUPERTREND_ATR_LENGTH, factor: KK_SUPERTREND_EQUITY_FACTOR }
    : KK_SUPERTREND_PRESETS[options.asset ?? "btc"][timeframe];
  const explicitKkFactor = finite(options.kkSupertrendFactor) && options.kkSupertrendFactor! > 0 ? options.kkSupertrendFactor! : null;
  const explicitKkAtrLength = Number.isInteger(options.kkSupertrendAtrLength) && options.kkSupertrendAtrLength! > 0 ? options.kkSupertrendAtrLength! : null;
  const kkFactor = explicitKkFactor ?? configuredKk.factor;
  const kkAtrLength = explicitKkAtrLength ?? configuredKk.atrLength;
  return INDICATOR_SPECS.filter(s => s.supportedTimeframes.includes(timeframe)).map(spec => {
    switch (spec.id) {
      case "support_band": return supportBand(candles, spec);
      case "supertrend": return supertrend(candles, spec, 10, 3, { name: "SuperTrend", color: "#8769c3" });
      case "kk_supertrend": return supertrend(candles, spec, kkAtrLength, kkFactor, { name: "KK Supertrend", color: "#d7a928" });
      case "smma_ribbon": return ribbon(candles, spec);
      case "super_guppy": return superGuppy(candles, spec, timeframe, options.superGuppy);
      case "long_sma": return longSma(candles, spec, timeframe);
      case "donchian_20_10": return donchian(candles, spec, 20, 10);
      case "ichimoku": return ichimoku(candles, spec);
      case "macd": return macd(candles, spec);
      case "psar": return psar(candles, spec);
      case "vortex": return vortex(candles, spec);
      case "heikin_ashi": return heikinAshi(candles, spec);
      case "golden_cross": return goldenCross(candles, spec);
      case "adx": return adx(candles, spec);
      case "chandelier": return chandelier(candles, spec);
      case "mayer": case "ma_200w": return valuation(candles, spec, timeframe);
      default: return buildSnapshot(spec, candles, candles.map(() => null), [], {}, null, null, "Not available");
    }
  });
}

function resolvePeriodsPerYear(timeframe: Timeframe, options: AnnualizationOptions): number {
  if (finite(options.periodsPerYear) && options.periodsPerYear! > 0) return options.periodsPerYear!;
  return timeframe === "1d" ? (options.market === "equity" ? 252 : 365) : 52;
}

export function backtest(candles: Candle[], snapshots: SignalSnapshot[], timeframe: Timeframe, costBps = 15, options: AnnualizationOptions = {}): BacktestSummary[] {
  const periodsPerYear = resolvePeriodsPerYear(timeframe, options);
  return snapshots.filter(s => s.role === "regime").map(s => {
    let equity = 1, peak = 1, maxDrawdown = 0, turnover = 0, exposureSum = 0, flips = 0;
    const returns: number[] = [], assetReturns: number[] = [];
    const stateCounts: Record<RegimeState, number> = { bull: 0, bear: 0, neutral: 0 };
    for (let i = 1; i < candles.length - 1; i++) {
      const current = s.states[i - 1];
      if (!current) continue;
      const exposure = current === "bull" ? 1 : current === "neutral" ? 0.5 : 0;
      const previous = i >= 2 && s.states[i - 2] ? (s.states[i - 2] === "bull" ? 1 : s.states[i - 2] === "neutral" ? 0.5 : 0) : 0;
      const change = Math.abs(exposure - previous); turnover += change; if (change > 0) flips++;
      const assetReturn = candles[i + 1].open / candles[i].open - 1;
      const strategyReturn = exposure * assetReturn - change * costBps / 10000;
      returns.push(strategyReturn); assetReturns.push(assetReturn); stateCounts[current]++; exposureSum += exposure; equity *= 1 + strategyReturn; peak = Math.max(peak, equity); maxDrawdown = Math.min(maxDrawdown, equity / peak - 1);
    }
    const years = returns.length / periodsPerYear, cagr = years > 0 && equity > 0 ? equity ** (1 / years) - 1 : 0;
    const mean = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const variance = returns.length > 1 ? returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1) : 0;
    const volatility = Math.sqrt(variance * periodsPerYear), downside = Math.sqrt(returns.filter(value => value < 0).reduce((sum, value) => sum + value ** 2, 0) / Math.max(1, returns.filter(value => value < 0).length)) * Math.sqrt(periodsPerYear);
    const positiveAsset = assetReturns.reduce((sum, value) => sum + Math.max(0, value), 0), negativeAsset = assetReturns.reduce((sum, value) => sum + Math.min(0, value), 0);
    const positiveStrategy = returns.reduce((sum, value, i) => assetReturns[i] > 0 ? sum + value : sum, 0), negativeStrategy = returns.reduce((sum, value, i) => assetReturns[i] < 0 ? sum + value : sum, 0);
    return { indicatorId: s.id, displayName: s.shortName, totalReturn: equity - 1, cagr, maxDrawdown, calmar: maxDrawdown < 0 ? cagr / Math.abs(maxDrawdown) : null, sharpe: volatility > 0 ? mean * periodsPerYear / volatility : null, sortino: downside > 0 ? mean * periodsPerYear / downside : null, volatility, exposure: returns.length ? exposureSum / returns.length : 0, turnover, flips, upsideCapture: positiveAsset ? positiveStrategy / positiveAsset : null, downsideCapture: negativeAsset ? negativeStrategy / negativeAsset : null, timeInState: { bull: stateCounts.bull / Math.max(1, returns.length), bear: stateCounts.bear / Math.max(1, returns.length), neutral: stateCounts.neutral / Math.max(1, returns.length) } };
  }).sort((a, b) => (b.calmar ?? -Infinity) - (a.calmar ?? -Infinity));
}

export function buyAndHold(candles: Candle[], timeframe: Timeframe, costBps = 15, options: AnnualizationOptions = {}) {
  if (candles.length < 2) return null;
  const periodsPerYear = resolvePeriodsPerYear(timeframe, options);
  const returns = candles.slice(1).map((candle, i) => candle.open / candles[i].open - 1);
  let equity = 1 - costBps / 10_000, peak = equity, maxDrawdown = 0;
  for (const value of returns) { equity *= 1 + value; peak = Math.max(peak, equity); maxDrawdown = Math.min(maxDrawdown, equity / peak - 1); }
  const years = returns.length / periodsPerYear, cagr = equity > 0 && years > 0 ? equity ** (1 / years) - 1 : 0;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.length > 1 ? returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1) : 0;
  const volatility = Math.sqrt(variance * periodsPerYear);
  return { totalReturn: equity - 1, cagr, maxDrawdown, calmar: maxDrawdown < 0 ? cagr / Math.abs(maxDrawdown) : null, sharpe: volatility > 0 ? mean * periodsPerYear / volatility : null, volatility };
}

export function familyAgreement(snapshots: SignalSnapshot[]): Record<RegimeState, number> {
  const families = ["smoothing/order", "ATR/trailing stop", "breakout", "momentum", "cloud/projected support"];
  const votes: RegimeState[] = families.map(family => {
    const members = snapshots.filter(s => s.role === "regime" && s.family === family && s.id !== "chandelier");
    if (!members.length) return "neutral";
    if (members.every(m => m.state === "bull")) return "bull";
    if (members.every(m => m.state === "bear")) return "bear";
    return "neutral";
  });
  return { bull: votes.filter(v => v === "bull").length, bear: votes.filter(v => v === "bear").length, neutral: votes.filter(v => v === "neutral").length };
}
