# BTC Regime Lab

A transparent, installable Bitcoin regime-indicator research platform. It compares fixed, documented trend models without claiming to reproduce private MoneyLine or Larsson Line formulas and without producing orders or allocation recommendations.

## What is implemented

- Daily and Monday–Sunday UTC weekly views for Bitstamp BTC/USD, Binance BTC/USDT, Kraken BTC/USD, and Coinbase BTC/USD.
- Completed-candle signals for Support Band, SuperTrend, the Larsson-style SMMA proxy, Long SMA, two Donchian presets, Ichimoku, MACD, Parabolic SAR, Vortex, Heikin Ashi, absolute momentum, and the daily Golden/Death Cross.
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

The local PWA database is `data/bitcoin-regime.sqlite`. Set `REGIME_SQLITE=/absolute/path/market.sqlite` to place it elsewhere. The database is created automatically on the first API request and stays on your machine; there is no Sites or D1 dependency.

If you open the development server through the machine's LAN address, `192.168.100.16` is allowlisted for Next.js development assets. Restart `npm run dev` after changing `next.config.ts`. For Docker, both SQLite and DuckDB live under the mounted `/data` volume.

Indicator calculations use the complete normalized series available for each venue. The visible chart is intentionally smaller: the last 180 daily candles or 120 weekly candles. Current provider limits yield up to seven 1,000-candle Bitstamp pages, full Binance history from August 2017, eight 300-candle Coinbase pages, and Kraken's 720-candle REST window.

## Run the DuckDB research API

```bash
python3 -m venv .venv
.venv/bin/pip install -e './backend[dev]'
.venv/bin/python -m uvicorn backend.bitcoin_regime.api:app --reload --port 8000
```

The Python API refreshes on startup and every day at 00:15 UTC. It exposes registry, candles, full indicator series, state matrix, flip history, trigger reports, source health, and research reports under `/api/v1/`. The calculation subprocess imports the same TypeScript indicator engine used by the PWA, keeping one formula source of truth.

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
- Exposure is 100% BTC in bull, 50% in neutral, and 0% in bear; two-state models use 100%/0%.
- Cash yield is zero. No shorts or leverage.
- Presets are read-only in v1 and are not optimized against Bitcoin history.
- Venues are never spliced. Gaps, duplicates, malformed OHLC, and completed-history revisions fail the data refresh; prices are never forward-filled.
- SuperTrend is presented as a transparent alternative, not a MoneyLine clone. SMMA 15/19/25/29 is labeled a community Larsson-style proxy, never the official line.

This is research software, not financial advice.
