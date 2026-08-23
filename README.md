# Crypto Regime Lab

A transparent, installable BTC, ETH, and SOL regime-indicator research platform. It compares fixed, documented trend models without claiming to reproduce private MoneyLine or Larsson Line formulas and without producing orders or allocation recommendations.

## What is implemented

- An asset selector for BTC, ETH, and SOL, with daily and Monday–Sunday UTC weekly views from Bitstamp, Binance, Kraken, and Coinbase Exchange.
- Venue-specific markets are never spliced: USD and USDT histories remain separately labeled and independently cached.
- Completed-candle signals for Support Band, SuperTrend, the Larsson-style SMMA proxy, a transparent 27-EMA Super Guppy variant, Long SMA, two Donchian presets, Ichimoku, MACD, Parabolic SAR, Vortex, Heikin Ashi, absolute momentum, and the daily Golden/Death Cross.
- Separate ADX/DMI confirmation, Chandelier exit, and Mayer/200W valuation views.
- Canvas candlesticks, indicator overlays, regime shading, historical flip markers, and fixed/provisional/conditional trigger labels.
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

If an exchange is unavailable, the UI uses a deterministic demonstration history, displays a blocking warning, and labels the series stale. It never treats fallback data as a confirmed live signal.

The confirmation clock follows the selected timeframe: daily closes confirm at 00:00 UTC, while weekly closes confirm at the Monday 00:00 UTC boundary after Sunday 23:59:59. An open tab rechecks the API every five minutes. SQLite serves stored history until the expected completed-candle timestamp advances; only then does the API refresh that venue from its public endpoint.

The confirmation box also shows a live ticker quote from the selected venue. It refreshes on every page load, source change, and five-minute background refresh. This quote is informational only and never enters confirmed indicator or backtest calculations.

The local PWA database is `data/bitcoin-regime.sqlite`. Set `REGIME_SQLITE=/absolute/path/market.sqlite` to place it elsewhere. The database is created automatically on the first API request and stays on your machine; there is no Sites or D1 dependency. Existing BTC-only databases migrate in place: prior rows are retained as `asset=btc`, and the cache primary keys isolate asset, venue, timeframe, and timestamp.

## Deploy on Cloudflare without changing nameservers

The production build uses Cloudflare Pages, Pages Functions, D1, and a small scheduled refresh Worker. Indicator and backtest calculations run in the browser; D1 stores completed candles and provenance. Local development remains on SQLite.

See [CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md) for the complete first-deploy commands and the optional `regime.kkarasavvas.com` CNAME setup. It does not use Sites, replace existing GitHub Pages sites, or require moving the domain's nameservers to Cloudflare.

If you open the development server through the machine's LAN address, `192.168.100.16` is allowlisted for Next.js development assets. Restart `npm run dev` after changing `next.config.ts`. For Docker, both SQLite and DuckDB live under the mounted `/data` volume.

Indicator calculations use the complete normalized series available for each venue. The visible chart is intentionally smaller: the last 180 daily candles or 120 weekly candles. The importers paginate back to each market's own listing date (with a 20-page Bitstamp/Binance safety cap and 30-page Coinbase cap); Kraken's public REST API supplies its latest 720 candles. Canonical defaults are Bitstamp BTC/USD (2011), Bitstamp ETH/USD (2017), and Binance SOL/USDT (2020). Coinbase reaches ETH/USD in 2016 and SOL/USD in 2021; Kraken can validate all three over its REST window.

All browser API routes accept `asset=btc|eth|sol`, for example:

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

The Python API refreshes all three assets on startup and every day at 00:15 UTC. It exposes registry, candles, full indicator series, state matrix, flip history, trigger reports, source health, and per-asset research reports under `/api/v1/`. The calculation subprocess imports the same TypeScript indicator engine used by the PWA, keeping one formula source of truth. Its endpoints also accept an `asset` query parameter and its DuckDB schema isolates assets in every dataset, candle, signal, and source-health key.

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
- Presets are read-only in v1 and are not optimized against BTC, ETH, or SOL history.
- Venues are never spliced. Gaps, duplicates, malformed OHLC, and completed-history revisions fail the data refresh; prices are never forward-filled.
- SuperTrend is presented as a transparent alternative, not a MoneyLine clone. SMMA 15/19/25/29 is labeled a community Larsson-style proxy, never the official line.
- Super Guppy uses the fixed published EMA groups (3–23 step 2 and 25–70 step 3) with an explicit full-ordering state rule. It shares the smoothing/order family vote with the other moving-average models.

This is research software, not financial advice.
