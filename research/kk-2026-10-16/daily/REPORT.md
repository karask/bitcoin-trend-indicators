# Daily KK Supertrend: 16 October 2026 chart batch

**Archive:** `TradingView-MoneyLine-39-daily-charts-6-months-2026-10-16`, 39 daily charts with six months of history, captured 14:25–14:34 UTC during the U.S. session.

**Comparison candles:** the last ones completed before capture, which is 15 October for crypto and the 15 October session for stocks and futures. Today's candles were still forming and are ignored. The tails were fetched into this folder from the October 12 fixtures.

**Status:** option 1 applied on 16 October; see "Applied" at the end.

## What changed since Monday (12 October)

- **Levels:** 37 of 39 Next Flip levels are unchanged. STRC rose 96.16 → 97.43, and silver fell 71.285 → 68.780.
- **Pending counters:** ZEC Bearish 5/5, QNT Bearish 5/5, INTC Bearish 3/5. All three charts are still bullish.
- **Flips:** none. Every printed last-flip date is unchanged.

## The chart holds its trail while a flip is pending

This batch shows the confirmation mechanism directly:

- **The level does not move during a pending reversal.** ZEC has shown 1251.54 on every chart since 3 October:
  - 9 Oct: Bearish 2/5;
  - 12 Oct: cleared;
  - 16 Oct: Bearish 5/5.

  QNT (227.68), INTC (99.80), SUI (1.0447) and LINK (12.435) have also held one level since 3–5 October while price crossed it.
- **Counting happens against that held level.** The counter tracks consecutive closes beyond the held level and resets when a close returns. Each chart count equals the completed closes beyond the printed level, plus the forming candle:

  | Chart | Completed closes below the level | Chart count |
  |---|---|---|
  | ZEC | 12–15 Oct (four) | 5/5 |
  | QNT | 12–15 Oct (four) | 5/5 |
  | INTC | 14–15 Oct (two) | 3/5 |

- **The app works differently.** At the first close beyond the trail, the app's raw Supertrend switches to the opposite band. It then counts confirmations against that band and reports it as the level. That produces this batch's large misses:
  - **BTC:** 5.89%. BTC closed at 81,574 on 14 October, just under the app's trail of 81,620. The app went pending and began showing the upper band. The chart's trail is 80,859, so it never went pending.
  - **The same artifact:** LINK 20.1%, SUI 11.7%, QNT 18.6% and INTC 17.0%.

### Held-trail variant, tested once

**The rule:** the trail never moves against the trend. A reversal needs five consecutive completed closes beyond the held trail; a failed close resets the count. On a confirmed flip, the new trail is the standard opposite band.

A wider held/frozen-trail search ran on 9 October (24 variants, 22 → 25–27 consistent assets of 39). This test is narrower: one rule, tested because this batch's pending counters show the mechanism directly.

| Five October batches (3/5/9/12/16) | App mechanism | Held trail |
|---|---:|---:|
| Current presets, today within 1% | 21 / 39 | **26 / 39** |
| Current presets, all five within 1% | 21 / 39 | **24 / 39** |
| Some setting fits all five within 1% | 24 / 39 | **29 / 39** |
| …and also matches the flip date (0–3 days) and the pending count | 17 (date only) | **21** |
| Current presets, flip date within 0–3 days | **21** | 18 |

**Gains under the held trail:**

- **Current presets fit again:** BTC, LINK, SUI, QNT and INTC.
- **New fits:**
  - **ZEC at 40/4** reproduces everything printed: −0.004% on all five charts, the 9 October count (1 completed close + forming = 2/5), the 16 October count (4 + forming = 5/5), and the flip date (26 August).
  - VVV 20/3.5 and NVDA 50/5.
- **Pending counts match:** QNT (4) and INTC (2).

**Losses under the held trail:**

- **TSLA:** no setting fits; the state is wrong. On the app mechanism its fit is level-only, with the flip date 20 days off.
- **Gold:** 15/5 gets the 5 October state wrong. 40/4.5 fits at 0.49%, including the flip date.
- **Flip dates move away from the chart** for HYPE, AMD, ETH, SNDK and MRVL. They move closer for ADA, CRCL and silver.

The held trail is clearly better supported, but it is not the whole mechanism. The flip-date losses show the rule for starting and confirming a reversal still differs in some cases.

## Market-cap tier rule

Scored per asset across all five batches at ATR 15, the tier rule (BTC 2, ≥$12B 4, $8–12B 3.5, <$8B 2.5) fits:

- 5 of 20 coins on the app mechanism;
- 6 of 20 on the held trail.

The coins that fit are BTC (held only), ETH, SOL, DOGE, HYPE and AVAX. DOT fits at ATR 15, but at 3.5 rather than its tier's 2.5. The tier remains a fallback, not a rule.

## Per-asset detail

- **Current:** the applied 12 October preset.
- **Max error:** the worst of the five October charts, within 1% counting as a fit.
- **Proposed (held):** keeps the current preset where it fits all five. Otherwise it uses the fitting setting that matches the flip date and pending count, then ATR 15, then the lowest error. Crypto without a fit falls back to the tier; others stay unresolved.

| Asset | Current | Today, app | Max error, app | Max error, held | Proposed (held) | Max error | Flip date |
|---|---|---:|---:|---:|---|---:|---|
| BTC | 15/2 | 5.89% | 5.89% | 0.94% | 15/2 | 0.94% | −30 d |
| ETH | 15/4 | 0.50% | 1.00% | 1.00% | 15/4 | 1.00% | −11 d |
| SOL | 15/4 | 0.68% | 0.68% | 0.68% | 15/4 | 0.68% | −2 d |
| DOGE | 15/4 | 0.03% | 0.03% | 0.03% | 15/4 | 0.03% | yes |
| LINK | 100/4.5 | 20.10% | 20.10% | 0.26% | 100/4.5 | 0.26% | −3 d |
| XMR | 30/4 | 0.79% | 0.79% | 0.79% | 30/4 | 0.79% | yes |
| SUI | 10/2 | 11.67% | 11.67% | 0.82% | 10/2 | 0.82% | yes |
| JUP | 15/2.5 | 2.52% | 2.52% | 2.52% | 15/2.5 (tier) | 2.52% | −51 d |
| OP | 50/3.5 | 0.35% | 0.35% | 0.35% | 50/3.5 | 0.35% | yes |
| BONK | 15/2.5 | 50.04% | 50.04% | 36.28% | 15/2.5 (tier) | 36.28% | yes |
| ADA | 15/3.5 | 7.21% | 7.21% | 7.21% | 15/3.5 (tier) | 7.21% | yes |
| ATOM | 5/3.5 | 0.78% | 0.78% | 0.78% | 5/3.5 | 0.78% | yes |
| HYPE | 15/4 | 0.33% | 0.33% | 0.33% | 15/4 | 0.33% | +157 d |
| DOT | 50/4.5 | 0.04% | 0.04% | 0.04% | 50/4.5 | 0.04% | yes |
| BNB | 100/4 | 0.52% | 0.52% | 0.52% | 100/4 | 0.52% | yes |
| ZEC | 15/4 | 11.63% | 11.63% | 11.63% | **40/4** | 0.00% | yes |
| AVAX | 100/3 | 0.45% | 0.45% | 0.45% | 100/3 | 0.45% | −12 d |
| RAY | 15/2.5 | 30.86% | 30.86% | 4.69% | 15/2.5 (tier) | 4.69% | yes |
| VVV | 15/2.5 | wrong state | wrong state | 9.49% | **20/3.5** | 0.86% | yes |
| QNT | 21/2.5 | 18.58% | 18.58% | 0.31% | 21/2.5 | 0.31% | +17 d |
| TSLA | 100/4.5 | 0.10% | 0.56% | wrong state | 100/4.5 (unresolved) | wrong state | +42 d |
| GOOGL | 15/5 | 0.14% | 0.14% | 0.14% | 15/5 | 0.14% | −18 d |
| NVDA | 30/2 | 8.55% | wrong state | wrong state | **50/5** | 0.85% | −1 d |
| SPCX | 15/4 | 5.58% | 9.59% | wrong state | 15/4 (unresolved) | wrong state | −27 d |
| MU | 100/5 | 0.02% | 0.02% | 0.02% | 100/5 | 0.02% | yes |
| SNDK | 100/5.5 | 0.39% | 0.39% | 0.39% | 100/5.5 | 0.39% | −22 d |
| BMNR | 15/4 | 0.61% | 0.61% | 0.61% | 15/4 | 0.61% | +16 d |
| MSTR | 10/4.5 | 0.57% | 0.57% | 0.57% | 10/4.5 | 0.57% | yes |
| CRCL | 10/6 | 0.70% | 0.70% | 0.70% | 10/6 | 0.70% | yes |
| INTC | 15/4 | 17.03% | 17.03% | 0.03% | 15/4 | 0.03% | −1 d |
| MRVL | 30/4 | 6.05% | 6.05% | 6.05% | 30/4 (unresolved) | 6.05% | −30 d |
| AMD | 20/4 | 0.64% | 0.70% | 0.70% | 20/4 | 0.70% | +163 d |
| AMZN | 50/6 | 0.86% | 0.86% | 0.86% | 50/6 | 0.86% | yes |
| META | 30/2 | 0.05% | 0.05% | 0.05% | 30/2 | 0.05% | +45 d |
| BOT | 10/3 | 60.41% | wrong state | wrong state | 10/3 (unresolved) | wrong state | — |
| STRC | 30/4 | 1.44% | 1.44% | 1.44% | **20/4** | 0.57% | yes |
| PLTR | 30/4 | 2.53% | 5.51% | 5.51% | 30/4 (unresolved) | 5.51% | yes |
| Gold | 15/5 | 0.79% | 0.79% | wrong state | **40/4.5** | 0.49% | yes |
| Silver | 100/5 | 1.12% | 1.12% | 1.12% | 100/5 (unresolved) | 1.12% | yes |

The **Flip date** column compares the model's last flip with the chart's Last Flip Date, under the next-bar labelling also seen on the weekly charts. "yes" means 0–3 days; otherwise the gap is in days.

## Options

1. **Adopt the held-trail confirmation and the five-batch presets.** Change the daily KK confirmation as described above. Change ZEC to 40/4, VVV to 20/3.5, NVDA to 50/5, STRC to 20/4 and gold to 40/4.5. Keep every other preset. TSLA becomes unresolved.
2. **Keep the app mechanism and refit presets only.** BTC 50/2.5, LINK 60/4.5 and STRC 20/4 would fit all five charts. SUI, QNT, INTC and silver drop out, and the BTC, LINK, SUI, QNT and INTC errors would keep recurring whenever price nears the trail.
3. **No change.** Collect another batch first, ideally one where ZEC or QNT completes its flip; that would show how the new trail starts.

## Evidence

- `observations.json`: chart readings, pending counters and SHA-256 for each image.
- `*-{venue}.json`: completed candles through 15 October, extended from the October 12 fixtures. Each records its provenance and a raw-response hash.
- `held-trail-variant.ts`: the single held-trail rule tested here.

## Applied (16 October 2026)

At Kostas's choice (option 1):

- **Held-trail confirmation** is the production daily KK mechanism (`heldTrailKkSupertrend` in `lib/regimes.ts`).
  - The trail never moves against the confirmed regime while a reversal is pending.
  - Five consecutive completed closes beyond the held trail confirm a flip, and a failed close resets the count.
  - On a flip, the new trail starts at the standard opposite band.
  - Open candles are ignored.
  - The earlier mechanism stays available only for replaying archived reviews: `kkSupertrendRawTrailConfirmation`.
- **Presets changed:** ZEC 15/4 → 40/4, VVV 15/2.5 → 20/3.5, NVDA 30/2 → 50/5, STRC 30/4 → 20/4, gold 15/5 → 40/4.5. All other presets are unchanged.
- **Status across the five October batches:**
  - 29 October fits;
  - crypto tier: JUP, BONK, ADA, RAY;
  - unresolved: TSLA, SPCX, MRVL, PLTR, BOT, silver.
- **Calibration notebook, labels and warnings** use this review: `lib/kk-october16-evidence.ts`, generated by `scripts/apply-kk-october16-evidence.ts`.
- **Tests:**
  - `tests/kk-october16.test.ts` replays every check, including the ZEC, QNT and INTC pending counts.
  - `tests/kk-confirmation.test.ts` covers the held trail.
  - Earlier reviews replay with the mechanism and presets recorded at the time.
