from calibrate import *
DATA=[];DETAIL={}
for a in CONFIG:
 cfg,img,ar,rows,dates,src,xc,yc,_=setup(a)
 assert np.all(np.diff(dates)==1),a
 assert all(r['low']<=min(r['open'],r['close'])<=max(r['open'],r['close'])<=r['high'] for r in rows),a
 obs=np.load(P/f'{a}-observations.npz')['colors'];idx=obs[:,0];truth=obs[:,1]
 lines={n:ema(src['close'],n) for n in range(32,59)}
 DATA.append(('new',a,lines,idx,truth))
 diff=np.diff(np.array([lines[n] for n in [32,34,48,58]]),axis=0);pred=np.where(np.all(diff<0,axis=0),1,np.where(np.all(diff>0,axis=0),-1,0))
 date=lambda i:datetime.fromtimestamp(rows[int(i)]['time']/1000,timezone.utc).date().isoformat()
 mismatches=[dict(date=date(i),observed=int(st),model=int(pred[i])) for i,st,x in obs if pred[i]!=st]
 # Image right edge has a colored boundary stroke, but no printed numeric values.
 x=int(round(xc[0]*dates[-1]+xc[1]));R,G,B=ar[:,:,0],ar[:,:,1],ar[:,:,2]
 stroke=(R>100)&(R<235)&(G>90)&(G<225)&(B<140)&(abs(R-G)<60)&(R>B+40)&(G>B+40)
 endpoints=[]
 for n in [32,58]:
  y=yc[0]*np.log(lines[n][-1])+yc[1];ys=np.arange(max(0,int(y)-8),min(ar.shape[0],int(y)+9));hits=ys[stroke[ys,min(x,cfg['last'])]]
  endpoints.append({'calculated':float(lines[n][-1]),'approxImageValue':float(np.exp((np.median(hits)-yc[1])/yc[0])) if len(hits) else None})
 DETAIL[a]=dict(range=[date(idx[0]),date(idx[-1])],samples=len(obs),mismatches=mismatches,latestState=int(pred[-1]),calculatedPartial=[float(lines[n][-1]) for n in [32,58]],imageEndpoints=endpoints,xLast=x)
old=P.parent/'kk-smma-2026-09-15'
for a in ['btc','eth','sol']:
 rows=json.loads((old/f'{a}-daily.json').read_text());lines={n:ema(np.array([r['close'] for r in rows]),n) for n in range(32,59)}
 obs=np.load(old/f'{a}-color-observations.npz')['obs'];DATA.append(('old',a,lines,obs[:,0],obs[:,1]))
def score(ns):
 out={}
 for batch,a,lines,idx,truth in DATA:
  diff=np.diff(np.array([lines[n] for n in ns]),axis=0);pred=np.where(np.all(diff<0,axis=0),1,np.where(np.all(diff>0,axis=0),-1,0))[idx]
  out[batch+'_'+a]={'accuracy':float(np.mean(pred==truth)),'balanced':float(np.mean([np.mean(pred[truth==st]==st) for st in [-1,0,1]]))}
 return dict(byAsset=out,newBalanced=float(np.mean([v['balanced'] for k,v in out.items() if k.startswith('new')])),oldBalanced=float(np.mean([v['balanced'] for k,v in out.items() if k.startswith('old')])))
rank=[]
for n in range(33,57):
 for m in range(n+1,58):rank.append(dict(lengths=[32,n,m,58],**score([32,n,m,58])))
rank.sort(key=lambda v:v['newBalanced'],reverse=True)
result=dict(current=score([32,34,48,58]),bestNew=rank[:8],details=DETAIL)
(P/'comparison.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
