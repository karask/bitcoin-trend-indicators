import type { SourceDefinition, SourceId } from "../../lib/markets";

function parseSpotPrice(source: SourceId, body: unknown): number {
  const record = body as Record<string, unknown>;
  let raw: unknown;
  if (source === "bitstamp") raw = record.last;
  else if (source === "binance" || source === "coinbase") raw = record.price;
  else {
    const errors = Array.isArray(record.error) ? record.error : [];
    if (errors.length) throw new Error(errors.join(", "));
    const result = record.result as Record<string, { c?: unknown[] }> | undefined;
    raw = result ? Object.values(result)[0]?.c?.[0] : undefined;
  }
  const price = Number(raw);
  if (!Number.isFinite(price) || price <= 0) throw new Error("Provider returned an invalid spot price");
  return price;
}

export async function spotPrice(definition: SourceDefinition): Promise<number> {
  const url = definition.id === "bitstamp"
    ? `https://www.bitstamp.net/api/v2/ticker/${definition.providerSymbol}/`
    : definition.id === "binance"
      ? `https://api.binance.com/api/v3/ticker/price?symbol=${definition.providerSymbol}`
      : definition.id === "kraken"
        ? `https://api.kraken.com/0/public/Ticker?pair=${definition.providerSymbol}`
        : `https://api.exchange.coinbase.com/products/${definition.providerSymbol}/ticker`;
  const response = await fetch(url, { headers: definition.id === "coinbase" ? { "User-Agent": "Crypto-Regime-Lab/1.0" } : undefined });
  if (!response.ok) throw new Error(`${definition.label} returned HTTP ${response.status}`);
  return parseSpotPrice(definition.id, await response.json());
}
