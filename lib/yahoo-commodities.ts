import type { Candle } from "./regimes.ts";
import { COMMODITY_ADJUSTMENT, COMMODITY_PROVIDER, commodityDefinition, commodityDateEpoch, commodityDateKey, commodityBarComplete, commodityQuality, expectedCommodityDates, isCommodityBarDate, isCommoditySymbol, latestRequiredCommodityDate, type CommodityHistoryResponse, type CommodityQuote, type CommoditySymbol } from "./commodities.ts";
import { StockApiError } from "./yahoo.ts";
type Fetcher = typeof fetch;
type Chart = { meta?: { symbol?: string; currency?: string; instrumentType?: string; shortName?: string; regularMarketPrice?: number; regularMarketTime?: number; chartPreviousClose?: number; previousClose?: number }; timestamp?: number[]; indicators?: { quote?: { open: (number|null)[]; high: (number|null)[]; low: (number|null)[]; close: (number|null)[]; volume: (number|null)[] }[] } };
export function commoditySymbolFromRequest(request: Request): CommoditySymbol {
  const symbol = new URL(request.url).searchParams.get("symbol")?.toUpperCase() ?? "";
  if (!isCommoditySymbol(symbol)) throw new StockApiError(400, "Unsupported commodity symbol");
  return symbol;
}
export function commodityStartDate(request: Request, symbol: CommoditySymbol, through: string): string {
  const start = new URL(request.url).searchParams.get("startDate") ?? commodityDefinition(symbol).historyStart;
  if (commodityDateEpoch(start) == null || start < commodityDefinition(symbol).historyStart || start > through) throw new StockApiError(400, "Unsupported commodity history start date");
  return start;
}
async function chart(symbol: CommoditySymbol, query: Record<string,string>, fetcher: Fetcher): Promise<Chart> {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  for (const [key,value] of Object.entries(query)) url.searchParams.set(key,value);
  let response: Response;
  try { response = await fetcher(url,{ headers:{Accept:"application/json","User-Agent":"Regime-Lab/1.0"},cache:"no-store",redirect:"manual",signal:AbortSignal.timeout(20000) }); }
  catch { throw new StockApiError(502,"Yahoo futures data is temporarily unavailable"); }
  if (response.status === 429) throw new StockApiError(429,"Yahoo Finance request limit reached; try again later");
  if (!response.ok) throw new StockApiError(502,"Yahoo futures data is temporarily unavailable");
  let body;
  try { body = await response.json(); } catch { throw new StockApiError(502,"Invalid Yahoo futures response"); }
  const result: Chart | undefined = body?.chart?.result?.[0];
  if (body?.chart?.error || !result || result.meta?.symbol !== symbol || result.meta?.currency !== "USD" || result.meta?.instrumentType !== "FUTURE") throw new StockApiError(502,"Yahoo futures provenance check failed");
  return result;
}
export function normalizeCommodityHistory(result: Chart, symbol: CommoditySymbol, start: string, now: number): CommodityHistoryResponse {
  const q=result.indicators?.quote?.[0], rows=new Map<number,Candle>();
  if (!q || !Array.isArray(result.timestamp)) throw new StockApiError(502,"Yahoo returned no futures candles");
  const quality={gaps:0,duplicates:0,malformed:0,unexpectedSessions:0};
  result.timestamp.forEach((seconds,i)=>{
    if (!Number.isFinite(seconds)) {quality.malformed++;return;}
    const date=commodityDateKey(seconds*1000);
    if (date<start || !commodityBarComplete(date,now)) return;
    if (!isCommodityBarDate(date)) {quality.unexpectedSessions++;return;}
    const open=q.open?.[i], high=q.high?.[i], low=q.low?.[i], close=q.close?.[i], volume=q.volume?.[i] ?? 0;
    // Yahoo sometimes emits null placeholders for holidays, not traded bars.
    if ([open,high,low,close].every(v=>v==null) && !expectedCommodityDates(date,date).length) return;
    if ([open,high,low,close].some(v=>typeof v!=="number" || !Number.isFinite(v) || v<=0) || !Number.isFinite(volume) || volume<0 || high!<Math.max(open!,close!) || low!>Math.min(open!,close!)) {quality.malformed++;return;}
    const time=commodityDateEpoch(date)!;
    if (rows.has(time)) quality.duplicates++;
    rows.set(time,{time,open:open!,high:high!,low:low!,close:close!,volume,complete:true});
  });
  const candles=[...rows.values()].sort((a,b)=>a.time-b.time);
  const requiredThrough=latestRequiredCommodityDate(now);
  if (!candles.length || !requiredThrough) throw new StockApiError(502,"Yahoo returned no completed futures history");
  quality.gaps=commodityQuality(candles,start,requiredThrough);
  if (Object.values(quality).some(Boolean)) throw new StockApiError(502,"Yahoo futures history failed quality checks", "commodity_quality");
  return {commodity:commodityDefinition(symbol),provider:COMMODITY_PROVIDER,providerUrl:"https://finance.yahoo.com/",exchange:"COMEX",timeframe:"1d",requestedStart:start,requiredThrough,retrievedAt:new Date(now).toISOString(),adjustment:COMMODITY_ADJUSTMENT,contractLabel:result.meta?.shortName ?? commodityDefinition(symbol).label,candles,quality};
}
export async function fetchCommodityHistory(symbol: CommoditySymbol, fetcher: Fetcher=fetch, now=Date.now(), start: string=commodityDefinition(symbol).historyStart) {
  if (commodityDateEpoch(start)==null || start<commodityDefinition(symbol).historyStart || start>(latestRequiredCommodityDate(now)??"")) throw new StockApiError(400,"Unsupported commodity history start date");
  return normalizeCommodityHistory(await chart(symbol,{period1:String(commodityDateEpoch(start)!/1000),period2:String(Math.floor(now/1000)+86400),interval:"1d"},fetcher),symbol,start,now);
}
export async function fetchCommodityQuote(symbol: CommoditySymbol, fetcher: Fetcher=fetch, now=Date.now()): Promise<CommodityQuote> {
  const result=await chart(symbol,{range:"1d",interval:"1m"},fetcher), meta=result.meta!;
  if (!Number.isFinite(meta.regularMarketPrice) || meta.regularMarketPrice!<=0 || !Number.isFinite(meta.regularMarketTime)) throw new StockApiError(502,"Yahoo returned no current futures quote");
  return {commodity:commodityDefinition(symbol),provider:COMMODITY_PROVIDER,price:meta.regularMarketPrice!,previousClose:meta.previousClose??meta.chartPreviousClose??null,currency:"USD",contractLabel:meta.shortName??commodityDefinition(symbol).label,quoteTime:new Date(meta.regularMarketTime!*1000).toISOString(),retrievedAt:new Date(now).toISOString()};
}
export function commodityJson(body: unknown,status=200) {return Response.json(body,{status,headers:{"Cache-Control":"private, no-store",Pragma:"no-cache"}});}
export function commodityError(error: unknown) {return commodityJson({error:error instanceof StockApiError?error.message:"Commodity data is unavailable"},error instanceof StockApiError?error.status:500);}
