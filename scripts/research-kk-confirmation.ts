/** Offline hypothesis only; deliberately not imported by the application. */
import fs from "node:fs";
import type {Candle} from "../lib/regimes.ts";
const root="research/kk-2026-09-21-archives";
type Row={asset:string;source:string;timeframe:string;target:number;state:string;pending?:number};
export function hypothesis(cs:Candle[],n:number,f:number,confirmation:number){
 let atr=0,level=0,state="bear",count=0;
 for(let i=0;i<cs.length;i++){
  const c=cs[i],prev=cs[i-1];
  const tr=prev?Math.max(c.high-c.low,Math.abs(c.high-prev.close),Math.abs(c.low-prev.close)):c.high-c.low;
  if(i<n){atr+=tr/n;if(i<n-1)continue;}else atr=(atr*(n-1)+tr)/n;
  const upper=(c.high+c.low)/2+f*atr,lower=(c.high+c.low)/2-f*atr;
  if(i===n-1){level=upper;continue;}
  level=state==="bear"?Math.min(level,upper):Math.max(level,lower);
  const crossed=state==="bear"?c.close>level:c.close<level;
  count=crossed?count+1:0;
  if(count>=confirmation){state=state==="bear"?"bull":"bear";level=state==="bear"?upper:lower;count=0;}
 }
 return {value:level,state,count};
}
const results=[];
for(const r of (JSON.parse(fs.readFileSync(root+"/results.json","utf8")) as Row[]).filter(r=>r.timeframe==="1d")){
 const cs:Candle[]=JSON.parse(fs.readFileSync(`${root}/${r.asset}-${r.source}${["gold","silver"].includes(r.asset)?"-futures":""}.json`,"utf8")).candles;
 const candidates=[];
 for(const n of [10,15])for(const f of [2,3]){const s=hypothesis(cs,n,f,5);candidates.push({n,f,...s,errorPct:100*(s.value/r.target-1)});}
 results.push({...r,candidates});
 console.log(r.asset,r.target,JSON.stringify(candidates));
}
fs.writeFileSync(root+"/confirmation-hypothesis.json",JSON.stringify(results,null,2)+"\n");
