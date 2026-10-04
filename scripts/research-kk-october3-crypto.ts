/** Fixed-date daily KK research; --fetch downloads only missing provider tails. */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { providerJson } from "../lib/provider-http.ts";
import { ASSETS, marketDefinition, type AssetId, type SourceId } from "../lib/markets.ts";
import { validateCandles } from "../lib/market-data.ts";
import { calculateIndicators, type Candle } from "../lib/regimes.ts";

const root = "research/kk-2026-10-03/crypto";
const rawRoot = "data/kk-research-2026-10-03/crypto";
const day = 86_400_000;
const cutoff = Date.UTC(2026, 9, 3); // Last completed UTC daily candle at screenshot: October 2.
const diagnosticCutoff = cutoff + day; // October 3 eventual close: diagnostic only, unavailable at capture.
const previous = {
  btc:[15,2],eth:[15,4],sol:[15,2],doge:[15,5],link:[15,4],xmr:[15,3],sui:[10,3],jup:[15,3],op:[10,3],bonk:[15,3],
  ada:[15,5],atom:[15,5],hype:[15,4],dot:[15,5],bnb:[15,4],zec:[15,3],avax:[10,3],ray:[10,3],vvv:[10,3],qnt:[50,4],
} satisfies Record<AssetId, number[]>;
const targets = {
  btc:80775.05,eth:2369.63,sol:101.15,doge:.079837,link:null,xmr:455.70,sui:1.0447,jup:.2872,op:.11580,bonk:.22517e-5,
  ada:.20226,atom:1.4589,hype:75.900,dot:.9550,bnb:704.06,zec:1251.54,avax:9.777,ray:1.6165,vvv:22.464,qnt:227.68,
} satisfies Record<AssetId, number|null>;
const sha = (value:string) => createHash("sha256").update(value).digest("hex");
const date = (time:number|null|undefined) => time == null ? null : new Date(time).toISOString().slice(0,10);
type Observation = {asset:AssetId;image:string;imageSha256:string;partialCandle:{open:number;high:number;low:number;close:number}|null;visualLastOfficialFlipWindow:string|null};
const observations:{charts:Observation[]} = JSON.parse(fs.readFileSync("research/kk-2026-10-03/observations.json","utf8"));
type PriorReference = {asset:string;source:string;timeframe:string;target:number;state?:string;targetState?:string};
const priorSeptember21:PriorReference[] = JSON.parse(fs.readFileSync("research/kk-2026-09-21-archives/results.json","utf8"));
const priorSeptember28:PriorReference[] = JSON.parse(fs.readFileSync("research/kk-2026-09-28/candidates.json","utf8"));
fs.mkdirSync(root,{recursive:true});
fs.mkdirSync(rawRoot,{recursive:true});
const db = new DatabaseSync("data/bitcoin-regime.sqlite",{readOnly:true});
type Fixture = {asset:AssetId;source:SourceId;market:string;retrievedAt:string;initialHistorySource:string;requests:{url:string;rawFile:string;rawSha256:string;retrievedAt:string}[];quality:{gaps:number;duplicates:number;malformed:number};candles:Candle[]};

async function fixture(asset:AssetId, source:SourceId):Promise<Fixture> {
  const file = `${root}/${asset}-${source}.json`;
  if(fs.existsSync(file)) return JSON.parse(fs.readFileSync(file,"utf8"));
  if(!process.argv.includes("--fetch")) throw new Error(`Missing fixture ${file}; run --fetch once`);
  const definition = source === "binance" && asset === "jup" ? {providerSymbol:"JUPUSDT",market:"JUP/USDT",historyStart:Date.UTC(2024,0,31)} : marketDefinition(asset,source);
  const saved = db.prepare("SELECT time,open,high,low,close,volume FROM market_candles WHERE asset=? AND source=? AND timeframe='1d' ORDER BY time").all(asset,source) as unknown as Candle[];
  const merged = new Map<number,Candle>(saved.map(c=>[c.time,{...c,complete:true}]));
  const record:Fixture = {asset,source,market:definition.market,retrievedAt:"",initialHistorySource:saved.length?"read-only local market_candles snapshot":"provider",requests:[],quality:{gaps:0,duplicates:0,malformed:0},candles:[]};
  let start = saved.at(-1)?.time ?? Math.max(definition.historyStart,diagnosticCutoff-1000*day);
  while(start<diagnosticCutoff){
    const end=Math.min(start+(source==="coinbase"?299:999)*day,diagnosticCutoff);
    const params = new URLSearchParams({granularity:"86400",start:new Date(start).toISOString(),end:new Date(end).toISOString()});
    const url=source==="coinbase"?`https://api.exchange.coinbase.com/products/${definition.providerSymbol}/candles?${params}`
      :source==="bitstamp"?`https://www.bitstamp.net/api/v2/ohlc/${definition.providerSymbol}/?step=86400&limit=1000&start=${start/1000}&end=${end/1000-1}`
      :source==="binance"?`https://data-api.binance.vision/api/v3/klines?symbol=${definition.providerSymbol}&interval=1d&limit=1000&startTime=${start}&endTime=${end-1}`
      :`https://api.kraken.com/0/public/OHLC?pair=${definition.providerSymbol}&interval=1440&since=${start/1000}`;
    const {body,raw}=await providerJson(url,{"User-Agent":"Regime-Lab/1.0"});
    const retrievedAt=new Date().toISOString();
    const rawFile=`${rawRoot}/${asset}-${source}-${date(start)}.json`;
    fs.writeFileSync(rawFile,raw+"\n");
    record.requests.push({url,rawFile,rawSha256:sha(raw+"\n"),retrievedAt});
    let rows:Candle[];
    if(source==="coinbase") rows=(body as number[][]).map(r=>({time:+r[0]*1000,low:+r[1],high:+r[2],open:+r[3],close:+r[4],volume:+r[5],complete:true}));
    else if(source==="binance") rows=(body as number[][]).map(r=>({time:+r[0],open:+r[1],high:+r[2],low:+r[3],close:+r[4],volume:+r[5],complete:true}));
    else if(source==="bitstamp") rows=(body as {data:{ohlc:Record<string,string>[]}}).data.ohlc.map(r=>({time:+r.timestamp*1000,open:+r.open,high:+r.high,low:+r.low,close:+r.close,volume:+r.volume,complete:true}));
    else {
      const response=body as {error:string[];result:Record<string,number[][]>};
      if(response.error?.length) throw new Error(`${asset}: ${response.error.join(", ")}`);
      rows=Object.entries(response.result).find(([key])=>key!=="last")![1].map(r=>({time:+r[0]*1000,open:+r[1],high:+r[2],low:+r[3],close:+r[4],volume:+r[6],complete:true}));
    }
    for(const candle of rows) if(candle.time<diagnosticCutoff) merged.set(candle.time,candle);
    record.retrievedAt=retrievedAt;
    start=end;
  }
  const validated=validateCandles([...merged.values()],day);
  record.quality={gaps:validated.gaps,duplicates:validated.duplicates,malformed:validated.malformed};
  if(validated.malformed||validated.duplicates) throw new Error(`${asset}/${source}: invalid history ${JSON.stringify(record.quality)}`);
  record.candles=validated.candles.filter(c=>c.time<diagnosticCutoff);
  if(record.candles.at(-1)?.time!==diagnosticCutoff-day) throw new Error(`${asset}/${source} lacks October 3 diagnostic candle`);
  fs.writeFileSync(file,JSON.stringify(record)+"\n");
  console.log(`Fetched ${asset}/${source}: ${record.candles.length} candles; ${record.requests.length} requests; gaps=${record.quality.gaps}`);
  return record;
}

const results=[];
for(const asset of ASSETS){
  const sources:SourceId[]=asset.id==="jup"?[asset.defaultSource,"binance"]:[asset.defaultSource];
  for(const source of sources){
    const f=await fixture(asset.id,source),candles=f.candles.filter(c=>c.time<cutoff),target=targets[asset.id];
    const pairs=asset.id==="qnt"?[[10,3],[15,2],[15,3],[15,4],[15,5],[50,4]]:[[10,3],[15,2],[15,3],[15,4],[15,5]];
    const observation=observations.charts.find(o=>o.asset===asset.id)!;
    function score(input:Candle[],atrLength:number,factor:number,comparisonTarget:number|null=target){
      const s=calculateIndicators(input,"1d",{asset:asset.id,indicatorIds:["kk_supertrend"],kkSupertrendAtrLength:atrLength,kkSupertrendFactor:factor})[0];
      const value=s.values.supertrend;
      const flips=s.states.flatMap((state,i)=>i>0&&input[i].time>=Date.UTC(2026,3,3)&&state!=null&&s.states[i-1]!=null&&state!==s.states[i-1]?[{state,signalDate:date(input[i].time),nextOpenDate:date(input[i+1]?.time??input[i].time+day)}]:[]);
      return {atrLength,factor,value,state:s.state,errorPct:comparisonTarget==null||value==null?null:100*(value/comparisonTarget-1),lastFlip:date(s.lastFlip),confirmation:s.confirmation??null,ready:s.readiness?.ready??true,flipsSinceApril3:flips};
    }
    const candidates=pairs.map(([atrLength,factor])=>{
      let asCapturedPartialDiagnostic=null;
      if(observation.partialCandle){
        // This synthetic complete flag is confined to the raw-trail diagnostic;
        // no official five-close state or counter is taken from this calculation.
        const partial={time:cutoff,...observation.partialCandle,volume:0,complete:true};
        const s=calculateIndicators([...candles,partial],"1d",{asset:asset.id,indicatorIds:["kk_supertrend"],kkSupertrendLegacySingleClose:true,kkSupertrendAtrLength:atrLength,kkSupertrendFactor:factor})[0];
        const value=s.values.supertrend;
        asCapturedPartialDiagnostic={value,errorPct:target==null||value==null?null:100*(value/target-1),note:"Raw ATR trail only from provider completed history plus screenshot composite partial OHLC; no official state or confirmation advancement."};
      }
      return {...score(candles,atrLength,factor),asCapturedPartialDiagnostic,afterOctober3Close:score(f.candles,atrLength,factor)};
    });
    const [a,factor]=previous[asset.id];
    const current=candidates.find(c=>c.atrLength===a&&c.factor===factor)!;
    const matching=candidates.filter(c=>c.state==="bull"&&c.errorPct!=null).sort((a,b)=>Math.abs(a.errorPct!)-Math.abs(b.errorPct!));
    const priorReferences=[];
    const r21=priorSeptember21.find(r=>r.asset===asset.id&&r.source===source&&r.timeframe==="1d"&&r.target!=null);
    if(r21){
      const file=`research/kk-2026-09-21-archives/${asset.id}-${source}.json`;
      const cs:Candle[]=JSON.parse(fs.readFileSync(file,"utf8")).candles;
      priorReferences.push({referenceDate:"2026-09-21",source,target:r21.target,targetState:r21.state,fixture:file,through:date(cs.at(-1)?.time),candidates:pairs.map(([a,m])=>score(cs,a,m,r21.target))});
    }
    const r28=priorSeptember28.find(r=>r.asset===asset.id&&r.source===source&&r.timeframe==="1d"&&r.target!=null);
    if(r28){
      const file=`research/kk-2026-09-28/${asset.id}.json`;
      const cs:Candle[]=JSON.parse(fs.readFileSync(file,"utf8")).daily;
      priorReferences.push({referenceDate:"2026-09-28",source,target:r28.target,targetState:r28.targetState,fixture:file,through:date(cs.at(-1)?.time),candidates:pairs.map(([a,m])=>score(cs,a,m,r28.target))});
    }
    const row={asset:asset.id,source,market:f.market,target,targetState:"bull",chartSource:asset.id==="jup"?"BINANCE:JUPUSDT":`CRYPTO:${asset.symbol}USD`,image:observation.image,imageSha256:observation.imageSha256,visualLastOfficialFlipWindow:observation.visualLastOfficialFlipWindow,primaryThrough:date(candles.at(-1)?.time),diagnosticThrough:date(f.candles.at(-1)?.time),bars:candles.length,quality:f.quality,fixture:`${root}/${asset.id}-${source}.json`,fixtureSha256:sha(fs.readFileSync(`${root}/${asset.id}-${source}.json`,"utf8")),current,bestSameRegime:matching[0]??null,candidates,priorReferences,limitation:asset.id==="link"?"No current numeric target: displayed 9.060 refers to historical June 14 candle. Do not fit latest level.":"Reference includes unfinished October 3 candle. Primary fit uses completed October 2; October 3 eventual close is diagnostic only."};
    results.push(row);
    fs.writeFileSync(`${root}/candidates.json`,JSON.stringify(results,null,2)+"\n");
    console.log(`${asset.id}/${source} target ${target}: current ${current.atrLength}/${current.factor} ${current.value} ${current.state} ${current.errorPct?.toFixed(2)}%; best ${matching[0]?.atrLength}/${matching[0]?.factor} ${matching[0]?.value} ${matching[0]?.state} ${matching[0]?.errorPct?.toFixed(2)}%`);
  }
}
db.close();
