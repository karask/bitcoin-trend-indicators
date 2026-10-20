# Daily KK Supertrend: 19 October 2026 chart batch

**Archive:** `TradingView-MoneyLine-39-daily-charts-6-months-2026-10-19`, 39 daily charts with six months of history, captured 18:50–18:56 UTC during the U.S. session.

**Comparison candles:** the last ones completed before capture, which is 18 October for crypto and the 16 October session for stocks and futures. The tails were fetched into this folder from the October 16 fixtures.

**Status:** points 1 and 2 applied on 20 October; see "Applied" at the end.

## What changed since 16 October

- **Three daily flips:**
  - **ZEC and QNT** completed their pending reversals and are now bearish (flip date 17 October). ZEC's trail is 1592.95, QNT's 262.39.
  - **SUI** flipped bearish (flip date 19 October) with a trail of 1.3935.
- **New pending counters:** DOGE Bearish 3/5, LINK 4/5, AVAX 3/5, INTC 4/5, AMD 2/5 and META 2/5.
- **Levels:** XMR's bull trail rose 455.70 → 471.47. Every other non-flipping level is unchanged.

## The held trail is confirmed

The 16 October mechanism (applied in `5f4a225`) was scored on today's charts.

- **Pending counts:** five of the six pending charts match exactly:

  | Chart | App count, completed closes | Chart count |
  |---|---:|---|
  | DOGE | 2 | 3/5 |
  | AVAX | 2 | 3/5 |
  | INTC | 3 | 4/5 |
  | AMD | 1 | 2/5 |
  | META | 1 | 2/5 |

  Each chart count is the app's count plus the forming candle.
- **The sixth, LINK, is wrong in the app right now.**
  - The app's LINK trail (100/4.5) is 0.26% above the chart's. On 15 October LINK closed between the two levels: the chart reset its count, but the app kept counting.
  - The app confirmed a bearish flip on 18 October, while the chart is still bullish at 4/5.
- **Flip timing:** exact for ZEC, QNT and SUI. The app confirms each flip on the fifth close, one day before the chart's printed date, consistent with the next-bar labelling.
- **Today, within 1%:** 26 of 39 charts on the current presets, the same as on 16 October.

## Where the new trail starts after a flip

This is the first daily evidence of where the opposite trail begins.

- **QNT matches the standard opposite band.** The 21/2.5 preset is −3.14% after the flip, but 27/3 fits all six charts within 0.57%. That includes the 16 October 5/5 count, the flip date and the new bear trail; 28/3.1 is within 0.08%. The fit holds on Binance QNTUSDT too.
- **The weekly flips also match it.** The three new weekly flips (ZEC, VVV, INTC) are reproduced by the standard opposite band; see the weekly report.
- **ZEC and SUI do not match.**
  - ZEC's 40/4 reproduces everything up to the flip exactly: −0.004% on five charts, both pending counts and the flip date. The new bear trail is −5.02% from the chart's.
  - SUI's new bear trail is −19.4% from the chart's.
  - No setting fits either on the standard band: ZEC is at best −2.16% and SUI −15%.
- **Ruled out for ZEC and SUI:**
  - four other starting rules: the band at the flip, the band or ratchet at the start of the pending run, and the extreme band during it;
  - three other feeds: Coinbase and Kraken for ZEC, Binance and Kraken for SUI.

  On the ZEC chart, the trail jumps to 1592.95 at the flip and stays flat for two days. The ZEC and SUI chart levels are above anything the bull-side settings can produce. The rule that sets them is unknown.

## Six-batch fit (3, 5, 9, 12, 16 and 19 October)

- **Grids:**
  - a 16 × 13 grid of ATR length 5–200 and multiplier 1.5–8 in steps of 0.5;
  - a finer 43 × 76 grid with multiplier steps of 0.1, for confirmation.
- **Current presets that fit all six charts within 1%:** 25 of 39.
  - Last time's fits that drop out: LINK (wrong state), QNT, SUI and ZEC (new trail after their flips).
  - Silver is just outside, at 1.12%.
- **Fits on the coarse grid that also match the pending counts and flip date:** LINK 60/4.5, QNT 27/3 and silver 120/5.5.
- **JUP and MRVL** each fit only one fine-grid setting (26/3 and 8/5.6), with the wrong flip date. These are not robust and are not proposed.
- **The tier rule** stays a fallback: it is worse than the current preset for ZEC and SUI and gets their state wrong.

## Per-asset detail

| Asset | Current | Max error, current | Mismatched | Proposed | Max error | Note |
|---|---|---:|---|---|---:|---|
| BTC | 15/2 | 0.94% | flip date | 15/2 | 0.94% |  |
| ETH | 15/4 | 1.00% | flip date | 15/4 | 1.00% |  |
| SOL | 15/4 | 0.68% | flip date | 15/4 | 0.68% |  |
| DOGE | 15/4 | 0.03% | — | 15/4 | 0.03% |  |
| LINK | 100/4.5 | wrong state | count, flip date | **60/4.5** | 0.31% | Fits the 4/5 pending count; the current preset has already flipped bearish. |
| XMR | 30/4 | 0.79% | — | 30/4 | 0.79% |  |
| SUI | 10/2 | 19.40% | count | 10/2 (unresolved) | 19.40% | Flip date exact; new bear trail −19.4%. The tier (15/2.5) gets the state wrong. |
| JUP | 15/2.5 | 2.52% | count, flip date | 15/2.5 (tier) | 2.52% | Only 26/3 fits (0.98%), with the wrong flip date. |
| OP | 50/3.5 | 0.35% | — | 50/3.5 | 0.35% |  |
| BONK | 15/2.5 | wrong state | count, flip date | 15/2.5 (tier) | wrong state |  |
| ADA | 15/3.5 | 7.21% | — | 15/3.5 (tier) | 7.21% |  |
| ATOM | 5/3.5 | 0.78% | — | 5/3.5 | 0.78% |  |
| HYPE | 15/4 | 0.33% | flip date | 15/4 | 0.33% |  |
| DOT | 50/4.5 | 0.04% | — | 50/4.5 | 0.04% |  |
| BNB | 100/4 | 0.52% | — | 100/4 | 0.52% |  |
| ZEC | 40/4 | 5.02% | — | 40/4 (unresolved) | 5.02% | Exact up to the flip, including both counts and the flip date; new bear trail −5.02%. The tier (15/4) gets the state wrong. |
| AVAX | 100/3 | 0.46% | flip date | 100/3 | 0.46% |  |
| RAY | 15/2.5 | 4.69% | count | 15/2.5 (tier) | 4.69% |  |
| VVV | 20/3.5 | 0.86% | — | 20/3.5 | 0.86% |  |
| QNT | 21/2.5 | 3.14% | — | **27/3** | 0.57% | Reproduces the 16 October 5/5 count, the 17 October flip date and the new bear trail. |
| TSLA | 100/4.5 | wrong state | count, flip date | 100/4.5 (unresolved) | wrong state |  |
| GOOGL | 15/5 | 0.14% | flip date | 15/5 | 0.14% |  |
| NVDA | 50/5 | 0.85% | count, flip date | 50/5 | 0.85% |  |
| SPCX | 15/4 | wrong state | count, flip date | 15/4 (unresolved) | wrong state |  |
| MU | 100/5 | 0.02% | — | 100/5 | 0.02% |  |
| SNDK | 100/5.5 | 0.39% | flip date | 100/5.5 | 0.39% |  |
| BMNR | 15/4 | 0.61% | flip date | 15/4 | 0.61% |  |
| MSTR | 10/4.5 | 0.57% | — | 10/4.5 | 0.57% |  |
| CRCL | 10/6 | 0.70% | — | 10/6 | 0.70% |  |
| INTC | 15/4 | 0.03% | flip date | 15/4 | 0.03% |  |
| MRVL | 30/4 | 6.05% | flip date | 30/4 (unresolved) | 6.05% | Only 8/5.6 fits (0.89%), with the wrong flip date. |
| AMD | 20/4 | 0.70% | flip date | 20/4 | 0.70% |  |
| AMZN | 50/6 | 0.86% | — | 50/6 | 0.86% |  |
| META | 30/2 | 0.05% | flip date | 30/2 | 0.05% |  |
| BOT | 10/3 | wrong state | flip date | 10/3 (unresolved) | wrong state |  |
| STRC | 20/4 | 0.57% | — | 20/4 | 0.57% |  |
| PLTR | 30/4 | 5.51% | — | 30/4 (unresolved) | 5.51% |  |
| Gold | 40/4.5 | 0.49% | — | 40/4.5 | 0.49% |  |
| Silver | 100/5 | 1.12% | — | **120/5.5** | 0.83% | All five charts within 1%. |

- **Max error:** the worst of the six October charts.
- **Mismatched:** the current preset misses a printed pending count or the chart's flip date (0–3 days, under next-bar labelling).

## Proposal

1. **Refit three presets:** LINK 100/4.5 → 60/4.5, QNT 21/2.5 → 27/3, silver 100/5 → 120/5.5.
   - This takes the current presets that fit all six charts from 25 to 28 of 39.
   - It fixes LINK's wrong bearish state in the app today.
   - Today's charts within 1% rise from 26 to 29, and the pending counts match 6 of 6.
2. **Keep ZEC 40/4 and SUI 10/2, flagged unresolved instead of moving them to the tier.** The tier gets their state wrong.
   - This needs a small change: the evidence status should allow "unresolved" for a coin whose kept preset beats the tier.
   - Their app trails sit below the chart's (ZEC −5%, SUI −19%), so the app may flip them back bullish earlier than the chart.
3. **No mechanism change.** The held trail is confirmed. The rule for where ZEC's and SUI's new trails start stays open; the next flips will test it.

## Evidence

- `observations.json`: chart readings, pending counters and SHA-256 for each image.
- `*-{venue}.json`: completed candles through 18 October (crypto) and 16 October (stocks and futures).

## Applied (20 October 2026)

At Kostas's request, points 1 and 2 were applied.

- **Presets in `lib/regimes.ts`:** LINK 100/4.5 → 60/4.5, QNT 21/2.5 → 27/3, silver 100/5 → 120/5.5.
- **ZEC 40/4 and SUI 10/2 kept, flagged unresolved.** The evidence status now marks crypto as "tier" only when it actually uses the tier.
- **Status across the six October batches:**
  - 28 October fits;
  - crypto tier: JUP, BONK, ADA, RAY;
  - unresolved: ZEC, SUI, TSLA, SPCX, MRVL, PLTR, BOT.
- **Calibration notebook, labels and warnings** use this review: `lib/kk-october19-evidence.ts`, generated by `scripts/apply-kk-october19-evidence.ts`.
- **Tests:** `tests/kk-october19.test.ts` replays every check. It also covers the six pending counters, the three flip dates, LINK's earlier wrong state and QNT's new bear trail. The October 16 evidence now replays with the presets of that review.
