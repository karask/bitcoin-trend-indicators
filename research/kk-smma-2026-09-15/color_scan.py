from calibrate import *
def ema(v,n):
 out=np.empty(len(v));out[0]=v[0]
 for i in range(1,len(v)):out[i]=out[i-1]+2*(v[i]-out[i-1])/(n+1)
 return out
ALL=[];DETAIL={}
for a in CONFIG:
 rows,dates,source,xc,yc,_=prepare(a)
 ar=np.array(Image.open('/home/kos/Downloads/'+CONFIG[a]['image']).convert('RGB')).astype(int)
 R,G,B=ar[:,:,0],ar[:,:,1],ar[:,:,2]
 masks=[(R>100)&(G>90)&(B<85)&(abs(R-G)<65),(B>100)&(B>1.5*R)&(B>2*G)&(R>40)&(G<90),(abs(R-G)<14)&(abs(B-G)<14)&(R>55)&(R<180)]
 lines={n:ema(source['close'],n) for n in range(3,100)}
 bounds=[yc[0]*np.log(lines[n])+yc[1] for n in [32,58]]
 obs=[]
 for i,t in enumerate(dates):
  x=int(round(xc[0]*t+xc[1]))
  if not 320<=x<2050 or i>=len(dates)-2:continue
  yy=[b[i] for b in bounds]
  lo=max(35,int(min(yy))-3);hi=min(835,int(max(yy))+4)
  if hi<=lo:continue
  counts=[int(m[lo:hi,x].sum()) for m in masks]
  if max(counts[:2])>=2:state=1 if counts[0]>counts[1] else -1
  elif counts[2]>=2:state=0
  else:continue
  obs.append((i,state,x))
 obs=np.array(obs);idx=obs[:,0];truth=obs[:,1]
 # treat both classes equally enough to avoid long trends overwhelming neutral windows
 def score(pred):
  pp=pred[idx];return {'accuracy':float(np.mean(pp==truth)),'balanced':float(np.mean([np.mean(pp[truth==s]==s) for s in [-1,0,1]])),'classAccuracy':{str(s):float(np.mean(pp[truth==s]==s)) for s in [-1,0,1]}}
 def stack(ns):
  dif=np.diff(np.array([lines[n] for n in ns]),axis=0)
  return np.where(np.all(dif<0,axis=0),1,np.where(np.all(dif>0,axis=0),-1,0))
 models={}; models['EMA32/58 crossover']=stack([32,58]);models['EMA32/38/50/58 stack']=stack([32,38,50,58])
 smmas=np.array([smma(source['hl2'],n) for n in [15,19,25,29]])
 dif=np.diff(smmas,axis=0);models['default SMMA15/19/25/29 HL2']=np.where(np.all(dif<0,axis=0),1,np.where(np.all(dif>0,axis=0),-1,0))
 for look in [1,2,3,5]:
  slope=lines[32]-np.roll(lines[32],look);base=stack([32,58]);models[f'32/58 + fast slope {look}']=np.where((base==1)&(slope>0),1,np.where((base==-1)&(slope<0),-1,0))
 candidates=[]
 for n in range(3,58):
  if n==32:continue
  ns=sorted([n,32,58]);pred=stack(ns);candidates.append({'lengths':ns,**score(pred)})
 for n in range(33,57):
  for m in range(n+1,58):
   pred=stack([32,n,m,58]);candidates.append({'lengths':[32,n,m,58],**score(pred)})
 detail={'count':len(obs),'classes':{str(s):int(sum(truth==s)) for s in [-1,0,1]},'models':{k:score(v) for k,v in models.items()},'best':sorted(candidates,key=lambda v:v['balanced'],reverse=True)[:12]}
 DETAIL[a]=detail;ALL.append((a,lines,idx,truth));np.savez(ROOT/f'{a}-color-observations.npz',obs=obs)
 print(a,json.dumps(detail))
shared=[]
for n in range(3,58):
 if n==32:continue
 for m in [None]+list(range(max(33,n+1),58)):
  ns=sorted(set([32,58,n]+([] if m is None else [m])))
  scores=[]
  for a,lines,idx,truth in ALL:
   dif=np.diff(np.array([lines[k] for k in ns]),axis=0);pred=np.where(np.all(dif<0,axis=0),1,np.where(np.all(dif>0,axis=0),-1,0))[idx]
   scores.append(float(np.mean([np.mean(pred[truth==s]==s) for s in [-1,0,1]])))
  shared.append({'lengths':ns,'balancedByAsset':scores,'meanBalanced':sum(scores)/3})
DETAIL['shared']=sorted(shared,key=lambda v:v['meanBalanced'],reverse=True)[:20]
print('shared',json.dumps(DETAIL['shared'][:10]))
(ROOT/'color-results.json').write_text(json.dumps(DETAIL,indent=2))
