# Retired research models

These models were removed from the active registry and dashboard on 2026-08-26 to reduce overlapping long-horizon signals and keep the primary research view focused. The decision reflects product scope, not a claim that the methods are invalid.

The last commit containing all three active implementations is `094383f` (`feat: implement Super Guppy R1.2 and indicator guidance`). Use that snapshot if they are restored in a future advanced research section or separate page.

## Donchian Close 55/20

- Previous ID: `donchian_55_20`
- Role/family: regime / breakout
- Timeframes: daily and weekly
- Rule: enter bullish after a close strictly above the prior 55-bar high; exit bearish after a close strictly below the prior 20-bar low; retain the existing state between channels.
- Removal rationale: overlapped with the retained Donchian 20/10 model and added a second, slower breakout row to the primary comparison.

## 12-Month Absolute Momentum

- Previous ID: `absolute_momentum`
- Role/family: regime / momentum
- Timeframes: daily and weekly
- Rule: bullish when the close is at or above the close 365 daily bars or 52 weekly bars earlier; bearish below it.
- Removal rationale: added limited incremental information beside the existing long-horizon smoothing and trend models.

## Faber 10-month rule

- Previous location: standalone Published Baseline card, outside the indicator registry.
- Timeframe: monthly state derived from daily candles.
- Rule: invested after a completed month closes at or above the arithmetic average of the last 10 completed monthly closes; cash below it, effective the following month.
- Removal rationale: duplicated the broad purpose of the long moving-average filters and was not represented in the daily/weekly backtest table.

If restored, keep these models separate from the core view, label them as research baselines, and add historical state/backtest coverage appropriate to their original cadence.
