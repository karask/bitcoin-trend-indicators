/**
 * Deterministic Nasdaq (XNAS) regular-session calendar.
 *
 * The recurring rules and the exceptional full-day closures below cover the
 * period used by the stock lab. Future exchange announcements can still amend
 * a published calendar, so the revision date and source are deliberately
 * exposed for the UI and maintenance checks.
 */

export const XNAS_CALENDAR_START_YEAR = 1999;
export const XNAS_CALENDAR_END_YEAR = 2035;
export const XNAS_CALENDAR_REVISION = "2026-08-28";
export const XNAS_CALENDAR_SOURCE = "https://www.nasdaqtrader.com/Trader.aspx?id=Calendar";

export interface XnasSession {
  date: string;
  earlyClose: boolean;
  closeHourEastern: 13 | 16;
  closeAt: number;
}

const DAY = 86_400_000;

// Exchange-wide exceptional closures which are not described by recurring
// holiday rules: 9/11, presidential funerals, Hurricane Sandy, and Carter's
// national day of mourning.
const SPECIAL_CLOSURES = new Set([
  "2001-09-11",
  "2001-09-12",
  "2001-09-13",
  "2001-09-14",
  "2004-06-11",
  "2007-01-02",
  "2012-10-29",
  "2012-10-30",
  "2018-12-05",
  "2025-01-09",
]);

// One-off shortened cash-equity sessions which do not follow the modern
// July 3 / Black Friday / Christmas Eve rules.
const SPECIAL_EARLY_CLOSES = new Set(["1999-12-31", "2002-07-05", "2003-12-26"]);

// July 3, 2002 traded regular hours; that year's holiday-adjacent half-day
// was Friday July 5 instead.
const SPECIAL_REGULAR_CLOSES = new Set(["2002-07-03"]);

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function partsFromEpoch(epoch: number): { year: number; month: number; day: number } {
  const date = new Date(epoch);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function epochFromParts(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day);
}

function epochFromKey(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const epoch = epochFromParts(year, month, day);
  const parts = partsFromEpoch(epoch);
  return parts.year === year && parts.month === month && parts.day === day ? epoch : null;
}

function keyFromEpoch(epoch: number): string {
  const { year, month, day } = partsFromEpoch(epoch);
  return dateKey(year, month, day);
}

function nthWeekday(year: number, month: number, weekday: number, occurrence: number): number {
  const first = epochFromParts(year, month, 1);
  const firstWeekday = new Date(first).getUTCDay();
  return first + ((weekday - firstWeekday + 7) % 7 + (occurrence - 1) * 7) * DAY;
}

function lastWeekday(year: number, month: number, weekday: number): number {
  const last = epochFromParts(year, month + 1, 0);
  return last - ((new Date(last).getUTCDay() - weekday + 7) % 7) * DAY;
}

// Meeus/Jones/Butcher Gregorian Easter calculation.
function easterSunday(year: number): number {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return epochFromParts(year, month, day);
}

function observedFixedHoliday(year: number, month: number, day: number): number {
  const epoch = epochFromParts(year, month, day);
  const weekday = new Date(epoch).getUTCDay();
  return weekday === 6 ? epoch - DAY : weekday === 0 ? epoch + DAY : epoch;
}

function newYearsClosure(year: number): number | null {
  const epoch = epochFromParts(year, 1, 1);
  const weekday = new Date(epoch).getUTCDay();
  // Nasdaq does not move a Saturday New Year's Day back onto the prior
  // calendar year's month/quarter/year end.
  return weekday === 6 ? null : weekday === 0 ? epoch + DAY : epoch;
}

function fullClosuresForYear(year: number): Set<string> {
  const closures = new Set<string>();
  const add = (epoch: number | null) => {
    if (epoch != null) closures.add(keyFromEpoch(epoch));
  };

  add(newYearsClosure(year));
  add(nthWeekday(year, 1, 1, 3)); // Martin Luther King Jr. Day
  add(nthWeekday(year, 2, 1, 3)); // Washington's Birthday
  add(easterSunday(year) - 2 * DAY); // Good Friday
  add(lastWeekday(year, 5, 1)); // Memorial Day
  if (year >= 2022) add(observedFixedHoliday(year, 6, 19)); // Juneteenth
  add(observedFixedHoliday(year, 7, 4));
  add(nthWeekday(year, 9, 1, 1)); // Labor Day
  add(nthWeekday(year, 11, 4, 4)); // Thanksgiving
  add(observedFixedHoliday(year, 12, 25));

  for (const closure of SPECIAL_CLOSURES) {
    if (closure.startsWith(`${year}-`)) closures.add(closure);
  }
  return closures;
}

const CLOSURES_BY_YEAR = new Map<number, Set<string>>();

function closuresForYear(year: number): Set<string> {
  let closures = CLOSURES_BY_YEAR.get(year);
  if (!closures) {
    closures = fullClosuresForYear(year);
    CLOSURES_BY_YEAR.set(year, closures);
  }
  return closures;
}

function earlyClosesForYear(year: number): Set<string> {
  const early = new Set<string>();
  const candidates = [
    epochFromParts(year, 7, 3),
    nthWeekday(year, 11, 4, 4) + DAY, // Friday after Thanksgiving
    epochFromParts(year, 12, 24),
  ];
  for (const epoch of candidates) {
    const key = keyFromEpoch(epoch);
    const weekday = new Date(epoch).getUTCDay();
    if (weekday >= 1 && weekday <= 5 && !closuresForYear(year).has(key) && !SPECIAL_REGULAR_CLOSES.has(key)) early.add(key);
  }
  for (const date of SPECIAL_EARLY_CLOSES) {
    if (date.startsWith(`${year}-`)) early.add(date);
  }
  return early;
}

const EARLY_CLOSES_BY_YEAR = new Map<number, Set<string>>();

function earlyCloses(year: number): Set<string> {
  let dates = EARLY_CLOSES_BY_YEAR.get(year);
  if (!dates) {
    dates = earlyClosesForYear(year);
    EARLY_CLOSES_BY_YEAR.set(year, dates);
  }
  return dates;
}

function assertCoverage(year: number): void {
  if (year < XNAS_CALENDAR_START_YEAR || year > XNAS_CALENDAR_END_YEAR) {
    throw new RangeError(`XNAS calendar supports ${XNAS_CALENDAR_START_YEAR}-${XNAS_CALENDAR_END_YEAR}`);
  }
}

export function isXnasSessionDate(value: string): boolean {
  const epoch = epochFromKey(value);
  if (epoch == null) return false;
  const year = new Date(epoch).getUTCFullYear();
  if (year < XNAS_CALENDAR_START_YEAR || year > XNAS_CALENDAR_END_YEAR) return false;
  const weekday = new Date(epoch).getUTCDay();
  return weekday >= 1 && weekday <= 5 && !closuresForYear(year).has(value);
}

function easternDaylightTimeApplies(year: number, month: number, day: number): boolean {
  const date = epochFromParts(year, month, day);
  const start = year >= 2007 ? nthWeekday(year, 3, 0, 2) : nthWeekday(year, 4, 0, 1);
  const end = year >= 2007 ? nthWeekday(year, 11, 0, 1) : lastWeekday(year, 10, 0);
  return date >= start && date < end;
}

export function xnasSession(value: string): XnasSession | null {
  if (!isXnasSessionDate(value)) return null;
  const epoch = epochFromKey(value)!;
  const { year, month, day } = partsFromEpoch(epoch);
  const earlyClose = earlyCloses(year).has(value);
  const closeHourEastern = earlyClose ? 13 : 16;
  const utcOffsetHours = easternDaylightTimeApplies(year, month, day) ? 4 : 5;
  return {
    date: value,
    earlyClose,
    closeHourEastern,
    closeAt: epoch + (closeHourEastern + utcOffsetHours) * 60 * 60 * 1000,
  };
}

export function xnasSessionsBetween(startDate: string, endDate: string): XnasSession[] {
  const start = epochFromKey(startDate);
  const end = epochFromKey(endDate);
  if (start == null || end == null) throw new RangeError("XNAS session range must use valid YYYY-MM-DD dates");
  const startYear = new Date(start).getUTCFullYear();
  const endYear = new Date(end).getUTCFullYear();
  assertCoverage(startYear);
  assertCoverage(endYear);
  if (end < start) return [];
  const sessions: XnasSession[] = [];
  for (let epoch = start; epoch <= end; epoch += DAY) {
    const session = xnasSession(keyFromEpoch(epoch));
    if (session) sessions.push(session);
  }
  return sessions;
}

export function xnasSessionsForYear(year: number): XnasSession[] {
  assertCoverage(year);
  return xnasSessionsBetween(dateKey(year, 1, 1), dateKey(year, 12, 31));
}

export function isXnasSessionComplete(value: string, asOfMs: number): boolean {
  const session = xnasSession(value);
  return Boolean(session && session.closeAt <= asOfMs);
}

export function latestCompletedXnasSession(asOfMs: number): XnasSession | null {
  const asOf = new Date(asOfMs);
  if (!Number.isFinite(asOf.getTime())) return null;
  let epoch = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  const first = Date.UTC(XNAS_CALENDAR_START_YEAR, 0, 1);
  const last = Date.UTC(XNAS_CALENDAR_END_YEAR, 11, 31);
  epoch = Math.min(epoch, last);
  for (; epoch >= first; epoch -= DAY) {
    const session = xnasSession(keyFromEpoch(epoch));
    if (session && session.closeAt <= asOfMs) return session;
  }
  return null;
}

export function xnasDateKey(epoch: number): string {
  return keyFromEpoch(epoch);
}

export function xnasDateEpoch(value: string): number | null {
  return epochFromKey(value);
}
