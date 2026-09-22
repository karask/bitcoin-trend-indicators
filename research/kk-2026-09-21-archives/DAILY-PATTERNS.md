# Independent daily KK Supertrend parameter search

Weekly parameters and every production preset remain unchanged. This extends the September 21 archive analysis with a separate daily-only search. All inputs are the same archived, completed candles; no new API requests were made.

Integer ATR lengths tested: 5, 7, 10, 14, 15, 20, 21, 25, 30, 40, 50, 60, 75, 100, 150, 200. Integer multipliers: 1–10. Candidates need at least ATR length + 50 history bars. Ranking requires the screenshot's regime as well as the flip level. Pending bullish counters are treated as still bearish, not as an implemented confirmation rule.

The compact daily family independently tests ATR 10/15/20/30 and factors 2/3/4/5. It is not restricted to weekly assignments. The wider-grid winner is an exploratory single-level fit, not proof of the chart's formula. Selecting from 160 pairs can overfit; multiple historical reversal references are needed.

| Asset | Screenshot flip | Compact daily family: ATR/factor → flip (error) | Wider-grid closest: ATR/factor → flip (error) | Pending |
|---|---:|---|---|---|
| BTC | 76922.000 | 20/2 → 76938.618 (0.02%) | 20/2 → 76938.618 (0.02%) | — |
| ETH | 2275.900 | 30/4 → 2262.624 (-0.58%) | 60/4 → 2275.979 (0.00%) | — |
| SOL | 101.040 | 10/2 → 101.447 (0.40%) | 7/2 → 101.023 (-0.02%) | — |
| DOGE | 0.06573000 | 10/5 → 0.06714854 (2.16%) | 75/6 → 0.06574060 (0.02%) | — |
| LINK | 10.751 | 20/4 → 10.653 (-0.91%) | 150/4 → 10.718 (-0.30%) | — |
| XMR | 450.510 | 10/3 → 448.958 (-0.34%) | 10/3 → 448.958 (-0.34%) | — |
| SUI | 0.7885000 | No matching regime | 100/4 → 0.8989591 (14.01%) | 4/5 |
| JUP | 0.2351300 | 20/3 → 0.2368242 (0.72%) | 100/4 → 0.2351080 (-0.01%) | — |
| OP | 0.1042310 | No matching regime | 21/10 → 0.1252051 (20.12%) | 4/5 |
| BONK | 0.000003220000 | 10/3 → 0.000003267693 (1.48%) | 75/2 → 0.000003217966 (-0.06%) | 1/5 |
| ADA | 0.1666400 | 20/5 → 0.1668874 (0.15%) | 75/5 → 0.1666931 (0.03%) | — |
| ATOM | 1.456 | 30/3 → 1.455 (-0.06%) | 30/3 → 1.455 (-0.06%) | — |
| HYPE | 71.480 | 10/4 → 72.548 (1.49%) | 5/4 → 71.535 (0.08%) | — |
| DOT | 0.7976000 | 15/5 → 0.8228883 (3.17%) | 21/6 → 0.7977051 (0.01%) | — |
| BNB | 677.440 | 30/4 → 679.274 (0.27%) | 25/4 → 677.379 (-0.01%) | — |
| ZEC | 1206.850 | 20/3 → 1199.238 (-0.63%) | 21/3 → 1205.372 (-0.12%) | — |
| TSLA | 290.350 | 30/4 → 315.054 (8.51%) | 150/4 → 311.501 (7.28%) | — |
| GOOGL | 370.440 | 15/5 → 370.959 (0.14%) | 14/5 → 370.400 (-0.01%) | — |
| NVDA | 225.580 | 30/2 → 225.075 (-0.22%) | 30/2 → 225.075 (-0.22%) | 1/5 |
| SPCX | 115.880 | 15/4 → 123.911 (6.93%) | 5/5 → 119.372 (3.01%) | — |
| MU | 987.920 | 20/3 → 1038.081 (5.08%) | 100/5 → 1030.272 (4.29%) | 2/5 |
| SNDK | 1205.800 | 30/4 → 1205.553 (-0.02%) | 30/4 → 1205.553 (-0.02%) | — |
| BMNR | 21.510 | 10/3 → 21.656 (0.68%) | 100/2 → 21.425 (-0.40%) | — |
| GOLD | 4316.700 | 15/4 → 4294.496 (-0.51%) | 200/4 → 4307.109 (-0.22%) | — |
| SILVER | 71.286 | 30/3 → 69.268 (-2.83%) | 75/5 → 71.156 (-0.18%) | — |

## Daily-only interpretation

BTC 15/2 remains a reasonable candidate (76,868.64 versus 76,922, -0.07%); 20/2 is numerically closer but that small difference does not identify the original settings. SOL 10/2 and XMR 10/3 already fit within 0.5%. In the compact daily family, multiplier 4 fits ETH/LINK/BNB/SNDK/Gold within 1%; multiplier 5 fits ADA/GOOGL within 0.2%; multiplier 3 fits JUP/ATOM/ZEC/BMNR within 1%. These are descriptive candidate groups, not established rules.

DOGE, DOT, HYPE and Silver get much closer outside the compact family, but those individual winners need independent references before adopting their more scattered settings. SUI, OP, TSLA, SPCX and MU still have over 3% error even at the best tested same-regime pair. Pending confirmation labels additionally prevent treating BONK/NVDA's numeric matches as full behavioral matches. No daily preset is installed by this exploratory report.

## Limitations

These values use the screenshot venue (or documented proxy), not necessarily the app's default exchange. Futures rolls, short stock history, sparse JUP bars and limited Kraken history still apply; see REPORT.md. One numeric target does not identify both ATR length and factor uniquely. The confirmation counters cannot be reproduced merely by choosing parameters. No market-cap classifications can be inferred from this selected sample or from unit prices.
