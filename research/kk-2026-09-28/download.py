"""Archive public provider responses for the September 28 YouTube references."""
import json,time
from datetime import datetime,timezone
from pathlib import Path
import requests
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'data/kk-research-2026-09-28-video/providers'
OUT.mkdir(parents=True,exist_ok=True)
END=int(datetime(2026,9,28,tzinfo=timezone.utc).timestamp())
START=int(datetime(1999,1,4,tzinfo=timezone.utc).timestamp())
s=requests.Session();s.headers['User-Agent']='Regime-Lab/1.0 personal research'
provenance_file=OUT/'provenance.json'
provenance=json.loads(provenance_file.read_text()) if provenance_file.exists() else {}
def get(url):
 r=s.get(url,timeout=45);r.raise_for_status();time.sleep(.4);return r.json()
for sym in ['VVV','QNT']:
 url=f'https://api.exchange.coinbase.com/products/{sym}-USD'
 body=get(url);(OUT/f'{sym.lower()}-product.json').write_text(json.dumps(body));print(sym,body,flush=True)
for sym in ['SNDK','MU','NVDA','GOOGL','TSLA','SPCX','CRCL','INTC','MRVL','AMD','AMZN','META','BOT','STRC','PLTR']:
 url=f'https://query1.finance.yahoo.com/v8/finance/chart/{sym}?period1={START}&period2={END}&interval=1d&events=splits'
 file=OUT/f'{sym.lower()}-yahoo-raw.json'
 if file.exists():
  body=json.loads(file.read_text());retrieved=provenance.get(sym.lower(),{}).get('retrievedAt',datetime.fromtimestamp(file.stat().st_mtime,timezone.utc).isoformat())
 else:
  body=get(url);file.write_text(json.dumps(body));retrieved=datetime.now(timezone.utc).isoformat()
 data=body['chart']['result'][0];meta=data['meta'];timestamps=data.get('timestamp',[])
 provenance[sym.lower()]={'url':url,'retrievedAt':retrieved,'rawFile':str(file.relative_to(ROOT)),'meta':{k:meta.get(k) for k in ['symbol','shortName','longName','exchangeName','fullExchangeName','firstTradeDate','regularMarketPrice']},'bars':len(timestamps)}
 print(sym,provenance[sym.lower()]['meta'],'bars',len(timestamps),'first',datetime.fromtimestamp(timestamps[0],timezone.utc).isoformat() if timestamps else None,flush=True)
(OUT/'provenance.json').write_text(json.dumps(provenance,indent=2))
for sym in ['VVV','QNT']:
 file=OUT/f'{sym.lower()}-coinbase-raw.json'
 if file.exists():continue
 found={};urls=[];end=END
 for page in range(15):
  start=end-299*86400
  a=datetime.fromtimestamp(start,timezone.utc).isoformat();b=datetime.fromtimestamp(end,timezone.utc).isoformat()
  url=f'https://api.exchange.coinbase.com/products/{sym}-USD/candles?granularity=86400&start={a}&end={b}'
  batch=get(url);urls.append(url)
  if not batch:break
  for r in batch:
   if r[0]<END:found[r[0]]=r
  next_end=min(r[0] for r in batch)-86400
  if next_end>=end:raise ValueError('Pagination did not advance')
  end=next_end
  if len(batch)<250:break
 rows=[found[k] for k in sorted(found)]
 file.write_text(json.dumps({'urls':urls,'retrievedAt':datetime.now(timezone.utc).isoformat(),'rows':rows}))
 print(sym,'Coinbase days',len(rows),'first',datetime.fromtimestamp(rows[0][0],timezone.utc).isoformat(),flush=True)
