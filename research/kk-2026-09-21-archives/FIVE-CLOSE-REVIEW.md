# Daily KK Supertrend: five consecutive confirmations

Both bullish and bearish reversals require five consecutive completed daily confirmations. A failed confirmation resets the count. The implemented rule counts consecutive underlying Supertrend regimes, with closes strictly on the appropriate side of the continuously calculated ATR trail. The official regime holds through counts 1–4 and changes on the fifth close; execution is at the next session open. A new live/incomplete candle is excluded. Stock/futures weekends and holidays do not add sessions. The initial ATR warmup seed is retained.

ATR lengths and multipliers remain as approved, and weekly uses its existing single-close calculation. The continuously calculated trail leaves current numerical levels unchanged. This is an explicit implementation choice; the user's five-close rule alone does not identify the private chart's band/reset formula. Old daily evidence and searches remain reproducible via the research-only legacy option.

The 23 previously fitted assets still match the screenshot's official regime on the archived completed candles. SUI/OP remain unresolved at their retained 10/3; no new preset is installed from an incomplete match. The five visible screenshot counters are not reproduced by the current presets/cutoff. Some images include the open September 21 candle; our crypto fixtures end September 20 and stocks/futures end September 18. This could explain a one-count difference but is not proof that the underlying rules match.

| Asset | Preset | Image flip | Calculated | Image state/count | Official state/count | Historical flips: single → five |
|---|---|---:|---:|---|---|---|
| BTC | 15/2 | 76922 | 76868.644 | bull | bull / 0 | 203 → 183 |
| ETH | 15/4 | 2275.9 | 2230.3536 | bull | bull / 0 | 43 → 43 |
| SOL | 15/2 | 101.04 | 101.93436 | bull | bull / 0 | 77 → 71 |
| DOGE | 15/5 | 0.06573 | 0.069966405 | bull | bull / 0 | 21 → 21 |
| LINK | 15/4 | 10.751 | 10.458645 | bull | bull / 0 | 43 → 41 |
| XMR | 15/3 | 450.51 | 456.01139 | bull | bull / 0 | 11 → 11 |
| SUI | 10/3 | 0.7885 | 0.68795507 | bear / 4 | bull / 0 | 27 → 25 |
| JUP | 15/3 | 0.23513 | 0.2329095 | bull | bull / 0 | 29 → 25 |
| OP | 10/3 | 0.104231 | 0.09686671 | bear / 4 | bull / 0 | 21 → 17 |
| BONK | 15/3 | 0.00000322 | 0.0000032920878 | bear / 1 | bear / 0 | 22 → 22 |
| ADA | 15/5 | 0.16664 | 0.16123774 | bull | bull / 0 | 19 → 19 |
| ATOM | 15/5 | 1.4559 | 1.4373027 | bull | bull / 0 | 11 → 11 |
| HYPE | 15/4 | 71.48 | 73.215264 | bull | bull / 0 | 3 → 3 |
| DOT | 15/5 | 0.7976 | 0.8228883 | bull | bull / 0 | 19 → 17 |
| BNB | 15/4 | 677.44 | 672.33544 | bull | bull / 0 | 13 → 13 |
| ZEC | 15/3 | 1206.85 | 1162.9975 | bull | bull / 0 | 49 → 47 |
| TSLA | 30/4 | 290.35 | 315.0538 | bull | bull / 0 | 67 → 67 |
| GOOGL | 15/3 | 370.44 | 354.71733 | bear | bear / 0 | 88 → 82 |
| NVDA | 30/2 | 225.58 | 225.07503 | bear / 1 | bear / 0 | 174 → 128 |
| SPCX | 15/4 | 115.88 | 123.91106 | bull | bull / 0 | 1 → 1 |
| MU | 15/3 | 987.92 | 1043.1345 | bear / 2 | bear / 0 | 102 → 98 |
| SNDK | 30/4 | 1205.8 | 1205.5527 | bull | bull / 0 | 7 → 7 |
| BMNR | 15/3 | 21.51 | 21.912309 | bull | bull / 0 | 9 → 9 |
| GOLD | 15/4 | 4316.7 | 4294.4963 | bull | bull / 0 | 35 → 33 |
| SILVER | 15/3 | 71.286 | 68.828822 | bear | bear / 0 | 88 → 74 |

Small-family candidates, including their pending counts, are recorded in five-close-review.json. Do not interpret a matching level as proof of a matching confirmation history. Revalidation needs historical reversal sequences or the original settings/formula.
