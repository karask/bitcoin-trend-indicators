"""Compare screenshot ribbon values with close EMAs at snapshot or crosshair dates."""
import json
from datetime import datetime,timezone
from pathlib import Path
HERE=Path(__file__).resolve().parent
META=json.loads((HERE/'provenance.json').read_text())
DAY=86_400_000
SNAPSHOT=int(datetime(2026,9,24,tzinfo=timezone.utc).timestamp()*1000)
DIGITS={'eth':2,'sol':2,'ray':3,'doge':5,'hype':3,'zec':2,'link':3}

def ema(xs,n):
 v=xs[0];alpha=2/(n+1)
 for x in xs[1:]:v+=alpha*(x-v)
 return v

def source(row,name):
 if name=='hl2':return (row['high']+row['low'])/2
 if name=='hlc3':return (row['high']+row['low']+row['close'])/3
 if name=='ohlc4':return (row['open']+row['high']+row['low']+row['close'])/4
 return row[name]

def main():
 out={};rank={0:[],1:[]}
 for asset,meta in META.items():
  rows=json.loads((HERE/f'{asset}-daily.json').read_text())
  if meta['mode']=='partial':
   # This is the actual partial close transcribed from the screenshot header.
   o,h,l,c=meta['screenshotOHLC'];ref=dict(time=SNAPSHOT,open=o,high=h,low=l,close=c)
   calcrows=[r for r in rows if r['time']<SNAPSHOT]+[ref]
   date='2026-09-24'
  else:
   date=meta['crosshairDate'];end=int(datetime.fromisoformat(date).replace(tzinfo=timezone.utc).timestamp()*1000)
   calcrows=[r for r in rows if r['time']<=end]
   match=next((r for r in rows if r['time']==end),None)
   meta['feedCrosshairOHLC']=None if match is None else [match[k] for k in ('open','high','low','close')]
  assert calcrows and calcrows[-1]['time']==(SNAPSHOT if meta['mode']=='partial' else end),asset
  assert not any(b['time']-a['time']!=DAY for a,b in zip(calcrows,calcrows[1:])),f'{asset} date gap'
  targets=meta['displayed'];digits=DIGITS[asset];tick=10**-digits
  sources={}
  for name in ('close','open','high','low','hl2','hlc3','ohlc4'):
   vals=[source(r,name) for r in calcrows]
   pair=[ema(vals,n) for n in (32,58)]
   source_rank=[]
   for edge,target in enumerate(targets):
    nearest=sorted((dict(length=n,value=ema(vals,n),errorTicks=abs(ema(vals,n)-target)/tick) for n in range(20,76)),key=lambda z:z['errorTicks'])[:5]
    source_rank.append(nearest)
    rank[edge].append((asset,name,[(n,abs(ema(vals,n)-target)/target) for n in range(20,76)]))
   sources[name]=dict(pair=pair,errorTicks=[(x-y)/tick for x,y in zip(pair,targets)],nearest=source_rank)
  four=[ema([r['close'] for r in calcrows],n) for n in (32,34,48,58)]
  state='gold' if all(a>b for a,b in zip(four,four[1:])) else 'purple' if all(a<b for a,b in zip(four,four[1:])) else 'grey'
  out[asset]=dict(referenceDate=date,mode=meta['mode'],displayed=targets,screenshotOHLC=meta['screenshotOHLC'],feedOHLC=meta.get('feedCrosshairOHLC'),close32_58=sources['close']['pair'],roundingErrorTicks=sources['close']['errorTicks'],colorState=state,fourEma=four,sources=sources)
  print(asset,date,'close32/58',sources['close']['pair'],'ticks',sources['close']['errorTicks'],'state',state,'nearest',[[x['length'] for x in y[:3]] for y in sources['close']['nearest']],flush=True)
 # Independent second RAY venue check, using the same screenshot-time candle.
 kray=json.loads((HERE/'ray-kraken-daily.json').read_text())
 partial=META['ray']['screenshotOHLC']
 kray=[r for r in kray if r['time']<SNAPSHOT]+[dict(time=SNAPSHOT,open=partial[0],high=partial[1],low=partial[2],close=partial[3])]
 out['ray']['krakenProxy']={str(n):ema([r['close'] for r in kray],n) for n in (32,40,58)}
 pooled={}
 for edge,label in ((0,'fast'),(1,'slow')):
  results=[]
  for n in range(20,76):
   errors=[]
   for asset,name,vals in rank[edge]:
    if name=='close':errors.append(dict(vals)[n])
   results.append(dict(length=n,meanRelativeError=float(sum(errors)/len(errors))))
  pooled[label]=sorted(results,key=lambda z:z['meanRelativeError'])
 (HERE/'results.json').write_text(json.dumps(dict(assets=out,pooledLengthRanking=pooled),indent=2))
 # Update selected feed candle comparisons after computed dates.
 for a,m in META.items():
  if out[a]['feedOHLC'] is not None:m['feedCrosshairOHLC']=out[a]['feedOHLC']
 (HERE/'provenance.json').write_text(json.dumps(META,indent=2))
 print('fast ranking',[(x['length'],round(100*x['meanRelativeError'],6)) for x in pooled['fast'][:5]])
 print('slow ranking',[(x['length'],round(100*x['meanRelativeError'],6)) for x in pooled['slow'][:5]])

if __name__=='__main__':main()
