# Cloudflare deployment

This deployment does not use Codex Sites, does not replace GitHub Pages, and does not require changing the nameservers for `kkarasavvas.com`.

## Architecture

- Cloudflare Pages serves the installable static PWA.
- Pages Functions expose the read-only JSON API and live venue quote.
- Cloudflare D1 stores normalized, completed daily and weekly candles.
- The browser calculates the indicators and backtests from the stored candles.
- One small Worker refreshes completed candles after the UTC daily close. Its three Cron Triggers refresh BTC at 00:15, ETH at 00:25, and SOL at 00:35 UTC.
- Local development continues to use `data/bitcoin-regime.sqlite`; hosted and local databases are intentionally separate.

The PWA shell is cached. Market API responses are not cached by the service worker, so stale data is visibly labeled and cannot create a new confirmed flip.

## First deployment

Run from the repository root:

```bash
npm ci
npx wrangler login
npx wrangler d1 create crypto-regime-data
```

Copy the `database_id` printed by the last command into the `REGIME_DB` entry in both `wrangler.jsonc` and `wrangler.refresh.jsonc`. Then run:

```bash
npm run cf:d1:remote
npm run cf:seed:remote
npm run cf:deploy:pages
npm run cf:deploy:refresh
openssl rand -hex 32 | npx wrangler secret put REFRESH_TOKEN --config wrangler.refresh.jsonc
```

The seed command validates all four configured venues for BTC, ETH, and SOL. A venue with a gap, duplicate, malformed OHLC, or unavailable provider is skipped instead of silently storing bad data. The Pages source selector only lists successfully seeded venues.

The refresh token protects the optional manual refresh endpoint. Scheduled refreshes do not expose or use that token.

## Custom subdomain without changing nameservers

The application works immediately at `https://bitcoin-trend-indicators.pages.dev`.

To use a subdomain such as `regime.kkarasavvas.com` while keeping the existing nameservers and all GitHub Pages sites:

1. In Cloudflare, open **Workers & Pages → bitcoin-trend-indicators → Custom domains → Set up a domain**.
2. Enter `regime.kkarasavvas.com` and complete Cloudflare's custom-domain setup first.
3. At the DNS provider that currently hosts `kkarasavvas.com`, add this record:

   - Type: `CNAME`
   - Name/host: `regime`
   - Target/value: `bitcoin-trend-indicators.pages.dev`

Do not change the domain's nameservers. Do not replace the apex (`kkarasavvas.com`) GitHub Pages records. Cloudflare requires the subdomain to be associated with the Pages project before the CNAME is added.

## Later deployments

After a code change:

```bash
npm run cf:deploy:pages
npm run cf:deploy:refresh
```

Schema and full-history seed commands are only needed for schema changes, a new database, a new asset/venue, or a deliberate history rebuild. The Cron Worker normally adds only recent completed candles.

## Local Cloudflare-runtime test

```bash
npm run build:pages
npm run cf:d1:local
npm run cf:seed:local
npx wrangler pages dev dist/cloudflare-pages --d1 REGIME_DB=crypto-regime-data
```

Open the URL Wrangler prints. This uses a local D1 emulator under `.wrangler`; it does not read or overwrite the normal local SQLite database.

## Free-plan fit

Static Pages assets are free. Pages Functions and the refresh Worker share the Workers Free request allowance. D1's Free plan currently includes 5 million rows read per day, 100,000 rows written per day, and 5 GB total storage. This personal dashboard is designed to stay within those limits: each scheduled refresh reads/writes only a recent window, while indicator calculation remains in the browser.

