# Crypto Regime Lab

A transparent, installable BTC, ETH, SOL, DOGE, LINK, XMR, and SUI regime-indicator research platform, with an isolated stock-research page for TSLA, GOOGL, NVDA, SPCX, MU, and SNDK. It compares fixed, documented trend models without claiming to reproduce private MoneyLine or Larsson Line formulas and without producing orders or allocation recommendations.

Hosted access uses passwordless email authentication. A visitor enters an email address and a single-use six-digit code; the first successful verification creates the account and later verifications sign it in. Both research labs and all market-data APIs require the resulting secure 30-day session. There are no passwords, social identities, or marketing emails.

## What is implemented

- An asset selector for BTC, ETH, SOL, DOGE, LINK, XMR, and SUI, with daily and Monday–Sunday UTC weekly views from supported venues. XMR/USD is sourced exclusively from Kraken because the other configured venues do not offer that market. SUI defaults to Coinbase SUI/USD, with Bitstamp and Kraken USD validation plus clearly labeled Binance SUI/USDT.
- Venue-specific markets are never spliced: USD and USDT histories remain separately labeled and independently cached.
- Completed-candle signals for Support Band, SuperTrend, the screenshot-calibrated KK Supertrend preset, the Larsson-style SMMA proxy, JustUncleL Super Guppy R1.2, Long SMA, Donchian 20/10, Ichimoku, MACD, Parabolic SAR, Vortex, Heikin Ashi, and the daily Golden/Death Cross.
- Separate ADX/DMI confirmation, Chandelier exit, and Mayer/200W valuation views.
- Canvas candlesticks, indicator overlays, filled SMMA ranges, all 27 calculated R1.2 Guppy EMAs with the 14 plots enabled by the published script, R1.2 Swing/Trend Break arrows, regime shading, historical flip markers, and fixed/provisional/conditional trigger labels.
- A role-aware interpretation guide for every model: completed-close entry/positive rules, wait/neutral behavior, exit/negative rules, rationale, and important caveats. Valuation and confirmation models are explicitly not mislabeled as trade orders.
- Family-level agreement instead of a misleading raw indicator count.
- Next-open, long/cash backtests with 5/15/30 bps cost sensitivity, buy-and-hold, rolling four-year reports, cross-venue median Calmar ranking, and the return/drawdown Pareto set.
- A DuckDB-backed Python research service storing normalized candles, indicator states/values, flips, reports, checksums, retrieval times, and source health.
- A local SQLite cache plus private browser IndexedDB candle caches. First visits download complete history; later visits request only overlapping tails from D1 and calculate against the complete local series.
- Static icon/manifest caching only. Dashboard pages and APIs are network-only, while the intentional IndexedDB history cache is validated and incrementally synchronized.

## Run the PWA

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. The local API routes are:

- `/api/v1/registry`
- `/api/v1/dashboard`
- `/api/v1/spot`
- `/api/v1/series`
- `/api/v1/health`
- `POST /api/v1/sync` (authenticated, same-origin, refreshes a selected stale market before its incremental read)
- `/api/v1/stocks/history?symbol=TSLA&startDate=2025-01-01` (`startDate` is optional; returns the authenticated app's stored Yahoo Finance snapshot)
- `/api/v1/auth/config`, `/request-code`, `/verify-code`, `/session`, `/logout`, and `/account`

Except for the authentication endpoints, local and hosted APIs require the `__Host-regime_session` cookie. For local email-login development, create an ignored `.dev.vars` containing `RESEND_API_KEY`, `AUTH_HMAC_SECRET`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_SITE_KEY`, and `AUTH_FROM_EMAIL`. `npm run dev` loads that file without placing secrets in the repository.

If an exchange is unavailable, the UI uses a deterministic demonstration history, displays a blocking warning, and labels the series stale. It never treats fallback data as a confirmed live signal.

The confirmation clock follows the selected timeframe: daily closes confirm at 00:00 UTC, while weekly closes confirm at the Monday 00:00 UTC boundary after Sunday 23:59:59. Countdown text advances locally once per minute without a network request. Loading the page or changing the selected asset/source checks whether D1 is missing an expected completed candle, refreshes that one market server-side only when due, and merges a small overlapping tail into IndexedDB. Indicator and timeframe changes are local calculations and do not request candles.

The confirmation box also shows a current ticker quote from the selected venue. It is fetched once on page load or source change; there is no background polling. This quote is informational only and never enters confirmed indicator or backtest calculations.

## Stock Regime Lab

Open `/stocks` for a separate end-of-day research view of Tesla (`TSLA`), Alphabet Class A (`GOOGL`), NVIDIA (`NVDA`), SpaceX (`SPCX`), Micron Technology (`MU`), and Sandisk (`SNDK`). Stock symbols are deliberately kept out of the crypto asset and exchange registries, so the stock page never offers Bitstamp, Binance, Kraken, or Coinbase as historical-data sources.

Stock history comes from Yahoo Finance's unofficial chart endpoint and is stored as validated completed-session snapshots in Cloudflare D1. On page load or ticker change, the server refreshes D1 only if the expected completed XNAS session is missing; the browser then merges an overlapping D1 tail into its private IndexedDB history. A current informational Yahoo quote is fetched once at the same user-driven boundaries, with no background polling. The stock page needs no provider account, API key, browser token, or per-symbol setup. Clearing IndexedDB does not remove the shared D1 history.

The page uses Yahoo's split-adjusted daily OHLC and reported volume, constructs Monday-based NASDAQ trading weeks without forward-filling holidays, and excludes incomplete weeks. Dividends are deliberately excluded from the price-return research. Calculations and reports run in the browser: every registered indicator remains available, stock KK Supertrend is explicitly labeled as an uncalibrated ATR-10/factor-3 preset, and daily backtests use 252 periods per year while retaining next-session-open execution and 5/15/30 bps cost sensitivity. Yahoo access is unsupported and used here only for the owner's personal research; its endpoint can change or be rate-limited.

Seed or deliberately rebuild all six stock snapshots with `npm run cf:seed:stocks:remote`. The refresh Worker checks Yahoo at 01:30 UTC Tuesday through Saturday, updates a 500-session tail when split metadata is unchanged, and rebases the full series when Yahoo reports a new split.

The local PWA database is `data/bitcoin-regime.sqlite`. Set `REGIME_SQLITE=/absolute/path/market.sqlite` to place it elsewhere. The database is created automatically on the first API request and stays on your machine; there is no Sites or D1 dependency. Existing BTC-only databases migrate in place: prior rows are retained as `asset=btc`, and the cache primary keys isolate asset, venue, timeframe, and timestamp.

## Deploy on Cloudflare without changing nameservers

The production build uses Cloudflare Pages, Pages Functions, D1, and a small scheduled refresh Worker. Indicator and backtest calculations run in the browser; D1 stores completed candles and provenance. Local development remains on SQLite.

See [CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md) for the complete first-deploy commands and the optional `regime.kkarasavvas.com` CNAME setup. It does not use Sites, replace existing GitHub Pages sites, or require moving the domain's nameservers to Cloudflare.

Passwordless login uses the existing D1 binding, Resend's HTTPS API, and Cloudflare Turnstile; it adds no runtime npm dependency or SMTP server. Codes expire after ten minutes, new codes invalidate old ones, plaintext codes and session tokens are never stored, and all protected pages are network-only rather than service-worker fallbacks. Production must have its Resend domain, Turnstile widget, secrets, and `0002_passwordless_auth.sql` migration configured before deploying the auth-enabled Pages bundle.

If you open the development server through the machine's LAN address, `192.168.100.16` is allowlisted for Next.js development assets. Restart `npm run dev` after changing `next.config.ts`. For Docker, both SQLite and DuckDB live under the mounted `/data` volume.

Indicator calculations use the complete normalized series available for each venue. The visible chart is intentionally smaller: the last 180 daily candles or 120 weekly candles. The importers paginate back to each market's own listing date (with a 20-page Bitstamp/Binance safety cap and 30-page Coinbase cap); Kraken's public REST API supplies its latest 720 candles. Coinbase ETH/USD starts at its continuous May 23, 2016 history because the venue omits two launch-period daily candles before that date. Cloud sources need at least 200 daily and 52 weekly candles before they are exposed or refreshed. Canonical defaults are Bitstamp BTC/USD (2011), Bitstamp ETH/USD (2017), and Coinbase SOL/USD (2021), matching the supplied SOL calibration chart. Binance retains the longer SOL/USDT history from 2020 for cross-venue research.

All browser API routes accept `asset=btc|eth|sol|doge|link|xmr|sui`, for example:

```text
/api/v1/dashboard?asset=eth&source=bitstamp&timeframe=1w
/api/v1/series?asset=sol&source=binance&timeframe=1d
/api/v1/spot?asset=eth&source=coinbase
/api/v1/health?asset=sol
```

## Run the DuckDB research API

```bash
python3 -m venv .venv
.venv/bin/pip install -e './backend[dev]'
.venv/bin/python -m uvicorn backend.bitcoin_regime.api:app --reload --port 8000
```

The Python API refreshes all seven crypto assets on startup and every day at 00:15 UTC. It exposes registry, candles, full indicator series, state matrix, flip history, trigger reports, source health, and per-asset research reports under `/api/v1/`. The calculation subprocess imports the same TypeScript indicator engine used by the PWA, keeping one formula source of truth. Its endpoints also accept an `asset` query parameter and its DuckDB schema isolates assets in every dataset, candle, signal, and source-health key.

Set `REGIME_DB=/path/to/regimes.duckdb` to choose a research-database location. The default is `data/regimes.duckdb`. DuckDB stores the deeper research warehouse; SQLite is the PWA's fast local candle and signal cache.

## Container

```bash
docker build -t btc-regime-lab .
docker run --rm -p 3000:3000 -p 8000:8000 -v "$PWD/data:/data" btc-regime-lab
```

The PWA is served on port 3000 and the DuckDB research API on port 8000 from one container. Put both behind the same private HTTPS/VPN boundary.

## Verification

```bash
npm test
.venv/bin/pytest backend/tests
```

The tests cover the complete preset registry, deterministic golden states, recursive/non-repainting behavior, prior-period Donchian channels and state retention, UTC weekly aggregation, threshold classifications, data-quality failures, next-open execution, DuckDB provenance, and the production-rendered PWA shell.

## Research conventions

### Dashboard workflow

- Both labs remember their asset, venue, timeframe, and indicator as **device-local view preferences**. Validated URL parameters override these preferences; bookmarks and browser Back restore the corresponding view. Stock and crypto preferences stay separate. No account data or tokens are saved in these preferences.
- The authenticated **Overview** page (`/overview/`) replaces the per-lab KK watchlists. It lists every platform asset, crypto first and stocks second, with one global indicator dropdown. It uses each crypto asset's default venue and Yahoo for stocks; row links open that exact venue/indicator in the appropriate lab. Opening the overview or **Check all assets** loads browser caches and checks incremental candles and quotes once, with three assets in flight at most. Indicator changes only recalculate locally. Rows disclose quote age, completed-candle dates, level distance, daily/weekly disagreement and update failures. Unsupported timeframes show N/A, unready models show insufficient history, and conditional/context models are not assigned invented reversal levels. Daily-only models use daily levels and flip dates; other models use weekly ones. No pins or automatic polling remain.
- Each lab's **Check for updates** uses the same on-demand D1/IndexedDB incremental workflow as a reload. Cached charts remain usable during checks. Provider-sync failure, cooldown, stale snapshots, quote retrieval age, and cache-save failure are visible. A sync error does not prevent reading the last good D1 snapshot. Requests and optional cache access are timeout-bounded; no API requests are service-worker cached.
- Shared price formatting retains six significant digits for small assets (at least cents for larger ones). Chart padding scales with price, including sub-dollar coins. The full downloaded series is available through range, zoom, pan, previous/next flip, log-scale and native-fullscreen controls. Historical views hide today's trigger lines; log scale omits non-positive levels.
- Indicators disclose required/available candles. Unready models are not displayed as neutral or counted in family agreement. Supporting-context indicators do not receive allocation backtests. Mobile model rows expand to show their rules and a link to the chart.

### Calibration evidence and research comparisons

- The on-site **KK calibration notebook** starts collapsed, including after changing the asset or timeframe. It uses the same archived OHLC fixtures as the regression tests (`lib/kk-reference-data.ts`). Its registry (`lib/kk-calibration.ts`) records venue/denomination, reference cutoff, target state/level/flip, tolerance, previous preset and rationale. Capture timestamps that were not recorded remain explicitly unknown. It does not publish private screenshots or substitute reference fixtures for live market history.
- Add future screenshot evidence to the registry with a fixed completed-candle fixture and regression assertions. Modify **KK only** when needed; retain earlier references and record any failed fit. A later reference that fits without changing settings is a validation observation, not a reason to refit. BTC's legacy reference and inherited daily presets are labeled honestly where independently archived evidence is absent.
- The observed weekly groups (10/3, 10/2, 15/2) are not an automatic market-cap rule. The notebook includes ATR/price for comparable volatility context. Validate proposed group rules on later screenshots and new assets, not on backtest returns.
- Both labs and the offline report runner use a common evaluation window after the included regime models' warmups. Unsupported/unready models or internally discontinuous signal vectors are excluded, not assigned zero performance. Dates and open-to-open observation counts are shown. Earlier candles remain available to calculate indicators.
- Strategies and their buy-and-hold benchmark start in cash at the same evaluation open, include initial entry costs, and use the same 5/15/30-bps turnover-cost convention. Curves mark portfolios at subsequent opens, including drawdowns, with no assumed final liquidation. An execution ledger distinguishes the confirming signal candle from the following execution open.
- Rolling four-year windows contain exactly four times the annualization count (365 crypto days, 252 equity sessions, or 52 weeks per year), start annually after warmup, and have matching benchmark windows. They overlap and are not independent trials. Too-short histories show no four-year result. Screenshot-fitted historical results remain descriptive, not out-of-sample proof.

- A state confirmed at close becomes effective at the next candle open.
- Exposure is 100% of the selected crypto asset in bull, 50% in neutral, and 0% in bear; two-state models use 100%/0%.
- Cash yield is zero. No shorts or leverage.
- Presets are not performance-optimized against asset history. KK Supertrend is screenshot-calibrated for BTC, ETH, SOL, and weekly DOGE/LINK/XMR/SUI; daily DOGE/LINK/XMR/SUI deliberately use the uncalibrated standard 10/3 preset. The other named presets remain fixed except for Super Guppy's explicitly exposed R1.2 inputs.
- Venues are never spliced. Gaps, duplicates, malformed OHLC, and completed-history revisions fail the data refresh; prices are never forward-filled.
- SuperTrend is presented as a transparent alternative, not a MoneyLine clone. KK Supertrend applies the same documented Wilder-ATR recurrence with fixed 10/3 BTC, 10/2 ETH/SOL, and weekly 15/2 DOGE/LINK/XMR/SUI presets, calibrated to supplied screenshots rather than selected for backtest performance. Daily DOGE/LINK/XMR/SUI remain uncalibrated at 10/3. A longer ATR length smooths the volatility estimate; a lower factor moves the trail closer to price and generally produces earlier, more frequent reversals. It is an independent comparison model and does not claim to reproduce or be endorsed by any private indicator. SMMA 15/19/25/29 is labeled a community Larsson-style proxy, never the official line.
- Super Guppy independently implements JustUncleL R1.2's 11-EMA Trader group (3–23 step 2), 16-EMA Investor group (25–70 step 3), group-average conditions, dynamic aqua/blue/gray and lime/red/gray colors, default Swing signals, aggressive Trend Break signals, and six-bar repeat filter. Its settings panel exposes the published signal toggles, confluence, candle-change retriggers, group averages, EMA-200 display/filter, candle coloring, source, lookback, anchor, and all 27 lengths. The anchor cannot alter this app's daily/weekly charts because the published input is capped at 1,440 minutes.
- For comparison and next-open backtesting, Super Guppy's single dashboard state follows the published default Swing condition: bullish when its long condition is active, bearish when its short condition is active, and neutral otherwise. The chart preserves the two R1.2 group states and event types rather than pretending the source defines one unified band color.
- Donchian 55/20, 12-month absolute momentum, and the Faber 10-month baseline were retired from the active dashboard on 2026-08-26. Their prior parameters and restoration reference are preserved in [RETIRED_MODELS.md](RETIRED_MODELS.md) for a possible future research section.

This is research software, not financial advice.
