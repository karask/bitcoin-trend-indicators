"""Compare the eleven captured daily snapshots with EMA lengths and sources."""
import json
from datetime import datetime, timezone
from pathlib import Path
HERE = Path(__file__).resolve().parent
DAY = 86_400_000
SNAPSHOT = int(datetime(2026,9,30,tzinfo=timezone.utc).timestamp()*1000)
ACCEPTABLE_ERROR_PERCENT = 0.2

def ema(values, length):
 value = values[0]
 alpha = 2/(length+1)
 for x in values[1:]: value += alpha*(x-value)
 return value

def source(row, name):
 if name == 'hl2': return (row['high']+row['low'])/2
 if name == 'hlc3': return (row['high']+row['low']+row['close'])/3
 if name == 'ohlc4': return sum(row[k] for k in ('open','high','low','close'))/4
 return row[name]

def main():
 meta = json.loads((HERE/'provenance.json').read_text())['assets']
 results = {}
 for asset, cfg in meta.items():
  rows = json.loads((HERE/f'{asset}-daily.json').read_text())
  assert rows[-1]['time']==SNAPSHOT-DAY, asset
  assert all(b['time']-a['time']==DAY for a,b in zip(rows,rows[1:])), asset
  calendar_rows = list(rows)
  no_trade_count = 0
  if asset == 'jup':
   raw = json.loads((HERE/'jup-full-raw.json').read_text())
   # This input choice reproduces TradingView's printed values; production
   # uses Kraken JUP, so this does not introduce a global candle filter.
   zero_times = {int(r['timestamp'])*1000 for r in raw if float(r['volume'])==0 and len({r[k] for k in ('open','high','low','close')})==1}
   rows = [r for r in rows if r['time'] not in zero_times]
   no_trade_count = len(calendar_rows)-len(rows)
   (HERE/'jup-traded-daily.json').write_text(json.dumps(rows))
  o,h,l,c = cfg['screenshotOHLC']
  rows += [dict(time=SNAPSHOT,open=o,high=h,low=l,close=c)]
  targets = cfg['displayed']; tick = 10**-cfg['digits']
  candidates = {}
  for name in ('close','open','high','low','hl2','hlc3','ohlc4'):
   values = [source(r,name) for r in rows]
   calculated = {n:ema(values,n) for n in range(15,101)}
   pair = [calculated[n] for n in (32,58)]
   candidates[name] = dict(pair=pair, errors=[x-y for x,y in zip(pair,targets)], nearest=[sorted([dict(length=n,value=v,errorTicks=abs(v-target)/tick) for n,v in calculated.items()],key=lambda r:r['errorTicks'])[:5] for target in targets])
  pair = candidates['close']['pair']
  four = [ema([r['close'] for r in rows],n) for n in (32,34,48,58)]
  state = 'gold' if all(a>b for a,b in zip(four,four[1:])) else 'purple' if all(a<b for a,b in zip(four,four[1:])) else 'grey'
  result = dict(displayed=targets,calculated32_58=pair,errorTicks=[(v-t)/tick for v,t in zip(pair,targets)],errorPercent=[100*(v-t)/t for v,t in zip(pair,targets)],roundsExactly=[round(v,cfg['digits'])==t for v,t in zip(pair,targets)],fourEma=four,modelColor=state,screenshotColor='gold',lengthAndSourceCandidates=candidates)
  result['withinAcceptedTolerance'] = all(abs(e)<=ACCEPTABLE_ERROR_PERCENT for e in result['errorPercent'])
  if asset == 'jup':
   result['bitstampNoTradeHandling'] = dict(omittedFlatZeroVolumeDays=no_trade_count,calendarDay32_58=[ema([r['close'] for r in calendar_rows]+[c],n) for n in (32,58)],interpretation='Omitting flat zero-volume Bitstamp days matches the screenshot; this suggests TradingView excludes those synthetic bars. Production JUP uses Kraken.')
   historical_end = int(datetime(2025,5,27,tzinfo=timezone.utc).timestamp()*1000)
   result['bitstampNoTradeHandling']['earlierReference'] = dict(date='2025-05-27',displayed=[.515302,.512712],calculated32_58=[ema([r['close'] for r in rows if r['time']<=historical_end],n) for n in (32,58)])
  if 'alternateFeed' in cfg:
   alt = json.loads((HERE/f'{asset}-kraken-daily.json').read_text())+[rows[-1]]
   result['krakenProxy'] = {str(n):ema([r['close'] for r in alt],n) for n in (32,40,58)}
  results[asset] = result
  print(asset,'pair',pair,'errors %',result['errorPercent'],'exact',result['roundsExactly'],'nearest',[[x['length'] for x in side[:3]] for side in candidates['close']['nearest']],state,flush=True)
 pooled = {}
 for edge,label in enumerate(('fast','slow')):
  scores = []
  for n in range(15,101):
   errors = []
   for asset,cfg in meta.items():
    file = 'jup-traded-daily.json' if asset=='jup' else f'{asset}-daily.json'
    rows = json.loads((HERE/file).read_text())
    values = [r['close'] for r in rows]+[cfg['screenshotOHLC'][3]]
    errors.append(abs(ema(values,n)-cfg['displayed'][edge])/cfg['displayed'][edge])
   scores.append(dict(length=n,meanAbsoluteRelativeError=sum(errors)/len(errors)))
  pooled[label] = sorted(scores,key=lambda r:r['meanAbsoluteRelativeError'])
 source_scores = {name:sum(abs(v-t)/t*100 for x in results.values() for v,t in zip(x['lengthAndSourceCandidates'][name]['pair'],x['displayed']))/(2*len(results)) for name in ('close','open','high','low','hl2','hlc3','ohlc4')}
 summary = dict(acceptedTolerancePercent=ACCEPTABLE_ERROR_PERCENT,assetsWithinTolerance=sum(x['withinAcceptedTolerance'] for x in results.values()),assetsWithBothBoundariesRoundingExactly=sum(all(x['roundsExactly']) for x in results.values()),maximumAbsoluteErrorPercent=max(abs(e) for x in results.values() for e in x['errorPercent']),sourceMeanAbsoluteErrorPercent=source_scores)
 (HERE/'results.json').write_text(json.dumps(dict(snapshotDate='2026-09-30',summary=summary,assets=results,pooledLengthRanking=pooled),indent=2))
 print('pooled', {k:v[:3] for k,v in pooled.items()})

if __name__=='__main__': main()
