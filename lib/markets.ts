export type SourceId = "bitstamp" | "binance" | "kraken" | "coinbase";
export type AssetId = "btc" | "eth" | "sol" | "doge" | "link" | "xmr" | "sui" | "jup" | "op" | "bonk" | "ada" | "atom" | "hype" | "dot";

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

/** Data availability gate, not indicator warmup. HYPE's USD venue is younger. */
export function minimumSourceCandles(asset: AssetId, timeframe: "1d" | "1w"): number {
  return asset === "hype" && timeframe === "1w" ? 26 : MIN_SOURCE_CANDLES[timeframe];
}

export const ASSETS: AssetDefinition[] = [
  { id: "btc", label: "Bitcoin", symbol: "BTC", defaultSource: "bitstamp" },
  { id: "eth", label: "Ethereum", symbol: "ETH", defaultSource: "bitstamp" },
  { id: "sol", label: "Solana", symbol: "SOL", defaultSource: "coinbase" },
  { id: "doge", label: "Dogecoin", symbol: "DOGE", defaultSource: "coinbase" },
  { id: "link", label: "Chainlink", symbol: "LINK", defaultSource: "coinbase" },
  { id: "xmr", label: "Monero", symbol: "XMR", defaultSource: "kraken" },
  { id: "sui", label: "Sui", symbol: "SUI", defaultSource: "coinbase" },
  { id: "jup", label: "Jupiter", symbol: "JUP", defaultSource: "kraken" },
  { id: "op", label: "Optimism", symbol: "OP", defaultSource: "coinbase" },
  { id: "bonk", label: "Bonk", symbol: "BONK", defaultSource: "coinbase" },
  { id: "ada", label: "Cardano", symbol: "ADA", defaultSource: "coinbase" },
  { id: "atom", label: "Cosmos", symbol: "ATOM", defaultSource: "coinbase" },
  { id: "hype", label: "Hyperliquid", symbol: "HYPE", defaultSource: "kraken" },
  { id: "dot", label: "Polkadot", symbol: "DOT", defaultSource: "coinbase" },
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
  { asset: "doge", id: "bitstamp", label: "Bitstamp", market: "DOGE/USD", denomination: "USD", providerSymbol: "dogeusd", historyStart: Date.UTC(2022, 11, 21), historyNote: "DOGE/USD validation history from December 2022" },
  { asset: "doge", id: "binance", label: "Binance", market: "DOGE/USDT", denomination: "USDT", providerSymbol: "DOGEUSDT", historyStart: Date.UTC(2019, 6, 5), historyNote: "Canonical long-history DOGE/USDT series from July 2019" },
  { asset: "doge", id: "kraken", label: "Kraken", market: "DOGE/USD", denomination: "USD", providerSymbol: "XDGUSD", historyStart: Date.UTC(2014, 1, 8), historyNote: "DOGE/USD validation; Kraken names Dogecoin XDG and public REST returns its latest 720 candles" },
  { asset: "doge", id: "coinbase", label: "Coinbase Exchange", market: "DOGE/USD", denomination: "USD", providerSymbol: "DOGE-USD", historyStart: Date.UTC(2021, 5, 3), historyNote: "DOGE/USD validation history from June 2021" },
  { asset: "link", id: "bitstamp", label: "Bitstamp", market: "LINK/USD", denomination: "USD", providerSymbol: "linkusd", historyStart: Date.UTC(2020, 9, 19), historyNote: "LINK/USD validation history from October 2020" },
  { asset: "link", id: "binance", label: "Binance", market: "LINK/USDT", denomination: "USDT", providerSymbol: "LINKUSDT", historyStart: Date.UTC(2019, 0, 16), historyNote: "Canonical long-history LINK/USDT series from January 2019" },
  { asset: "link", id: "kraken", label: "Kraken", market: "LINK/USD", denomination: "USD", providerSymbol: "LINKUSD", historyStart: Date.UTC(2019, 8, 25), historyNote: "LINK/USD validation; public REST returns its latest 720 candles" },
  { asset: "link", id: "coinbase", label: "Coinbase Exchange", market: "LINK/USD", denomination: "USD", providerSymbol: "LINK-USD", historyStart: Date.UTC(2019, 5, 27), historyNote: "LINK/USD validation history from June 2019" },
  { asset: "xmr", id: "kraken", label: "Kraken", market: "XMR/USD", denomination: "USD", providerSymbol: "XMRUSD", historyStart: Date.UTC(2014, 7, 21), historyNote: "XMR/USD validation; Kraken public REST returns its latest 720 candles" },
  { asset: "sui", id: "bitstamp", label: "Bitstamp", market: "SUI/USD", denomination: "USD", providerSymbol: "suiusd", historyStart: Date.UTC(2023, 4, 5), historyNote: "SUI/USD validation history from May 2023" },
  { asset: "sui", id: "binance", label: "Binance", market: "SUI/USDT", denomination: "USDT", providerSymbol: "SUIUSDT", historyStart: Date.UTC(2023, 4, 3), historyNote: "Canonical SUI/USDT history from May 2023" },
  { asset: "sui", id: "kraken", label: "Kraken", market: "SUI/USD", denomination: "USD", providerSymbol: "SUIUSD", historyStart: Date.UTC(2024, 8, 14), historyNote: "SUI/USD validation; public REST returns its latest 720 candles" },
  { asset: "sui", id: "coinbase", label: "Coinbase Exchange", market: "SUI/USD", denomination: "USD", providerSymbol: "SUI-USD", historyStart: Date.UTC(2023, 4, 18), historyNote: "SUI/USD validation history from May 2023" },
  { asset: "jup", id: "kraken", label: "Kraken", market: "JUP/USD", denomination: "USD", providerSymbol: "JUPUSD", historyStart: Date.UTC(2024, 0, 31), historyNote: "Solana Jupiter, not the delisted Coinbase JUP token. Kraken REST supplies its latest 720 daily candles; stored history grows thereafter." },
  { asset: "op", id: "coinbase", label: "Coinbase Exchange", market: "OP/USD", denomination: "USD", providerSymbol: "OP-USD", historyStart: Date.UTC(2022, 5, 1), historyNote: "OP/USD history from June 1, 2022" },
  { asset: "bonk", id: "coinbase", label: "Coinbase Exchange", market: "BONK/USD", denomination: "USD", providerSymbol: "BONK-USD", historyStart: Date.UTC(2023, 11, 14), historyNote: "BONK/USD history from December 14, 2023; unscaled BONK units" },
  { asset: "ada", id: "coinbase", label: "Coinbase Exchange", market: "ADA/USD", denomination: "USD", providerSymbol: "ADA-USD", historyStart: Date.UTC(2021, 2, 18), historyNote: "ADA/USD history from March 18, 2021" },
  { asset: "atom", id: "coinbase", label: "Coinbase Exchange", market: "ATOM/USD", denomination: "USD", providerSymbol: "ATOM-USD", historyStart: Date.UTC(2020, 0, 14), historyNote: "ATOM/USD history from January 14, 2020" },
  { asset: "hype", id: "kraken", label: "Kraken", market: "HYPE/USD", denomination: "USD", providerSymbol: "HYPEUSD", historyStart: Date.UTC(2026, 0, 28), historyNote: "HYPE/USD history from January 28, 2026. Short venue history: longer-period indicators and four-year tests may be unavailable." },
  { asset: "dot", id: "coinbase", label: "Coinbase Exchange", market: "DOT/USD", denomination: "USD", providerSymbol: "DOT-USD", historyStart: Date.UTC(2021, 5, 16), historyNote: "DOT/USD history from June 16, 2021" },
];

export function sourcesForAsset(asset: AssetId): SourceDefinition[] {
  return SOURCES.filter(source => source.asset === asset);
}

export function resolveSourceForAsset(asset: AssetId, preferred: string): SourceId {
  const supported = SOURCES.find(source => source.asset === asset && source.id === preferred);
  return supported?.id ?? ASSETS.find(item => item.id === asset)!.defaultSource;
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
