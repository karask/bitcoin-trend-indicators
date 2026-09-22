"""Offline screenshot calibration. No production preset changes."""
import json,hashlib
from pathlib import Path
from datetime import datetime,timezone
import numpy as np
from PIL import Image
P=Path(__file__).resolve().parent;DAY=86400000

def day(s): return datetime.fromisoformat(s).replace(tzinfo=timezone.utc).timestamp()/86400
CONFIG={
 'btc':dict(cross=('2026-10-17',1532),last=1397,y=[(20,100000),(116,95000),(216,90000),(300,86000),(389,82000),(579,74000),(657,71000),(737,68000),(822,65000),(894,62500),(955,60500),(1017,58500),(1083,56500)],axis=1883,partial=[81160.33,85257,80837.42,84846.18]),
 'eth':dict(cross=('2026-10-27',1587),last=1436,y=[(20,4400),(110,4000),(210,3600),(320,3200),(382,3000),(448,2800),(518,2600),(594,2400),(676,2200),(742,2050),(819,1890),(881,1770),(948,1650),(1020,1530)],axis=1912,partial=[2644.67,2748.87,2641.76,2721.76]),
 'sol':dict(cross=('2025-10-20',342),last=1489,y=[(36,260),(149,220),(216,200),(288,180),(368,160),(459,140),(538,125),(607,113),(684,101),(756,91),(819,83),(888,75),(966,67),(1029,61)],axis=1935,partial=None),
 'zec':dict(cross=('2026-12-17',1573),last=1294,y=[(20,1800),(83,1400),(146,1100),(229,800),(303,600),(383,440),(450,340),(519,260),(585,200),(660,150),(739,110),(805,85),(874,65),(941,50),(1012,38),(1073,30)],axis=1911,partial=[1509.14,1572.35,1482.28,1562.28])}

def ema(v,n):
 out=np.empty(len(v));out[0]=v[0]
 for i in range(1,len(v)):out[i]=out[i-1]+2*(v[i]-out[i-1])/(n+1)
 return out

def setup(a, registered=True):
 cfg=CONFIG[a];img=Image.open('/home/kos/Downloads/'+a+'8.png').convert('RGB');img=img.resize((2048,round(img.height*2048/img.width)),Image.Resampling.LANCZOS);ar=np.array(img).astype(float)
 # Crosshair center is independent of the model. Last candle is Sep 21, established from exchange OHLC.
 crossdate,crossx=cfg['cross'];slope=(cfg['last']-crossx)/(day('2026-09-21')-day(crossdate));xc=np.array([slope,crossx-slope*day(crossdate)])
 # Axis label vertical centroids refine manually identified prices to subpixel accuracy.
 yobs=[]
 for y,price in cfg['y']:
  if (a=='zec' and price==150) or (a=='sol' and price==180):continue # obscured by cursor price label
  crop=ar[max(0,y-10):y+11,cfg['axis']+5:2030];ink=np.maximum(0,160-crop.mean(axis=2)).sum(axis=1)
  center=max(0,y-10)+np.dot(np.arange(len(ink)),ink)/sum(ink) if sum(ink)>0 else y
  yobs.append((center,price))
 yc=np.polyfit(np.log([p for y,p in yobs]),[y for y,p in yobs],1)
 if registered and (P/'registration.json').exists():
  reg=json.loads((P/'registration.json').read_text())[a];xc=np.array(reg['xcoef'])
 rows=[r for r in json.loads((P/f'{a}-daily.json').read_text()) if r['time']/DAY<=day('2026-09-21')]
 if cfg['partial']:
  rows[-1]=dict(zip(['time','open','high','low','close'],[day('2026-09-21')*DAY]+cfg['partial']))
 else:rows[-1]={**rows[-1],'close':116.77} # latest right-axis price; header is under the historical cursor
 dates=np.array([r['time']/DAY for r in rows]);src={k:np.array([r[k] for r in rows]) for k in ['open','high','low','close']};src['hl2']=(src['high']+src['low'])/2;src['hlc3']=(src['high']+src['low']+src['close'])/3;src['ohlc4']=(src['open']+src['high']+src['low']+src['close'])/4
 return cfg,img,ar,rows,dates,src,xc,yc,yobs

if __name__=='__main__':
 results={}
 for a in CONFIG:
  cfg,img,ar,rows,dates,src,xc,yc,yobs=setup(a);R,G,B=ar[:,:,0],ar[:,:,1],ar[:,:,2]
  # Band fill colors distinguish them from gold/navy candles and orange annotations.
  gold=(abs(R-251)<20)&(abs(G-253)<20)&(abs(B-109)<25)
  blue=(abs(R-203)<18)&(abs(G-194)<18)&(abs(B-243)<16)
  purpleStroke=(B>140)&(R<165)&(G<140)&(B>R+65)&(B>G+70)
  goldStroke=(R>100)&(R<235)&(G>90)&(G<225)&(B<140)&(abs(R-G)<60)&(R>B+40)&(G>B+40)
  grey=(abs(R-G)<13)&(abs(B-G)<15)&(R>120)&(R<215)
  lines={n:ema(src['close'],n) for n in range(15,85)}
  base=[yc[0]*np.log(lines[n])+yc[1] for n in [32,58]]
  obs=[];geometry=[]
  for x in range(30,cfg['last']-1):
   date=(x-xc[1])/xc[0]
   if date<dates[200]:continue
   yy=[np.interp(date,dates,b) for b in base];lo=max(165 if x<350 else 30,int(min(yy))-35);hi=min(1080,int(max(yy))+35)
   if hi<=lo:continue
   for st,mask in [(1,gold),(-1,blue)]:
    ys=np.where(mask[lo:hi,x])[0]+lo
    if len(ys)>=3 and ys[-1]-ys[0]>=3:
     # Fill edges approximately coincide with the boundary stroke center at this scale.
     stroke=goldStroke if st==1 else purpleStroke
     edges=[]
     for edge in [ys[0],ys[-1]]:
      near=np.arange(max(0,edge-5),min(ar.shape[0],edge+6));hit=near[stroke[near,x]]
      edges.append(float(np.median(hit)) if len(hit) else float(edge))
     fast,slow=edges if st==1 else edges[::-1];geometry.append([x,date,fast,slow,st]);break
  for i,t in enumerate(dates):
   x=int(round(xc[0]*t+xc[1]));yy=[b[i] for b in base]
   if x<30 or x>=cfg['last']-2 or t>=day('2026-09-21'):continue
   lo=max(165 if x<350 else 30,int(min(yy))-2);hi=min(1080,int(max(yy))+3)
   if hi<=lo:continue
   counts=[int(m[lo:hi,x].sum()) for m in [gold,blue,grey]]
   if max(counts[:2])>=2:st=1 if counts[0]>counts[1] else -1
   elif counts[2]>=3:st=0
   else:continue
   obs.append([i,st,x])
  geom=np.array(geometry);obs=np.array(obs);idx=obs[:,0];truth=obs[:,1]
  def score(ns):
   diff=np.diff(np.array([lines[n] for n in ns]),axis=0);pred=np.where(np.all(diff<0,axis=0),1,np.where(np.all(diff>0,axis=0),-1,0))[idx]
   return dict(accuracy=float(np.mean(pred==truth)),balanced=float(np.mean([np.mean(pred[truth==st]==st) for st in [-1,0,1]])),perClass={str(st):float(np.mean(pred[truth==st]==st)) for st in [-1,0,1]})
  candidates=[]
  for n in range(33,57):
   for m in range(n+1,58):candidates.append(dict(lengths=[32,n,m,58],**score([32,n,m,58])))
  boundary=[]
  for source,v in src.items():
   for n in range(20,76):
    pred=np.interp(geom[:,1],dates,yc[0]*np.log(ema(v,n))+yc[1])
    for edge in [0,1]:
     err=abs(pred-geom[:,2+edge]);boundary.append(dict(source=source,length=n,edge=edge,medianPx=float(np.median(err)),meanPx=float(np.mean(err))))
  result=dict(xcoef=xc.tolist(),ycoef=yc.tolist(),yResidualMax=float(max(abs(y-(yc[0]*np.log(p)+yc[1])) for y,p in yobs)),samples=len(obs),classes={str(st):int(sum(truth==st)) for st in [-1,0,1]},current=score([32,34,48,58]),bestColors=sorted(candidates,key=lambda r:r['balanced'],reverse=True)[:8],currentGeometry=[c for c in boundary if c['source']=='close' and (c['length'],c['edge']) in [(32,0),(58,1)]],bestGeometry={str(edge):sorted([c for c in boundary if c['edge']==edge],key=lambda r:r['meanPx'])[:5] for edge in [0,1]},calculatedPartial=[float(lines[n][-1]) for n in [32,58]])
  results[a]=result;np.savez(P/f'{a}-observations.npz',geometry=geom,colors=obs)
  print(a,json.dumps(result),flush=True)
 (P/'results.json').write_text(json.dumps(results,indent=2))
