"""Archive screenshot snapshots and public daily candles for ribbon calibration."""
import hashlib
import json
import shutil
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
ARCHIVE = ROOT / 'data/kk-research-2026-09-30'
DAY = 86_400_000
SNAPSHOT = int(datetime(2026, 9, 30, tzinfo=timezone.utc).timestamp()*1000)
CONFIG = {
 'btc': dict(index=0, feed='binance', symbol='BTCUSDT', venue='BINANCE:BTCUSDT', digits=2, values=[80174.15,76946.21], ohlc=[83663.66,83731.46,83175.67,83414.60], clock='05:59:13'),
 'eth': dict(index=1, feed='binance', symbol='ETHUSDT', venue='BINANCE:ETHUSDT', digits=2, values=[2547.47,2408.37], ohlc=[2677.98,2680.62,2666.19,2675.17], clock='05:59:45'),
 'sol': dict(index=2, feed='coinbase', symbol='SOL-USD', venue='CRYPTO:SOLUSD', digits=2, values=[108.67,101.17], ohlc=[119.08,119.99,118.46,119.03], clock='06:00:07'),
 'zec': dict(index=3, feed='binance', symbol='ZECUSDT', venue='CRYPTO:ZECUSD', digits=2, values=[1278.86,1081.82], ohlc=[1416.93,1432.75,1400.14,1405.12], clock='06:00:22'),
 'ray': dict(index=4, feed='binance', symbol='RAYUSDT', venue='CRYPTO:RAYUSD', digits=4, values=[1.5536,1.2933], ohlc=[1.9126,1.9615,1.8670,1.8799], clock='06:00:39'),
 'hype': dict(index=5, feed='hyperliquid', symbol='HYPE', venue='CRYPTO:HYPEUSD', digits=3, values=[85.178,79.740], ohlc=[86.054,86.566,85.513,85.974], clock='06:00:55'),
 'doge': dict(index=6, feed='coinbase', symbol='DOGE-USD', venue='COINBASE:DOGEUSD', digits=5, values=[.08932,.08605], ohlc=[.09386,.09436,.09305,.09404], clock='06:01:19'),
 'sui': dict(index=7, feed='binance', symbol='SUIUSDC', venue='BINANCE:SUIUSDC', digits=4, values=[.9302,.8609], ohlc=[1.1521,1.1773,1.1409,1.1657], clock='06:01:39'),
 'jup': dict(index=8, feed='bitstamp', symbol='jupusd', venue='BITSTAMP:JUPUSD', digits=6, values=[.275266,.250703], ohlc=[.329049,.336289,.329049,.331303], clock='06:02:15'),
 'qnt': dict(index=9, feed='coinbase', symbol='QNT-USD', venue='CRYPTO:QNTUSD', digits=2, values=[116.21,94.59], ohlc=[266.57,306.62,262.83,286.89], clock='06:03:11'),
 'link': dict(index=10, feed='binance', symbol='LINKUSDT', venue='BINANCE:LINKUSDT', digits=3, values=[12.558,11.614], ohlc=[14.607,14.615,14.321,14.425], clock='06:04:21'),
}
SESSION = requests.Session()
REQUESTS = []

def request(asset, url, body=None):
 response = SESSION.get(url, timeout=40) if body is None else SESSION.post(url, json=body, timeout=40)
 response.raise_for_status()
 raw = response.content
 file = ARCHIVE / 'providers' / f'{asset}-{len(REQUESTS):02d}.json'
 file.parent.mkdir(parents=True, exist_ok=True)
 file.write_bytes(raw)
 REQUESTS.append(dict(asset=asset, url=url, requestBody=body, retrievedAt=datetime.now(timezone.utc).isoformat(), rawFile=str(file.relative_to(ROOT)), sha256=hashlib.sha256(raw).hexdigest()))
 time.sleep(.35)
 return response.json()

def fetch(asset, feed, symbol, start):
 rows = []
 if feed == 'hyperliquid':
  body = {'type':'candleSnapshot','req':{'coin':symbol,'interval':'1d','startTime':start,'endTime':SNAPSHOT+DAY-1}}
  batch = request(asset,'https://api.hyperliquid.xyz/info',body)
  return [dict(time=int(x['t']),open=float(x['o']),high=float(x['h']),low=float(x['l']),close=float(x['c'])) for x in batch]
 if feed == 'kraken':
  batch = request(asset,f'https://api.kraken.com/0/public/OHLC?pair={symbol}&interval=1440')
  if batch['error']: raise ValueError(batch['error'])
  series = next(v for k,v in batch['result'].items() if k != 'last')
  return [dict(time=int(x[0])*1000,open=float(x[1]),high=float(x[2]),low=float(x[3]),close=float(x[4])) for x in series]
 while start < SNAPSHOT+DAY:
  if feed == 'binance':
   url = f'https://data-api.binance.vision/api/v3/klines?symbol={symbol}&interval=1d&startTime={start}&endTime={SNAPSHOT+DAY-1}&limit=1000'
   batch = request(asset,url)
   tail = [dict(time=int(x[0]),open=float(x[1]),high=float(x[2]),low=float(x[3]),close=float(x[4])) for x in batch]
  elif feed == 'coinbase':
   stop = min(start+250*DAY,SNAPSHOT+DAY)
   a = datetime.fromtimestamp(start/1000,timezone.utc).isoformat()
   b = datetime.fromtimestamp(stop/1000,timezone.utc).isoformat()
   batch = request(asset,f'https://api.exchange.coinbase.com/products/{symbol}/candles?granularity=86400&start={a}&end={b}')
   tail = [dict(time=int(x[0])*1000,low=float(x[1]),high=float(x[2]),open=float(x[3]),close=float(x[4])) for x in batch]
  elif feed == 'bitstamp':
   batch = request(asset,f'https://www.bitstamp.net/api/v2/ohlc/{symbol}/?step=86400&limit=1000&start={start//1000}&end={(SNAPSHOT+DAY-1)//1000}')
   tail = [dict(time=int(x['timestamp'])*1000,open=float(x['open']),high=float(x['high']),low=float(x['low']),close=float(x['close'])) for x in batch['data']['ohlc']]
  else: raise ValueError(feed)
  if not tail: break
  rows.extend(tail)
  next_start = max(x['time'] for x in tail)+DAY
  if next_start <= start: raise ValueError('Pagination did not advance')
  start = next_start
 return rows

def archive_series(asset, rows):
 rows = sorted({r['time']:r for r in rows if r['time']<SNAPSHOT}.values(),key=lambda r:r['time'])
 assert rows and rows[-1]['time']==SNAPSHOT-DAY, f'{asset}: missing September 29'
 assert all(b['time']-a['time']==DAY for a,b in zip(rows,rows[1:])),f'{asset}: daily gap'
 assert all(r['low']<=min(r['open'],r['close'])<=max(r['open'],r['close'])<=r['high'] for r in rows),f'{asset}: invalid OHLC'
 (HERE/f'{asset}-daily.json').write_text(json.dumps(rows))
 return rows

def main():
 HERE.mkdir(parents=True,exist_ok=True)
 con = sqlite3.connect(f'file:{ROOT / "data/bitcoin-regime.sqlite"}?mode=ro',uri=True)
 provenance = {}
 for asset,cfg in CONFIG.items():
  filename = 'image.png' if cfg['index']==0 else f'image({cfg["index"]}).png'
  image = Path('/home/kos/Downloads')/filename
  saved = ARCHIVE/'references'/f'{asset}.png';saved.parent.mkdir(parents=True,exist_ok=True)
  if saved.exists() and hashlib.sha256(saved.read_bytes()).digest()!=hashlib.sha256(image.read_bytes()).digest():
   raise ValueError(f'{asset}: Downloads image changed; preserve the archived calibration reference')
  shutil.copyfile(image,saved)
  prev = ROOT/'research/kk-ema-2026-09-24'/f'{asset}-daily.json'
  if not prev.exists(): prev = ROOT/'research/kk-ema-2026-09-23'/f'{asset}-daily.json'
  if prev.exists(): rows = json.loads(prev.read_text())
  else: rows = [dict(zip(('time','open','high','low','close'),r)) for r in con.execute('SELECT time,open,high,low,close FROM market_candles WHERE asset=? AND source=? AND timeframe="1d" ORDER BY time',(asset,cfg['feed']))]
  assert rows,asset
  tail = fetch(asset,cfg['feed'],cfg['symbol'],rows[-1]['time']-2*DAY)
  current = next((r for r in tail if r['time']==SNAPSHOT),None)
  rows = archive_series(asset,rows+tail)
  provenance[asset] = dict(filename=filename,image=str(saved.relative_to(ROOT)),sha256=hashlib.sha256(saved.read_bytes()).hexdigest(),screenshotFileDate='2026-09-30',chartDate='2026-09-30',dateEvidence='File date, chart right edge, UTC clock, and provider current-candle OHLC comparison',screenClockUTC=cfg['clock'],venue=cfg['venue'],provider=cfg['feed'],symbol=cfg['symbol'],displayed=cfg['values'],digits=cfg['digits'],screenshotOHLC=cfg['ohlc'],providerCurrentCandle=current,baseHistory=str(prev.relative_to(ROOT)) if prev.exists() else 'local read-only SQLite',candles=len(rows),first=datetime.fromtimestamp(rows[0]['time']/1000,timezone.utc).date().isoformat(),last='2026-09-29')
  print(asset,len(rows),'current provider candle',current,flush=True)
 for asset,symbol in [('ray','RAYUSD'),('hype','HYPEUSD')]:
  rows = fetch(asset+'-kraken','kraken',symbol,0)
  archive_series(asset+'-kraken',rows)
  provenance[asset]['alternateFeed'] = dict(provider='kraken',symbol=symbol)
 # Preserve volumes to investigate synthetic no-trade days on thin Bitstamp JUP.
 start = 1704067200
 body = request('jup-full',f'https://www.bitstamp.net/api/v2/ohlc/jupusd/?step=86400&limit=1000&start={start}&end={(SNAPSHOT+DAY-1)//1000}')
 (HERE/'jup-full-raw.json').write_text(json.dumps(body['data']['ohlc']))
 (HERE/'provenance.json').write_text(json.dumps(dict(assets=provenance,requests=REQUESTS),indent=2))

if __name__=='__main__': main()
