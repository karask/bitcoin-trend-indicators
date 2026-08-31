# Crypto Regime Lab

A transparent, installable BTC, ETH, SOL, DOGE, and LINK regime-indicator research platform, with an isolated stock-research page for TSLA, GOOGL, NVDA, SPCX, MU, and SNDK. It compares fixed, documented trend models without claiming to reproduce private MoneyLine or Larsson Line formulas and without producing orders or allocation recommendations.

Hosted access uses passwordless email authentication. A visitor enters an email address and a single-use six-digit code; the first successful verification creates the account and later verifications sign it in. Both research labs and all market-data APIs require the resulting secure 30-day session. There are no passwords, social identities, or marketing emails.

## What is implemented

- An asset selector for BTC, ETH, SOL, DOGE, and LINK, with daily and Monday–Sunday UTC weekly views from Bitstamp, Binance, Kraken, and Coinbase Exchange.
- Venue-specific markets are never spliced: USD and USDT histories remain separately labeled and independently cached.
- Completed-candle signals for Support Band, SuperTrend, the screenshot-calibrated KK Supertrend preset, the Larsson-style SMMA proxy, JustUncleL Super Guppy R1.2, Long SMA, Donchian 20/10, Ichimoku, MACD, Parabolic SAR, Vortex, Heikin Ashi, and the daily Golden/Death Cross.
- Separate ADX/DMI confirmation, Chandelier exit, and Mayer/200W valuation views.
- Canvas candlesticks, indicator overlays, filled SMMA ranges, all 27 calculated R1.2 Guppy EMAs with the 14 plots enabled by the published script, R1.2 Swing/Trend Break arrows, regime shading, historical flip markers, and fixed/provisional/conditional trigger labels.
- A role-aware interpretation guide for every model: completed-close entry/positive rules, wait/neutral behavior, exit/negative rules, rationale, and important caveats. Valuation and confirmation models are explicitly not mislabeled as trade orders.
- Family-level agreement instead of a misleading raw indicator count.
- Next-open, long/cash backtests with 5/15/30 bps cost sensitivity, buy-and-hold, rolling four-year reports, cross-venue median Calmar ranking, and the return/drawdown Pareto set.
- A DuckDB-backed Python research service storing normalized candles, indicator states/values, flips, reports, checksums, retrieval times, and source health.
- A local SQLite cache for normalized PWA candles and current signal snapshots, so ordinary page loads do not redownload exchange history.
- PWA shell caching only. API responses are network-only and stale/demo data cannot present a new confirmed flip.

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
- `/api/v1/stocks/history?symbol=TSLA&startDate=2025-01-01` (`startDate` is optional; requires the visitor's Tiingo token in the `Authorization` header)
- `/api/v1/auth/config`, `/request-code`, `/verify-code`, `/session`, `/logout`, and `/account`

Except for the authentication endpoints, local and hosted APIs require the `__Host-regime_session` cookie. For local email-login development, create an ignored `.dev.vars` containing `RESEND_API_KEY`, `AUTH_HMAC_SECRET`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_SITE_KEY`, and `AUTH_FROM_EMAIL`. `npm run dev` loads that file without placing secrets in the repository.

If an exchange is unavailable, the UI uses a deterministic demonstration history, displays a blocking warning, and labels the series stale. It never treats fallback data as a confirmed live signal.

The confirmation clock follows the selected timeframe: daily closes confirm at 00:00 UTC, while weekly closes confirm at the Monday 00:00 UTC boundary after Sunday 23:59:59. An open tab rechecks the API every five minutes. SQLite serves stored history until the expected completed-candle timestamp advances; only then does the API refresh that venue from its public endpoint.

The confirmation box also shows a live ticker quote from the selected venue. It refreshes on every page load, source change, and five-minute background refresh. This quote is informational only and never enters confirmed indicator or backtest calculations.

## Stock Regime Lab

Open `/stocks` for a separate end-of-day research view of Tesla (`TSLA`), Alphabet Class A (`GOOGL`), NVIDIA (`NVDA`), SpaceX (`SPCX`), Micron Technology (`MU`), and Sandisk (`SNDK`). Stock symbols are deliberately kept out of the crypto asset and exchange registries, so the stock page never offers Bitstamp, Binance, Kraken, or Coinbase as historical-data sources.

Stock history comes from Tiingo's bring-your-own-key developer model. Each visitor supplies their own Tiingo API token; the token is sent only in an `Authorization` header, retained in browser `sessionStorage`, and never written to the repository, shared databases, URLs, service-worker caches, or public stock-series endpoints. Tiingo explicitly requires a redistribution license before its history can be pre-populated into a shared application database, so this project does not copy Tiingo candles into D1. See Tiingo's [developer-program rules](https://www.tiingo.com/documentation/appendix/developers) and [free-tier limits](https://www.tiingo.com/about/pricing).

After the first authorized download, adjusted candles are persisted in private IndexedDB storage in that browser. Later visits render the saved history immediately, even without a token in the tab, and an authorized refresh requests only a 400-calendar-day overlap plus newer sessions. The overlap detects dividend, split, and provider-correction rebases; if adjusted OHLCV changed, the app safely replaces the full local history. **Forget token** removes only the session token, while **Clear saved history** removes that symbol's local candles.

The page uses Tiingo's split- and dividend-adjusted daily OHLCV fields, constructs Monday-based NASDAQ trading weeks without forward-filling holidays, and excludes incomplete weeks. It shows the latest completed end-of-day close rather than presenting a delayed quote as live. Calculations and reports run in the browser: every registered indicator remains available, stock KK Supertrend is explicitly labeled as an uncalibrated ATR-10/factor-3 preset, and daily backtests use 252 periods per year while retaining next-session-open execution and 5/15/30 bps cost sensitivity. Stock candles and reports are not stored in SQLite, D1, DuckDB, the service worker, or any shared cache.

The local PWA database is `data/bitcoin-regime.sqlite`. Set `REGIME_SQLITE=/absolute/path/market.sqlite` to place it elsewhere. The database is created automatically on the first API request and stays on your machine; there is no Sites or D1 dependency. Existing BTC-only databases migrate in place: prior rows are retained as `asset=btc`, and the cache primary keys isolate asset, venue, timeframe, and timestamp.

## Deploy on Cloudflare without changing nameservers

The production build uses Cloudflare Pages, Pages Functions, D1, and a small scheduled refresh Worker. Indicator and backtest calculations run in the browser; D1 stores completed candles and provenance. Local development remains on SQLite.

See [CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md) for the complete first-deploy commands and the optional `regime.kkarasavvas.com` CNAME setup. It does not use Sites, replace existing GitHub Pages sites, or require moving the domain's nameservers to Cloudflare.

Passwordless login uses the existing D1 binding, Resend's HTTPS API, and Cloudflare Turnstile; it adds no runtime npm dependency or SMTP server. Codes expire after ten minutes, new codes invalidate old ones, plaintext codes and session tokens are never stored, and all protected pages are network-only rather than service-worker fallbacks. Production must have its Resend domain, Turnstile widget, secrets, and `0002_passwordless_auth.sql` migration configured before deploying the auth-enabled Pages bundle.

If you open the development server through the machine's LAN address, `192.168.100.16` is allowlisted for Next.js development assets. Restart `npm run dev` after changing `next.config.ts`. For Docker, both SQLite and DuckDB live under the mounted `/data` volume.

Indicator calculations use the complete normalized series available for each venue. The visible chart is intentionally smaller: the last 180 daily candles or 120 weekly candles. The importers paginate back to each market's own listing date (with a 20-page Bitstamp/Binance safety cap and 30-page Coinbase cap); Kraken's public REST API supplies its latest 720 candles. Coinbase ETH/USD starts at its continuous May 23, 2016 history because the venue omits two launch-period daily candles before that date. Cloud sources need at least 200 daily and 52 weekly candles before they are exposed or refreshed. Canonical defaults are Bitstamp BTC/USD (2011), Bitstamp ETH/USD (2017), and Coinbase SOL/USD (2021), matching the supplied SOL calibration chart. Binance retains the longer SOL/USDT history from 2020 for cross-venue research.

All browser API routes accept `asset=btc|eth|sol|doge|link`, for example:

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

The Python API refreshes all five crypto assets on startup and every day at 00:15 UTC. It exposes registry, candles, full indicator series, state matrix, flip history, trigger reports, source health, and per-asset research reports under `/api/v1/`. The calculation subprocess imports the same TypeScript indicator engine used by the PWA, keeping one formula source of truth. Its endpoints also accept an `asset` query parameter and its DuckDB schema isolates assets in every dataset, candle, signal, and source-health key.

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

- A state confirmed at close becomes effective at the next candle open.
- Exposure is 100% of the selected crypto asset in bull, 50% in neutral, and 0% in bear; two-state models use 100%/0%.
- Cash yield is zero. No shorts or leverage.
- Presets are not performance-optimized against asset history. KK Supertrend is screenshot-calibrated for BTC, ETH, and SOL; DOGE and LINK deliberately use the uncalibrated standard factor-3 preset. The other named presets remain fixed except for Super Guppy's explicitly exposed R1.2 inputs.
- Venues are never spliced. Gaps, duplicates, malformed OHLC, and completed-history revisions fail the data refresh; prices are never forward-filled.
- SuperTrend is presented as a transparent alternative, not a MoneyLine clone. KK Supertrend applies the same documented Wilder-ATR recurrence with a fixed 10/3 BTC preset and fixed 10/2 ETH/SOL presets, calibrated to supplied weekly screenshots rather than selected for backtest performance. It is an independent comparison model and does not claim to reproduce or be endorsed by any private indicator. SMMA 15/19/25/29 is labeled a community Larsson-style proxy, never the official line.
- Super Guppy independently implements JustUncleL R1.2's 11-EMA Trader group (3–23 step 2), 16-EMA Investor group (25–70 step 3), group-average conditions, dynamic aqua/blue/gray and lime/red/gray colors, default Swing signals, aggressive Trend Break signals, and six-bar repeat filter. Its settings panel exposes the published signal toggles, confluence, candle-change retriggers, group averages, EMA-200 display/filter, candle coloring, source, lookback, anchor, and all 27 lengths. The anchor cannot alter this app's daily/weekly charts because the published input is capped at 1,440 minutes.
- For comparison and next-open backtesting, Super Guppy's single dashboard state follows the published default Swing condition: bullish when its long condition is active, bearish when its short condition is active, and neutral otherwise. The chart preserves the two R1.2 group states and event types rather than pretending the source defines one unified band color.
- Donchian 55/20, 12-month absolute momentum, and the Faber 10-month baseline were retired from the active dashboard on 2026-08-26. Their prior parameters and restoration reference are preserved in [RETIRED_MODELS.md](RETIRED_MODELS.md) for a possible future research section.

This is research software, not financial advice.
