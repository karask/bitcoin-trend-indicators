/** Offline-first screenshot research. Never writes production stores or presets. */
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { providerJson } from "../lib/provider-http.ts";
import { calculateIndicators, type Candle, type Timeframe } from "../lib/regimes.ts";
import { aggregateStockWeeks, stockDefinition, type StockSymbol } from "../lib/stocks.ts";
import { fetchYahooStockHistory } from "../lib/yahoo.ts";
import { aggregateWeekly, validateCandles } from "../lib/market-data.ts";

const root = "research/kk-2026-09-08";
type Chart = { asset: string; source: string; target: number; state: string; timeframe: Timeframe; live?: number[]; ignored?: boolean };
const charts: Chart[] = JSON.parse(fs.readFileSync(`${root}/charts.json`, "utf8"));
const selected = process.argv.find(a => a.startsWith("--assets="))?.slice(9).split(",");
const directory = "data/kk-research-2026-09-08";
fs.mkdirSync(directory, { recursive: true });
const db = new DatabaseSync("data/bitcoin-regime.sqlite", { readOnly: true });
const cutoff = Date.UTC(2026, 8, 7), screenshot = Date.UTC(2026, 8, 8, 17, 30);
const DAY = 86_400_000;

async function download(c: Chart): Promise<Candle[]> {
  if (c.source === "binance") {
    const { body } = await providerJson(`https://data-api.binance.vision/api/v3/klines?symbol=${c.asset.toUpperCase()}USDT&interval=1w&limit=1000&endTime=${cutoff - 1}`);
    return (body as number[][]).map(r => ({time:+r[0],open:+r[1],high:+r[2],low:+r[3],close:+r[4],volume:+r[5],complete:true}));
  }
  if (c.source === "kucoin") {
    // KuCoin's native weekly bars are Thursday-anchored; TradingView uses Monday.
    const { body } = await providerJson(`https://api.kucoin.com/api/v1/market/candles?symbol=HYPE-USDT&type=1day&startAt=1730419200&endAt=${cutoff / 1000 - 1}`);
    const daily=(body as {data:number[][]}).data.map(r => ({time:+r[0]*1000,open:+r[1],close:+r[2],high:+r[3],low:+r[4],volume:+r[5],complete:true})).sort((a,b)=>a.time-b.time);
    return aggregateWeekly(daily);
  }
  if (c.source === "yahoo") {
    const symbol=c.asset.toUpperCase() as StockSymbol;
    const history = await fetchYahooStockHistory(symbol, fetch, screenshot, [stockDefinition(symbol).historyStart,"2023-01-01"].sort().at(-1)!);
    return c.timeframe === "1w" ? aggregateStockWeeks(history.candles, screenshot) : history.candles;
  }
  const saved = db.prepare("SELECT time,open,high,low,close,volume,complete FROM market_candles WHERE asset=? AND source=? AND timeframe='1d' ORDER BY time").all(c.asset,c.source) as unknown as Candle[];
  const start = saved.at(-1)!.time;
  let tail: Candle[];
  if(c.source === "coinbase") {
    const {body} = await providerJson(`https://api.exchange.coinbase.com/products/${c.asset.toUpperCase()}-USD/candles?granularity=86400&start=${new Date(start).toISOString()}&end=${new Date(cutoff).toISOString()}`);
    tail = (body as number[][]).map(r=>({time:+r[0]*1000,low:+r[1],high:+r[2],open:+r[3],close:+r[4],volume:+r[5],complete:true}));
  } else if(c.source === "bitstamp") {
    const {body} = await providerJson(`https://www.bitstamp.net/api/v2/ohlc/btcusd/?step=86400&limit=100&start=${start/1000}&end=${cutoff/1000-1}`);
    tail = (body as {data:{ohlc:Record<string,string>[]}}).data.ohlc.map(r=>({time:+r.timestamp*1000,open:+r.open,high:+r.high,low:+r.low,close:+r.close,volume:+r.volume,complete:true}));
  } else {
    const {body} = await providerJson(`https://api.kraken.com/0/public/OHLC?pair=XMRUSD&interval=1440&since=${start/1000}`);
    const data = (body as {result:Record<string,unknown>}).result;
    const rows = Object.entries(data).find(([k])=>k!=="last")![1] as number[][];
    tail=rows.map(r=>({time:+r[0]*1000,open:+r[1],high:+r[2],low:+r[3],close:+r[4],volume:+r[6],complete:true}));
  }
  const merged = new Map(saved.map(r=>[r.time,{...r,complete:true}]));
  for(const row of tail) if(row.time<cutoff) merged.set(row.time,row);
  return aggregateWeekly([...merged.values()].sort((a,b)=>a.time-b.time));
}

for(const chart of charts.filter(c=>!selected || selected.includes(c.asset))) {
  const file=`${directory}/${chart.asset}-${chart.source}${chart.source==="kucoin"?"-monday":""}-${chart.timeframe}.json`;
  if(!fs.existsSync(file)) {
    if(!process.argv.includes("--download")) { console.log(`${chart.asset}: missing saved research candles`); continue; }
    const candles=await download(chart);
    fs.writeFileSync(file,JSON.stringify({retrievedAt:new Date().toISOString(),source:chart.source,candles},null,2)+"\n");
    await new Promise(r=>setTimeout(r,1500));
  }
  const candles: Candle[]=JSON.parse(fs.readFileSync(file,"utf8")).candles;
  const clean=candles.filter(c=>c.time<(chart.timeframe==="1w"?cutoff:Date.UTC(2026,8,8)));
  if(chart.timeframe==="1w") { const q=validateCandles(clean,7*DAY); if(q.gaps||q.duplicates||q.malformed||clean.some(c=>new Date(c.time).getUTCDay()!==1)) throw new Error(`${chart.asset}: invalid weekly research history`); }
  const modes:{mode:string;rows:Candle[]}[]=[{mode:"completed",rows:clean}];
  // The screenshot's partial candle is evaluated only in this research script.
  // Never persist it as completed production history or use it in backtests.
  if(chart.live) { const [open,high,low,close]=chart.live; modes.push({mode:"screenshot-partial",rows:[...clean,{time:chart.timeframe==="1w"?cutoff:Date.UTC(2026,8,8),open,high,low,close,volume:0,complete:true}]}); }
  const previous=["eth","sol"].includes(chart.asset)?{atrLength:10,factor:2}:["doge","link","xmr","sui"].includes(chart.asset)?{atrLength:15,factor:2}:{atrLength:10,factor:3};
  const output=[];
  for(const {mode,rows} of modes) {
    const candidates=[];
    for(const atrLength of [5,7,10,14,15,20,21,30]) for(const factor of [1,1.5,2,2.5,3]) {
      const r=calculateIndicators(rows,chart.timeframe,{indicatorIds:["kk_supertrend"],kkSupertrendAtrLength:atrLength,kkSupertrendFactor:factor})[0];
      candidates.push({atrLength,factor,state:r.state,value:r.values.supertrend,errorPct:100*(r.values.supertrend!/chart.target-1),lastFlip:r.lastFlip==null?null:new Date(r.lastFlip).toISOString().slice(0,10)});
    }
    const ranked=candidates.filter(r=>r.state===chart.state).sort((a,b)=>Math.abs(a.errorPct)-Math.abs(b.errorPct));
    output.push({mode,n:rows.length,through:new Date(rows.at(-1)!.time).toISOString().slice(0,10),current:candidates.find(r=>r.atrLength===previous.atrLength&&r.factor===previous.factor),best:ranked.slice(0,5),simple:candidates.filter(r=>[10,15].includes(r.atrLength)&&[2,3].includes(r.factor))});
  }
  console.log(JSON.stringify({asset:chart.asset,target:chart.target,ignored:chart.ignored,output}));
}
db.close();
