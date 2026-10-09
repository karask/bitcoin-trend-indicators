# Flip scorecard: cross-asset report (9 October 2026)

The research section of every lab now has a **flip scorecard**. It measures the buy and sell flips themselves, not long/cash returns. This report applies the same calculation to all 39 archived October 5 histories (20 crypto, 17 stocks, gold, silver). Each asset uses one venue, and the report covers both daily and weekly charts. Full tables are in [TABLES.md](TABLES.md); per-asset values are in `results.json`.

Regenerate with:

```
node --experimental-strip-types scripts/report-flip-scorecard.ts
```

## Definitions

These are implemented in `lib/flip-scorecard.ts`.

- **Flip:** a completed candle that enters the bullish (buy) or bearish (sell) state from any other state. Entering neutral is neither a buy nor a sell, and the first state after warmup is not counted.
- **Execution:** the next candle's open, matching the backtests. Only flips that execute inside the common research window count, so every model is scored on the same dates.
- **Right:**
  - A buy is right when price is higher N bars after execution.
  - A sell is right when price is lower N bars after execution.
  - Daily uses N = 10/30/90 bars; weekly uses N = 4/13/26 weeks. The tables use the middle horizon.
- **Quick reversal:** the state changes again within 10 days or 4 weeks.
- **Lag:**
  - For a buy, how far the execution price sits above the lowest low of the prior 60 days or 26 weeks.
  - For a sell, how far it sits below the highest high.
- **Completed regime:** from the flip's execution until the next state change's execution.
- **No costs:** medians are raw price changes.

## Findings

1. **Daily crypto sells are useful; daily stock sells are not.**
   - On daily crypto, sell flips are right 55–67% of the time. The median 30-day move after a sell is −5% to −7% for the SuperTrend family, KK Supertrend, Donchian and SMMA.
   - On daily stocks, almost every model's sells are right less than half the time, and price rises after the median sell. Stocks drift upward, so trend sells mostly cut exposure before recoveries.
2. **Buys are only slightly better than a coin toss on daily charts.** Buys are right 50–62% of the time, with a median gain of 1–4% after 30 bars.
   - Stocks: the EMA and SMMA ribbons are best (61–62% right, +3.4% to +3.9%).
   - Crypto: the best results are SuperTrend 10/3 (58%, +4.2%) and the 50/200 cross (+9.8%, with only 9 flips per asset).
3. **KK Supertrend is the steadiest signal but not the most accurate.**
   - Its five-close confirmation gives the fewest quick reversals: 3% across all daily assets, versus 11% for standard SuperTrend and 49–96% for MACD, Vortex, Heikin Ashi and Support Band.
   - Standard SuperTrend 10/3 is right more often: 59%/56% buys/sells across all assets, versus 56%/54%.
   - The confirmation removes whipsaws, but it also delays entry. Median buy lag is 34% above the recent low, versus 30% for SuperTrend.
4. **Every model enters late.**
   - Daily buys execute a median 22–50% above the prior 60-day low.
   - Sells execute 16–31% below the prior high.
   - This confirms the earlier finding: trend flips confirm moves rather than anticipate them.
5. **High-frequency models add noise without accuracy.** Heikin Ashi, Support Band, Vortex and Parabolic SAR flip 140–1,000 times per asset. They reverse within 10 days most of the time and are right no more often than the slower models.
6. **Weekly results are thin for crypto.** The shared research window starts after the longest weekly warmup, which leaves 2–10 flips per crypto asset. Weekly stock histories are long enough: there, the SMMA and KK EMA ribbons and Donchian 20/10 have the best buys, at 64–65% right after 13 weeks.

## Implications

- **Asset class:** treat sell flips as risk control for crypto. For stocks, consider ignoring daily sells or requiring weekly confirmation (proposal 6, weekly filter).
- **Combining signals:** KK Supertrend's low whipsaw and the ribbons' better buy accuracy suggest combining them (proposal 5, consensus signal). The scorecard is now the measure for judging such a combination.
- **Caveats:** these are in-sample, single-venue, descriptive medians across assets, not forecasts.
