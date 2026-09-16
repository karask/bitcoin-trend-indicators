import sqlite3,json,datetime
from pathlib import Path
p=Path('research/kk-smma-2026-09-15')
c=sqlite3.connect('file:data/bitcoin-regime.sqlite?mode=ro',uri=True);c.row_factory=sqlite3.Row
cut=int(datetime.datetime(2026,9,14,tzinfo=datetime.timezone.utc).timestamp()*1000)
targets={'btc':[75523.31,72767.38],'eth':[2362.63,2232.08],'sol':[96.54,91.03]}
live={'btc':[76842.01,79007.90,76388.72,78928.32],'eth':[2476.68,2536.34,2465.33,2528.78],'sol':[99.31,103.11,99,102.96]}
for a in targets:
 d={r['time']:dict(r) for r in c.execute("SELECT time,open,high,low,close FROM market_candles WHERE asset=? AND source='binance' AND timeframe='1d' ORDER BY time",[a])}
 for r in json.load(open(p/f'{a}-binance-tail.json')):d[r[0]]=dict(zip(['time','open','high','low','close'],[r[0]]+list(map(float,r[1:5]))))
 rows=[d[t] for t in sorted(d) if t<cut]
 (p/f'{a}-daily.json').write_text(json.dumps(rows))
 for mode,rr in [('completed',rows),('partial',rows+[dict(zip(['time','open','high','low','close'],[cut]+live[a]))])]:
  out=[]
  for src in ['hl2','close','ohlc4','hlc3']:
   v=[(r['high']+r['low'])/2 if src=='hl2' else (r['high']+r['low']+r['close'])/3 if src=='hlc3' else sum(r[k] for k in ['open','high','low','close'])/4 if src=='ohlc4' else r['close'] for r in rr]
   vals={}
   for n in range(2,121):
    s=sum(v[:n])/n
    for x in v[n:]:s+=(x-s)/n
    vals[n]=s
   best=[min(vals,key=lambda n:abs(vals[n]/t-1)) for t in targets[a]]
   out.append({'source':src,'best':best,'values':[round(vals[n],5) for n in best],'errorsPct':[round(100*(vals[n]/t-1),5) for n,t in zip(best,targets[a])],'default15_29':[round(vals[n],5) for n in [15,29]]})
  print(a,mode,json.dumps(out))
