"""Research only: calibrate ordinary SMMAs against screenshot band pixels."""
import json, math
from pathlib import Path
from datetime import datetime,timezone
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parent
DAY=86400000
def ts(s):return datetime.fromisoformat(s).replace(tzinfo=timezone.utc).timestamp()*1000
CONFIG={
 'btc':{'image':'image.png','x': [('2024-01-01',540),('2025-01-01',1102.6),('2026-01-01',1662.8)],'y':[(96,133000),(130,121000),(154,113000),(181,105000),(210,97000),(238,89500),(270,82000),(359,64000),(421,54000),(448,50000),(529,40000),(587,34000),(644,29000),(698,25000),(754,21400)]},
 'eth':{'image':'image(1).png','x':[('2021-01-01',181),('2023-01-01',843),('2024-01-01',1174.2),('2025-01-01',1505.4),('2026-01-01',1836.6)],'y':[(95,5400),(122,4800),(153,4200),(189,3600),(216,3200),(246,2800),(336,1900),(362,1700),(417,1340),(446,1180),(524,840),(554,740),(580,660),(610,580),(635,520),(663,460),(690,410),(720,360),(747,320),(771,288)]},
 'sol':{'image':'image(2).png','x':[('2023-01-01',469),('2024-01-01',896),('2025-01-01',1324.7),('2026-01-01',1752.6)],'y':[(68,380),(100,320),(125,280),(154,240),(178,210),(207,180),(241,150),(268,130),(292,114),(401,63.5),(455,47.5),(480,41.5),(510,35.5),(538,30.5),(564,26.5),(621,19.5),(676,14.5),(703,12.5),(736,10.5),(789,7.9)]}
}
def smma(v,n):
 out=np.full(len(v),np.nan);out[n-1]=np.mean(v[:n])
 for i in range(n,len(v)):out[i]=out[i-1]+(v[i]-out[i-1])/n
 return out

def prepare(a):
 cfg=CONFIG[a]; rows=json.loads((ROOT/f'{a}-daily.json').read_text()); dates=np.array([r['time']/DAY for r in rows])
 source={k:np.array([r[k] for r in rows]) for k in ['open','high','low','close']}
 source['hl2']=(source['high']+source['low'])/2
 source['hlc3']=(source['high']+source['low']+source['close'])/3
 source['ohlc4']=(source['high']+source['low']+source['close']+source['open'])/4
 source['hlcc4']=(source['high']+source['low']+2*source['close'])/4
 xcoef=np.polyfit([ts(d)/DAY for d,x in cfg['x']],[x for d,x in cfg['x']],1)
 ycoef=np.polyfit(np.log([p for y,p in cfg['y']]),[y for y,p in cfg['y']],1)
 ar=np.array(Image.open('/home/kos/Downloads/'+cfg['image']).convert('RGB')).astype(int)
 R,G,B=ar[:,:,0],ar[:,:,1],ar[:,:,2]
 gold=(R>100)&(G>90)&(B<85)&(abs(R-G)<65)
 blue=(B>100)&(B>1.5*R)&(B>2*G)&(R>40)&(G<90)
 # Band near baseline; removes unrelated volume, annotations and legend pixels.
 baseline=[ycoef[0]*np.log(smma(source['hl2'],n))+ycoef[1] for n in [15,29]]
 samples=[]
 for x in range(320,2051):
  date=(x-xcoef[1])/xcoef[0]
  if date>dates[-1]-2 or date<dates[100]:continue
  yy=[np.interp(date,dates,b) for b in baseline]
  lo=max(35,int(min(yy)-35));hi=min(835,int(max(yy)+35))
  if hi<=lo:continue
  for state,mask in [(1,gold),(-1,blue)]:
   ys=np.where(mask[lo:hi,x])[0]+lo
   if len(ys)>=3 and ys[-1]-ys[0]>=3:
    # gold filled, purple outlined; their endpoints need independent raster allowance
    fast,slow=(ys[0],ys[-1]) if state==1 else (ys[-1],ys[0])
    samples.append([x,date,float(fast),float(slow),state]);break
 samples=np.array(samples)
 return rows,dates,source,xcoef,ycoef,samples

if __name__=='__main__':
 results={}
 for a in CONFIG:
  rows,dates,source,xc,yc,obs=prepare(a)
  candidates=[]
  for src,v in source.items():
   for n in range(5,71):
    curve=yc[0]*np.log(smma(v,n))+yc[1]
    pred=np.interp(obs[:,1],dates,curve)
    for edge in [0,1]:
     err=pred-obs[:,2+edge]
     # median absolute pixel error robust to candle overlap/annotations
     candidates.append(dict(source=src,length=n,edge=['fast','slow'][edge],medianPx=float(np.median(abs(err))),meanPx=float(np.mean(abs(err))),biasPx=float(np.median(err))))
  best={edge:sorted([c for c in candidates if c['edge']==edge],key=lambda c:c['meanPx'])[:12] for edge in ['fast','slow']}
  defaults=[c for c in candidates if c['source']=='hl2' and (c['edge'],c['length']) in [('fast',15),('slow',29)]]
  results[a]={'samples':len(obs),'xcoef':xc.tolist(),'ycoef':yc.tolist(),'best':best,'defaults':defaults}
  np.savez(ROOT/f'{a}-pixels.npz',observed=obs)
  print(a,json.dumps(results[a]))
 (ROOT/'pixel-results.json').write_text(json.dumps(results,indent=2))
