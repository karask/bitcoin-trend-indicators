"""Archive the September 24 screenshot batch and continuous comparison feeds."""
import hashlib, json, shutil, sqlite3, time
from datetime import datetime, timezone
from pathlib import Path
import requests

ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
REFS=ROOT/'data/kk-research-2026-09-24/references'
REFS.mkdir(parents=True,exist_ok=True)
DAY=86_400_000
SNAPSHOT=int(datetime(2026,9,24,tzinfo=timezone.utc).timestamp()*1000)
# file, feed, provider symbol, selected date, printed 32/58, screenshot OHLC, screen clock UTC
CONFIG={
 'eth':dict(file='image.png',feed='binance-spot',symbol='ETHUSDT',mode='partial',values=[2481.69,2342.95],ohlc=[2684.70,2704.08,2600.15,2640.75],clock='10:39:44'),
 'sol':dict(file='image(1).png',feed='coinbase-proxy',symbol='SOL-USD',mode='partial',values=[103.15,96.63],ohlc=[114.99,116.08,112.55,113.12],clock='10:40:07'),
 'ray':dict(file='image(2).png',feed='binance-proxy',symbol='RAYUSDT',mode='partial',values=[1.343,1.263],ohlc=[1.977,2.163,1.972,1.992],clock='10:40:42'),
 'doge':dict(file='image(3).png',feed='coinbase',symbol='DOGE-USD',mode='partial',values=[0.08629,0.08374],ohlc=[0.09271,0.09516,0.09138,0.09235],clock='10:40:58'),
 'hype':dict(file='image(4).png',feed='hyperliquid',symbol='HYPE',mode='historical',date='2025-12-04',values=[36.420,38.591],ohlc=[34.690,36.179,33.098,33.548],clock='10:41:42'),
 'zec':dict(file='image(5).png',feed='binance-proxy',symbol='ZECUSDT',mode='historical',date='2025-09-20',values=[46.21,44.26],ohlc=[48.97,51.19,48.53,50.66],clock='10:42:19'),
 'link':dict(file='image(6).png',feed='binance-spot',symbol='LINKUSDT',mode='partial',values=[11.630,10.928],ohlc=[12.356,12.498,12.094,12.179],clock='10:43:00'),
}

def get(url):
 r=requests.get(url,timeout=35);r.raise_for_status();return r.json()

def binance(symbol,start):
 rows=[];urls=[]
 while start<SNAPSHOT:
  url=f'https://data-api.binance.vision/api/v3/klines?symbol={symbol}&interval=1d&startTime={start}&endTime={SNAPSHOT-1}&limit=1000'
  batch=get(url);urls.append(url)
  if not batch:break
  rows.extend(dict(time=int(x[0]),open=float(x[1]),high=float(x[2]),low=float(x[3]),close=float(x[4])) for x in batch)
  start=int(batch[-1][0])+DAY
  if len(batch)<1000:break
  time.sleep(.2)
 return rows,urls

def coinbase(symbol,start):
 rows=[];urls=[]
 while start<SNAPSHOT:
  end=min(start+250*DAY,SNAPSHOT)
  a=datetime.fromtimestamp(start/1000,timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
  b=datetime.fromtimestamp(end/1000,timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
  url=f'https://api.exchange.coinbase.com/products/{symbol}/candles?granularity=86400&start={a}&end={b}'
  batch=get(url);urls.append(url)
  rows.extend(dict(time=int(x[0])*1000,low=float(x[1]),high=float(x[2]),open=float(x[3]),close=float(x[4])) for x in batch)
  start=end;time.sleep(.2)
 return rows,urls

def hyperliquid(symbol,start):
 url='https://api.hyperliquid.xyz/info'
 body={'type':'candleSnapshot','req':{'coin':symbol,'interval':'1d','startTime':start,'endTime':SNAPSHOT-1}}
 r=requests.post(url,json=body,timeout=35);r.raise_for_status();batch=r.json()
 rows=[dict(time=int(x['t']),open=float(x['o']),high=float(x['h']),low=float(x['l']),close=float(x['c'])) for x in batch]
 return rows,[{'url':url,'request':body}]

def kraken_ray():
 url='https://api.kraken.com/0/public/OHLC?pair=RAYUSD&interval=1440'
 body=get(url);series=next(v for k,v in body['result'].items() if k!='last')
 rows=[dict(time=int(x[0])*1000,open=float(x[1]),high=float(x[2]),low=float(x[3]),close=float(x[4])) for x in series if int(x[0])*1000<SNAPSHOT]
 return rows,url

def main():
 prev=ROOT/'research/kk-ema-2026-09-23'
 con=sqlite3.connect(f'file:{ROOT / "data/bitcoin-regime.sqlite"}?mode=ro',uri=True)
 provenance={}
 for asset,cfg in CONFIG.items():
  image=Path('/home/kos/Downloads')/cfg['file'];saved=REFS/f'{asset}.png';shutil.copyfile(image,saved)
  if asset in ('eth','sol','ray','doge'):
   rows=json.loads((prev/f'{asset}-daily.json').read_text())
   start=rows[-1]['time']+DAY
   tail,urls=(binance(cfg['symbol'],start) if cfg['feed'].startswith('binance') else coinbase(cfg['symbol'],start))
   rows+=tail
  elif asset=='hype':
   # Hyperliquid daily history begins before the screenshot's Dec 2025 crosshair.
   rows,urls=hyperliquid('HYPE',int(datetime(2024,11,29,tzinfo=timezone.utc).timestamp()*1000))
  else:
   source='binance'
   rows=[dict(zip(('time','open','high','low','close'),r)) for r in con.execute('SELECT time,open,high,low,close FROM market_candles WHERE asset=? AND source=? AND timeframe="1d" ORDER BY time',(asset,source))]
   tail,urls=binance(cfg['symbol'],rows[-1]['time']+DAY);rows+=tail
  rows=sorted({r['time']:r for r in rows if r['time']<SNAPSHOT}.values(),key=lambda r:r['time'])
  (HERE/f'{asset}-daily.json').write_text(json.dumps(rows))
  m=dict(image=str(saved.relative_to(ROOT)),sha256=hashlib.sha256(saved.read_bytes()).hexdigest(),fileDate='2026-09-24',screenClockUTC=cfg['clock'],chartLatestCandleDate='2026-09-24',feed=cfg['feed'],symbol=cfg['symbol'],mode=cfg['mode'],displayed=cfg['values'],screenshotOHLC=cfg['ohlc'],urls=urls,candles=len(rows),first=datetime.fromtimestamp(rows[0]['time']/1000,timezone.utc).date().isoformat(),last=datetime.fromtimestamp(rows[-1]['time']/1000,timezone.utc).date().isoformat())
  if cfg['mode']=='historical':m['crosshairDate']=cfg['date']
  provenance[asset]=m;print(asset,len(rows),m['first'],m['last'],flush=True)
 ray_rows,ray_url=kraken_ray()
 (HERE/'ray-kraken-daily.json').write_text(json.dumps(ray_rows))
 provenance['ray']['alternateFeed']={'provider':'kraken','symbol':'RAY/USD','url':ray_url,'candles':len(ray_rows),'first':datetime.fromtimestamp(ray_rows[0]['time']/1000,timezone.utc).date().isoformat(),'last':datetime.fromtimestamp(ray_rows[-1]['time']/1000,timezone.utc).date().isoformat()}
 (HERE/'provenance.json').write_text(json.dumps(provenance,indent=2))

if __name__=='__main__':main()
