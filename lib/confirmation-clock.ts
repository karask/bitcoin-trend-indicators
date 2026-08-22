import type { Timeframe } from "./regimes";

const DAY = 86_400_000;

export function confirmationClock(timeframe: Timeframe, now: number) {
  const date = new Date(now);
  let target: number;
  if (timeframe === "1d") target = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
  else {
    const daysUntilMonday = (8 - date.getUTCDay()) % 7 || 7;
    target = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + daysUntilMonday);
  }
  const remaining = Math.max(0, target - now), totalMinutes = Math.floor(remaining / 60_000);
  const days = Math.floor(totalMinutes / 1440), hours = Math.floor(totalMinutes % 1440 / 60), minutes = totalMinutes % 60;
  return {
    title: timeframe === "1d" ? "Next daily close" : "Next weekly close",
    boundary: timeframe === "1d" ? "Today 23:59:59 UTC · confirms at 00:00 UTC" : "Sunday 23:59:59 UTC · confirms Monday at 00:00 UTC",
    remaining: `${days ? `${days}d ` : ""}${hours}h ${minutes}m`,
    target,
  };
}

export function completedBoundary(timeframe: Timeframe, now = Date.now()): number {
  const date = new Date(now);
  const today = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  if (timeframe === "1d") return today - DAY;
  const monday = today - ((date.getUTCDay() + 6) % 7) * DAY;
  return monday - 7 * DAY;
}
