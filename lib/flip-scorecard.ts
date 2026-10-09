import type { Candle, RegimeState, SignalSnapshot, Timeframe } from "./regimes.ts";

export type FlipDirection = "bull" | "bear";

/** Horizons, whipsaw window and lag lookback are in bars of the selected timeframe. */
export const FLIP_SCORECARD_SETTINGS = {
  "1d": { horizons: [10, 30, 90], whipsawBars: 10, lagLookback: 60 },
  "1w": { horizons: [4, 13, 26], whipsawBars: 4, lagLookback: 26 },
} as const satisfies Record<Timeframe, { horizons: readonly number[]; whipsawBars: number; lagLookback: number }>;

export interface FlipHorizon { bars: number; scored: number; hitRate: number | null; medianReturn: number | null }

export interface FlipDirectionStats {
  direction: FlipDirection;
  flips: number;
  /** Price move after the execution open; a sell is correct when price falls. */
  horizons: FlipHorizon[];
  /** Share of flips whose state changed again within `whipsawBars`. */
  whipsawRate: number | null;
  /** Buy: execution open above the prior lookback low. Sell: execution open below the prior lookback high. */
  medianLagPct: number | null;
  medianLagBars: number | null;
  /** Completed regimes: entry at the flip's execution open, exit at the next change's execution open. */
  completed: number;
  winRate: number | null;
  medianRegimeReturn: number | null;
}

export interface FlipScorecard {
  indicatorId: string;
  displayName: string;
  bull: FlipDirectionStats;
  bear: FlipDirectionStats;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const share = (hits: number, total: number) => total ? hits / total : null;

/**
 * Scores entries into a bullish or bearish state. A flip is confirmed by candle i's
 * close and executes at candle i + 1's open, matching the backtests. Only flips that
 * execute at or after `startIndex` count, so every model shares the research window.
 */
export function flipScorecard(candles: Candle[], signal: Pick<SignalSnapshot, "id" | "shortName" | "states">, timeframe: Timeframe, startIndex = 1): FlipScorecard {
  const settings = FLIP_SCORECARD_SETTINGS[timeframe];
  const states = signal.states;
  const score = (direction: FlipDirection): FlipDirectionStats => {
    const forward = settings.horizons.map(() => [] as number[]);
    const lagPct: number[] = [], lagBars: number[] = [], regimes: number[] = [];
    let flips = 0, whipsawScored = 0, whipsaws = 0;
    for (let i = Math.max(1, startIndex - 1); i + 1 < candles.length; i++) {
      const previous = states[i - 1], current: RegimeState | null = states[i];
      if (current !== direction || previous == null || previous === current) continue;
      flips++;
      const entry = candles[i + 1].open;
      settings.horizons.forEach((bars, k) => { if (i + 1 + bars < candles.length) forward[k].push(candles[i + 1 + bars].open / entry - 1); });
      if (i + settings.whipsawBars < candles.length) {
        whipsawScored++;
        if (states.slice(i + 1, i + 1 + settings.whipsawBars).some(state => state !== direction)) whipsaws++;
      }
      const window = candles.slice(Math.max(0, i - settings.lagLookback + 1), i + 1);
      let extreme = 0;
      window.forEach((candle, k) => { if (direction === "bull" ? candle.low < window[extreme].low : candle.high > window[extreme].high) extreme = k; });
      lagPct.push(direction === "bull" ? entry / window[extreme].low - 1 : 1 - entry / window[extreme].high);
      lagBars.push(window.length - 1 - extreme);
      const exit = states.findIndex((state, j) => j > i && state !== direction);
      if (exit > 0 && exit + 1 < candles.length) regimes.push(candles[exit + 1].open / entry - 1);
    }
    const correct = (value: number) => direction === "bull" ? value > 0 : value < 0;
    return {
      direction, flips,
      horizons: settings.horizons.map((bars, k) => ({ bars, scored: forward[k].length, hitRate: share(forward[k].filter(correct).length, forward[k].length), medianReturn: median(forward[k]) })),
      whipsawRate: share(whipsaws, whipsawScored),
      medianLagPct: median(lagPct), medianLagBars: median(lagBars),
      completed: regimes.length, winRate: share(regimes.filter(correct).length, regimes.length), medianRegimeReturn: median(regimes),
    };
  };
  return { indicatorId: signal.id, displayName: signal.shortName, bull: score("bull"), bear: score("bear") };
}

/** Mean of buy and sell hit rates at the middle horizon; null when either side is unscored. */
export function scorecardRank(card: FlipScorecard): number | null {
  const middle = card.bull.horizons.length >> 1;
  const buy = card.bull.horizons[middle]?.hitRate, sell = card.bear.horizons[middle]?.hitRate;
  return buy == null || sell == null ? null : (buy + sell) / 2;
}
