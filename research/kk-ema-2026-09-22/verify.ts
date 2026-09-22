import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculateIndicators, type Candle } from '../../lib/regimes.ts';
const directory = new URL('./', import.meta.url);
const comparison = JSON.parse(fs.readFileSync(new URL('comparison.json', directory), 'utf8'));
const closeByAsset = { btc: 84846.18, eth: 2721.76, sol: 116.77, zec: 1562.28 };
const through = Date.UTC(2026, 8, 21);
for (const [asset, partialClose] of Object.entries(closeByAsset)) {
  const rows: Candle[] = JSON.parse(fs.readFileSync(new URL(`${asset}-daily.json`, directory), 'utf8'));
  const candles = rows.filter(row => row.time <= through).map(row => ({ ...row, volume: 0, complete: row.time < through, close: row.time === through ? partialClose : row.close }));
  // Research-only screenshot replay; these partial bars are not written to production stores.
  const result = calculateIndicators(candles, '1d', { indicatorIds: ['kk_ema_ribbon'] })[0];
  const expected = comparison.details[asset].calculatedPartial;
  assert.ok(Math.abs(result.values.ema32! - expected[0]) < 1e-8);
  assert.ok(Math.abs(result.values.ema58! - expected[1]) < 1e-8);
  assert.equal(result.state, 'bull');
  console.log(`${asset}: production implementation matches independent research values; screenshot-time state gold/bullish`);
}
