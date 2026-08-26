export type Theme = "light" | "dark";

export function nearestCandleIndex(pointerX: number, plotLeft: number, plotWidth: number, count: number) {
  if (count <= 0 || plotWidth <= 0) return -1;
  const raw = Math.floor((pointerX - plotLeft) / plotWidth * count);
  return Math.max(0, Math.min(count - 1, raw));
}

export function priceAtY(pointerY: number, plotTop: number, plotHeight: number, minimum: number, maximum: number) {
  if (plotHeight <= 0 || maximum <= minimum) return minimum;
  const ratio = Math.max(0, Math.min(1, (pointerY - plotTop) / plotHeight));
  return maximum - ratio * (maximum - minimum);
}

export function periodLabel(time: number, timeframe: "1d" | "1w") {
  const format = (value: number) => new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
  }).format(value);
  if (timeframe === "1d") return format(time);
  return `${format(time)} – ${format(time + 6 * 86_400_000)}`;
}

export function resolveInitialTheme(saved: string | null, systemDark: boolean): Theme {
  if (saved === "light" || saved === "dark") return saved;
  return systemDark ? "dark" : "light";
}
