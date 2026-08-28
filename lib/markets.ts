export type SourceId = "bitstamp" | "binance" | "kraken" | "coinbase";
export type AssetId = "btc" | "eth" | "sol";

export interface AssetDefinition {
  id: AssetId;
  label: string;
  symbol: string;
  defaultSource: SourceId;
}

export interface SourceDefinition {
  asset: AssetId;
  id: SourceId;
  label: string;
  market: string;
  denomination: string;
  historyNote: string;
  providerSymbol: string;
  historyStart: number;
}

export const MIN_SOURCE_CANDLES = {
  "1d": 200,
  "1w": 52,
} as const;

export const ASSETS: AssetDefinition[] = [
  { id: "btc", label: "Bitcoin", symbol: "BTC", defaultSource: "bitstamp" },
  { id: "eth", label: "Ethereum", symbol: "ETH", defaultSource: "bitstamp" },
  { id: "sol", label: "Solana", symbol: "SOL", defaultSource: "coinbase" },
];

export const SOURCES: SourceDefinition[] = [
  { asset: "btc", id: "bitstamp", label: "Bitstamp", market: "BTC/USD", denomination: "USD", providerSymbol: "btcusd", historyStart: Date.UTC(2011, 7, 18), historyNote: "Canonical long-history BTC/USD daily series" },
  { asset: "btc", id: "binance", label: "Binance", market: "BTC/USDT", denomination: "USDT", providerSymbol: "BTCUSDT", historyStart: Date.UTC(2017, 7, 17), historyNote: "UTC cross-venue validation from August 2017" },
  { asset: "btc", id: "kraken", label: "Kraken", market: "BTC/USD", denomination: "USD", providerSymbol: "XBTUSD", historyStart: Date.UTC(2013, 9, 6), historyNote: "REST validation window; unfinished candle excluded" },
  { asset: "btc", id: "coinbase", label: "Coinbase Exchange", market: "BTC/USD", denomination: "USD", providerSymbol: "BTC-USD", historyStart: Date.UTC(2015, 6, 20), historyNote: "USD-denominated validation history" },
  { asset: "eth", id: "bitstamp", label: "Bitstamp", market: "ETH/USD", denomination: "USD", providerSymbol: "ethusd", historyStart: Date.UTC(2017, 7, 16), historyNote: "Continuous ETH/USD history from August 2017" },
  { asset: "eth", id: "binance", label: "Binance", market: "ETH/USDT", denomination: "USDT", providerSymbol: "ETHUSDT", historyStart: Date.UTC(2017, 7, 17), historyNote: "UTC ETH/USDT history from August 2017" },
  { asset: "eth", id: "kraken", label: "Kraken", market: "ETH/USD", denomination: "USD", providerSymbol: "ETHUSD", historyStart: Date.UTC(2015, 7, 8), historyNote: "Venue dates to 2015; public REST returns its latest 720 candles" },
  { asset: "eth", id: "coinbase", label: "Coinbase Exchange", market: "ETH/USD", denomination: "USD", providerSymbol: "ETH-USD", historyStart: Date.UTC(2016, 4, 23), historyNote: "Continuous ETH/USD validation history from May 23, 2016" },
  { asset: "sol", id: "bitstamp", label: "Bitstamp", market: "SOL/USD", denomination: "USD", providerSymbol: "solusd", historyStart: Date.UTC(2022, 7, 18), historyNote: "SOL/USD validation history from August 2022" },
  { asset: "sol", id: "binance", label: "Binance", market: "SOL/USDT", denomination: "USDT", providerSymbol: "SOLUSDT", historyStart: Date.UTC(2020, 7, 11), historyNote: "Canonical long-history SOL/USDT series from August 2020" },
  { asset: "sol", id: "kraken", label: "Kraken", market: "SOL/USD", denomination: "USD", providerSymbol: "SOLUSD", historyStart: Date.UTC(2021, 5, 17), historyNote: "SOL/USD validation; public REST returns its latest 720 candles" },
  { asset: "sol", id: "coinbase", label: "Coinbase Exchange", market: "SOL/USD", denomination: "USD", providerSymbol: "SOL-USD", historyStart: Date.UTC(2021, 5, 17), historyNote: "SOL/USD validation history from June 2021" },
];

export function sourcesForAsset(asset: AssetId): SourceDefinition[] {
  return SOURCES.filter(source => source.asset === asset);
}

export function marketDefinition(asset: AssetId, source: SourceId): SourceDefinition {
  const definition = SOURCES.find(item => item.asset === asset && item.id === source);
  if (!definition) throw new Error(`Unsupported ${asset.toUpperCase()} market source`);
  return definition;
}

export function isAssetId(value: string): value is AssetId {
  return ASSETS.some(asset => asset.id === value);
}

export function isSourceId(value: string): value is SourceId {
  return ["bitstamp", "binance", "kraken", "coinbase"].includes(value);
}
