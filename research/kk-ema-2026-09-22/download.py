import json,sqlite3,time,requests
from pathlib import Path
from datetime import datetime,timezone
P=Path(__file__).resolve().parent
reqs={'btc':'https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400&start=2026-08-20T00:00:00Z&end=2026-09-23T00:00:00Z','eth':'https://api.kraken.com/0/public/OHLC?pair=ETHUSD&interval=1440','sol':'https://data-api.binance.vision/api/v3/klines?symbol=SOLUSDT&interval=1d&limit=1000','zec':'https://data-api.binance.vision/api/v3/klines?symbol=ZECUSDT&interval=1d&limit=1000'}
c=sqlite3.connect('file:data/bitcoin-regime.sqlite?mode=ro',uri=True);c.row_factory=sqlite3.Row
for a,url in reqs.items():
 r=requests.get(url,timeout=30);r.raise_for_status();body=r.json();(P/f'{a}-raw.json').write_text(json.dumps({'retrievedAt':datetime.now(timezone.utc).isoformat(),'url':url,'body':body}))
 if a=='btc':
  rows=[dict(r) for r in c.execute("SELECT time,open,high,low,close FROM market_candles WHERE asset='btc' AND source='coinbase' AND timeframe='1d' ORDER BY time")]
  tail=[dict(time=r[0]*1000,low=r[1],high=r[2],open=r[3],close=r[4]) for r in body]
 elif a=='eth':
  assert not body['error'],body['error']
  rr=next(v for k,v in body['result'].items() if k!='last');rows=[]
  tail=[dict(time=int(r[0])*1000,open=float(r[1]),high=float(r[2]),low=float(r[3]),close=float(r[4])) for r in rr]
 else:
  rows=[];tail=[dict(time=r[0],open=float(r[1]),high=float(r[2]),low=float(r[3]),close=float(r[4])) for r in body]
 d={r['time']:r for r in rows+tail};rows=[d[t] for t in sorted(d)]
 (P/f'{a}-daily.json').write_text(json.dumps(rows));print(a,len(rows),datetime.fromtimestamp(rows[-1]['time']/1000,timezone.utc).isoformat(),flush=True)
 time.sleep(1.3)
