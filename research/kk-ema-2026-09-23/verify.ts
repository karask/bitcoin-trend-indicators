import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculateIndicators, type Candle } from '../../lib/regimes.ts';

const directory = new URL('./', import.meta.url);
const research = JSON.parse(fs.readFileSync(new URL('results.json', directory), 'utf8')) as {
  assets: Record<string, {
    crosshair: string;
    currentColor: 'gold' | 'purple' | 'grey';
    sources: { close: { values: number[] } };
  }>;
};
for (const [asset, evidence] of Object.entries(research.assets)) {
  const rows = JSON.parse(fs.readFileSync(new URL(`${asset}-daily.json`, directory), 'utf8')) as Candle[];
  const through = Date.parse(`${evidence.crosshair}T00:00:00Z`);
  const candles = rows.filter(row => row.time <= through).map(row => ({ ...row, volume: 0, complete: true }));
  const result = calculateIndicators(candles, '1d', { indicatorIds: ['kk_ema_ribbon'] })[0];
  for (const [index, key] of ['ema32', 'ema58'].entries()) {
    assert.ok(Math.abs(result.values[key]! - evidence.sources.close.values[index]) < 1e-8, `${asset} ${key}`);
  }
  const expectedState = { gold: 'bull', purple: 'bear', grey: 'neutral' }[evidence.currentColor];
  assert.equal(result.state, expectedState, asset);
  console.log(`${asset}: production 32/58 values and ${expectedState} state verified`);
}
