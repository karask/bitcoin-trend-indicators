/** Shared price precision: preserve six significant digits for low-priced assets. */
export function formatPrice(value: number | null | undefined, denomination = "USD"): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const magnitude = Math.abs(value);
  const digits = magnitude === 0 ? 2 : Math.min(10, Math.max(2, 5 - Math.floor(Math.log10(magnitude))));
  const formatted = new Intl.NumberFormat("en-US", {
    ...(denomination === "USD" ? { style: "currency", currency: "USD" } : {}),
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  }).format(value);
  return denomination === "USD" ? formatted : `${formatted} ${denomination}`;
}

export const formatPct = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(1)}%`;
export const formatDate = (value: number | null | undefined) => value == null ? "—" : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(value);

export function quoteAge(retrievedAt: string | null | undefined, now: number): string {
  if (!retrievedAt || !now || !Number.isFinite(Date.parse(retrievedAt))) return "age unavailable";
  const minutes = Math.max(0, Math.floor((now - Date.parse(retrievedAt)) / 60_000));
  if (minutes < 1) return "fetched just now";
  if (minutes < 60) return `fetched ${minutes}m ago`;
  if (minutes < 1440) return `fetched ${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
  return `fetched ${Math.floor(minutes / 1440)}d ago`;
}
