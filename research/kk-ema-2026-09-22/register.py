"""Refine chart coordinate mapping against candle wicks, not indicator curves."""
from calibrate import *
result={}
for a in CONFIG:
 cfg,img,ar,rows,dates,src,xc,yc,_=setup(a, registered=False);R,G,B=ar[:,:,0],ar[:,:,1],ar[:,:,2]
 mask=(R<125)&(G<145)&(B>R+13)&(B>G+8)&(B<190)
 # Crosshair position from dark dashed pixels in otherwise blank future space.
 crossdate,cx=cfg['cross'];crop=ar[180:600,cx-4:cx+5,:];w=np.maximum(0,120-crop.mean(axis=2)).sum(axis=0);cx=cx-4+np.dot(np.arange(9),w)/sum(w)
 good=(dates<day('2026-09-21'))&(xc[0]*dates+xc[1]>150)&(xc[0]*dates+xc[1]<cfg['last']-30)
 dd=np.repeat(dates[good],2);yy=(yc[0]*np.log(np.stack([src['high'][good],src['low'][good]],axis=1))+yc[1]).ravel()
 good=(yy>185)&(yy<1060);dd=dd[good];yy=yy[good]
 offsets=[(dx,dy,dx*dx+dy*dy) for dx in range(-4,5) for dy in range(-4,5)]
 best=None
 for slope in np.linspace(xc[0]*.99,xc[0]*1.01,81):
  xx=np.rint(cx+slope*(dd-day(crossdate))).astype(int)
  for yshift in [-1,0,1]:
   yp=np.rint(yy+yshift).astype(int);dist=np.full(len(xx),40.)
   for dx,dy,d in offsets:
    hit=mask[yp+dy,xx+dx];dist=np.where(hit,np.minimum(dist,d),dist)
   score=float(np.mean(np.minimum(dist,16)))
   if best is None or score<best['score']:best=dict(score=score,xcoef=[float(slope),float(cx-slope*day(crossdate))],yShift=yshift,candleEndpoints=len(dd))
 result[a]=best;print(a,best)
(P/'registration.json').write_text(json.dumps(result,indent=2))
