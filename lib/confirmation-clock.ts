import type { Timeframe } from "./regimes";
import { xnasDateKey, xnasSessionsBetween } from "./xnas-calendar.ts";

const DAY = 86_400_000;

function remainingLabel(target: number, now: number) {
  const remaining = Math.max(0, target - now), totalMinutes = Math.floor(remaining / 60_000);
  const days = Math.floor(totalMinutes / 1440), hours = Math.floor(totalMinutes % 1440 / 60), minutes = totalMinutes % 60;
  return `${days ? `${days}d ` : ""}${hours}h ${minutes}m`;
}

export function confirmationClock(timeframe: Timeframe, now: number) {
  const date = new Date(now);
  let target: number;
  if (timeframe === "1d") target = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
  else {
    const daysUntilMonday = (8 - date.getUTCDay()) % 7 || 7;
    target = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + daysUntilMonday);
  }
  return {
    title: timeframe === "1d" ? "Next daily close" : "Next weekly close",
    boundary: timeframe === "1d" ? "Today 23:59:59 UTC · confirms at 00:00 UTC" : "Sunday 23:59:59 UTC · confirms Monday at 00:00 UTC",
    remaining: remainingLabel(target, now),
    target,
  };
}

export function stockConfirmationClock(timeframe: Timeframe, now: number) {
  if (!now) return {
    title: timeframe === "1d" ? "Next daily close" : "Next weekly close",
    boundary: "NASDAQ trading calendar · America/New_York",
    remaining: "—",
    target: 0,
  };
  const safeNow = now;
  const today = new Date(safeNow);
  const todayEpoch = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const monday = todayEpoch - ((today.getUTCDay() + 6) % 7) * DAY;
  const sessions = xnasSessionsBetween(xnasDateKey(monday), xnasDateKey(monday + 28 * DAY));
  let targetSession = sessions.find(session => session.closeAt > safeNow) ?? sessions.at(-1)!;
  if (timeframe === "1w") {
    const weeklyFinals = new Map<number, typeof targetSession>();
    for (const session of sessions) {
      const epoch = Date.parse(`${session.date}T00:00:00.000Z`);
      const week = epoch - ((new Date(epoch).getUTCDay() + 6) % 7) * DAY;
      weeklyFinals.set(week, session);
    }
    targetSession = [...weeklyFinals.values()].find(session => session.closeAt > safeNow) ?? targetSession;
  }
  const targetDate = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" }).format(new Date(targetSession.closeAt));
  return {
    title: timeframe === "1d" ? "Next daily close" : "Next weekly close",
    boundary: `${targetDate} · ${targetSession.closeHourEastern}:00 ET${targetSession.earlyClose ? " · early close" : ""}`,
    remaining: remainingLabel(targetSession.closeAt, safeNow),
    target: targetSession.closeAt,
  };
}

export function completedBoundary(timeframe: Timeframe, now = Date.now()): number {
  const date = new Date(now);
  const today = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  if (timeframe === "1d") return today - DAY;
  const monday = today - ((date.getUTCDay() + 6) % 7) * DAY;
  return monday - 7 * DAY;
}
