from calibrate import *
def ema(v,n):
 out=np.empty(len(v));out[0]=v[0]
 for i in range(1,len(v)):out[i]=out[i-1]+2*(v[i]-out[i-1])/(n+1)
 return out
out={};allobs=[]
for a in CONFIG:
 rows,dates,s,xc,yc,_=prepare(a);obs=np.load(ROOT/f'{a}-color-observations.npz')['obs'];idx=obs[:,0];truth=obs[:,1];fast=ema(s['close'],32);slow=ema(s['close'],58);diff=fast-slow
 tr=np.maximum(s['high']-s['low'],np.maximum(abs(s['high']-np.roll(s['close'],1)),abs(s['low']-np.roll(s['close'],1))));atr=smma(tr,14)
 candidates=[]
 for kind,norm in [('price-percent',s['close']/100),('atr14',atr)]:
  for threshold in np.arange(0,3.01,.025) if kind=='price-percent' else np.arange(0,1.01,.01):
   pred=np.where(diff>threshold*norm,1,np.where(diff< -threshold*norm,-1,0))[idx];acc=np.mean(pred==truth);bal=np.mean([np.mean(pred[truth==st]==st) for st in [-1,0,1]])
   candidates.append({'kind':kind,'threshold':float(threshold),'accuracy':float(acc),'balanced':float(bal)})
 best=sorted(candidates,key=lambda r:r['balanced'],reverse=True)[:5]
 spread={str(st):np.quantile(abs(diff[idx][truth==st])/slow[idx][truth==st]*100,[.1,.5,.9]).tolist() for st in [-1,0,1]}
 out[a]={'best':best,'spreadPercentQuantiles':spread};print(a,out[a])
 allobs.append((a,diff,slow,atr,idx,truth))
(ROOT/'neutral-results.json').write_text(json.dumps(out,indent=2))
