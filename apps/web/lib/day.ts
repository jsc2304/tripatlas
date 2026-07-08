import { TZDate } from "@date-fns/tz";
import { APP_TIMEZONE } from "./config";
import { toIntlLocale } from "./i18nLocale";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Validates a YYYY-MM-DD string (calendar-valid, e.g. no 2026-13-40). */
export function isValidDateParam(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * Returns the [start, nextDayStart) UTC instants bounding the given calendar
 * day in APP_TIMEZONE. Uses TZDate so DST transitions are handled correctly.
 */
export function dayBounds(date: string): { start: Date; end: Date } {
  const [y, m, d] = date.split("-").map(Number);
  // Midnight local wall-clock time in the app timezone.
  const start = new TZDate(y, m - 1, d, 0, 0, 0, 0, APP_TIMEZONE);
  const end = new TZDate(y, m - 1, d + 1, 0, 0, 0, 0, APP_TIMEZONE);
  return { start: new Date(start.getTime()), end: new Date(end.getTime()) };
}

/** Today's calendar date (YYYY-MM-DD) in APP_TIMEZONE. */
export function todayInAppTz(): string {
  const now = new TZDate(Date.now(), APP_TIMEZONE);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Adds `delta` days to a YYYY-MM-DD string, staying in the calendar domain. */
export function shiftDate(date: string, delta: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Formats a YYYY-MM-DD as a long localized date in APP_TIMEZONE. */
export function formatLongDate(date: string, locale = "de"): string {
  const [y, m, d] = date.split("-").map(Number);
  // Noon UTC-anchored is safe for date-only display; use a plain Date at local
  // midnight of the app tz to pick the right weekday.
  const dt = new TZDate(y, m - 1, d, 12, 0, 0, 0, APP_TIMEZONE);
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: APP_TIMEZONE,
  }).format(new Date(dt.getTime()));
}

/**
 * Formats an instant as a `YYYY-MM-DDTHH:mm` string in APP_TIMEZONE wall-clock,
 * suitable for prefilling an `<input type="datetime-local">`.
 */
export function toDateTimeLocal(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: APP_TIMEZONE,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/**
 * Parses a `YYYY-MM-DDTHH:mm` datetime-local value as APP_TIMEZONE wall-clock
 * into a UTC Date. Returns null for empty/invalid input.
 */
export function parseDateTimeLocal(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const tz = new TZDate(y, mo - 1, d, h, mi, 0, 0, APP_TIMEZONE);
  const out = new Date(tz.getTime());
  return Number.isNaN(out.getTime()) ? null : out;
}

/**
 * Formats an instant as relative time for recent values, falling back to an
 * absolute date/time for anything older than a week.
 */
export function formatRelativeTime(date: Date, locale = "de"): string {
  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
  const absSec = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(toIntlLocale(locale), { numeric: "auto" });

  if (absSec < 60) return rtf.format(diffSec, "second");
  const diffMin = Math.round(diffSec / 60);
  const absMin = Math.abs(diffMin);
  if (absMin < 60) return rtf.format(diffMin, "minute");
  const diffH = Math.round(diffMin / 60);
  const absH = Math.abs(diffH);
  if (absH < 24) return rtf.format(diffH, "hour");
  const diffDays = Math.round(diffH / 24);
  if (Math.abs(diffDays) < 7) return rtf.format(diffDays, "day");

  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: APP_TIMEZONE,
  }).format(date);
}
