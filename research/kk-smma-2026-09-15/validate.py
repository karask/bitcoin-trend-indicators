from calibrate import *
def ema(v,n):
 out=np.empty(len(v));out[0]=v[0]
 for i in range(1,len(v)):out[i]=out[i-1]+2*(v[i]-out[i-1])/(n+1)
 return out
live={'btc':[76842.01,79007.90,76388.72,78928.32],'eth':[2476.68,2536.34,2465.33,2528.78],'sol':[99.31,103.11,99,102.96]}
target={'btc':[75523.31,72767.38],'eth':[2362.63,2232.08],'sol':[96.54,91.03]}
allrows=[];result={}
for a in CONFIG:
 rows,dates,src,xc,yc,pixels=prepare(a)
 assert np.all(np.diff(dates)==1),(a,'daily gap')
 assert all(r['low']<=min(r['open'],r['close'])<=max(r['open'],r['close'])<=r['high'] for r in rows)
 lines={n:ema(src['close'],n) for n in range(32,59)}
 obs=np.load(ROOT/f'{a}-color-observations.npz')['obs'];idx=obs[:,0];truth=obs[:,1];allrows.append((a,dates,lines,idx,truth))
 pv=[float(ema(np.append(src['close'],live[a][-1]),n)[-1]) for n in [32,58]]
 default=[float(smma(np.append(src['hl2'],(live[a][1]+live[a][2])/2),n)[-1]) for n in [15,29]]
 boundaries={}
 for label,curves in [('EMA32/58',[lines[n] for n in [32,58]]),('SMMA15/29 HL2',[smma(src['hl2'],n) for n in [15,29]])]:
  errs=[]
  for j,v in enumerate(curves):
   pred=np.interp(pixels[:,1],dates,yc[0]*np.log(v)+yc[1]);errs.extend(abs(pred-pixels[:,2+j]).tolist())
  boundaries[label]={'medianPixelError':float(np.median(errs)),'meanPixelError':float(np.mean(errs))}
 result[a]={'source':'Binance USDT (proxy for CRYPTO:ETHUSD)' if a=='eth' else 'Binance USDT','dailyCount':len(rows),'through':datetime.fromtimestamp(rows[-1]['time']/1000,timezone.utc).isoformat(),'target':target[a],'emaPartial':pv,'emaCompleted':[float(lines[n][-1]) for n in [32,58]],'defaultPartial':default,'errorPct':[100*(v/t-1) for v,t in zip(pv,target[a])],'boundaries':boundaries}

def score(ns,part='all'):
 detail={}
 for a,dates,lines,idx,truth in allrows:
  diff=np.diff(np.array([lines[n] for n in ns]),axis=0);pred=np.where(np.all(diff<0,axis=0),1,np.where(np.all(diff>0,axis=0),-1,0))[idx]
  choose=dates[idx]<ts('2025-01-01')/DAY if part=='train' else dates[idx]>=ts('2025-01-01')/DAY if part=='test' else np.ones(len(idx),dtype=bool)
  p,t=pred[choose],truth[choose]
  detail[a]={'n':len(t),'accuracy':float(np.mean(p==t)),'balanced':float(np.mean([np.mean(p[t==s]==s) for s in [-1,0,1]]))}
 return {'meanBalanced':sum(v['balanced'] for v in detail.values())/3,'assets':detail}
ranking=[]
for n in range(33,57):
 for m in range(n+1,58):
  ns=[32,n,m,58];ranking.append({'lengths':ns,**score(ns,'train')})
ranking.sort(key=lambda v:v['meanBalanced'],reverse=True)
result['neutralRule']={'trainBefore':'2025-01-01','trainTop5':ranking[:5],'trainWinnerTest':score(ranking[0]['lengths'],'test'),'fullSampleCandidate32_34_48_58':score([32,34,48,58]),'candidate32_34_48_58_test':score([32,34,48,58],'test')}
(ROOT/'validation.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result,indent=2))
