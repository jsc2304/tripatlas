/**
 * Pure calendar-grid math for the month view (M11) — no DB or `server-only`
 * imports, so this stays independently unit-testable. The grouped DB query
 * lives in `lib/calendar.ts`.
 */

import { toIntlLocale } from "./i18nLocale";

export interface CalendarDayStats {
  /** YYYY-MM-DD, local calendar day in APP_TIMEZONE. */
  date: string;
  driveCount: number;
  totalKm: number;
  chargeCount: number;
}

export interface CalendarCell {
  date: string; // YYYY-MM-DD
  dayOfMonth: number;
  inMonth: boolean;
  isToday: boolean;
  stats: CalendarDayStats | null;
  /** 0..1 relative to the month's max totalKm, for background intensity. */
  intensity: number;
}

/** Monday-first weekday index (0 = Mon .. 6 = Sun) for a YYYY-MM-DD string. */
function mondayIndex(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  // Date.UTC(...).getUTCDay(): 0 = Sun .. 6 = Sat. Shift to Monday-first.
  const jsDay = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  return (jsDay + 6) % 7;
}

function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0)).getUTCDate();
}

function addDaysToMonthDay(month: string, day: number): string {
  const [y, m] = month.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, day));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Adds `delta` days to a YYYY-MM-DD string, staying in the calendar domain. */
function shiftDate(date: string, delta: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + delta));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function makeCell(
  date: string,
  inMonth: boolean,
  today: string,
  statsByDay: Map<string, CalendarDayStats>,
  maxKm: number,
): CalendarCell {
  const stats = statsByDay.get(date) ?? null;
  const dayOfMonth = Number(date.slice(8, 10));
  const intensity = stats && maxKm > 0 ? Math.min(1, stats.totalKm / maxKm) : 0;
  return {
    date,
    dayOfMonth,
    inMonth,
    isToday: date === today,
    stats,
    intensity,
  };
}

/**
 * Builds a full Mo–So month grid (always a multiple of 7 cells, including
 * leading/trailing days of adjacent months) with per-day stats and a
 * 0..1 intensity relative to the month's max totalKm.
 */
export function buildCalendarGrid(
  month: string,
  statsByDay: Map<string, CalendarDayStats>,
  today: string,
): CalendarCell[] {
  const firstOfMonth = `${month}-01`;
  const leading = mondayIndex(firstOfMonth);
  const totalDays = daysInMonth(month);

  const maxKm = Math.max(
    0,
    ...[...statsByDay.values()]
      .filter((s) => s.date.startsWith(month))
      .map((s) => s.totalKm),
  );

  const cells: CalendarCell[] = [];

  // Leading days from the previous month.
  for (let i = leading; i > 0; i--) {
    const date = shiftDate(firstOfMonth, -i);
    cells.push(makeCell(date, false, today, statsByDay, maxKm));
  }

  // Days of the current month.
  for (let day = 1; day <= totalDays; day++) {
    const date = addDaysToMonthDay(month, day);
    cells.push(makeCell(date, true, today, statsByDay, maxKm));
  }

  // Trailing days from the next month, padded to a full week row.
  const remainder = cells.length % 7;
  if (remainder !== 0) {
    const lastDate = cells[cells.length - 1]!.date;
    const toAdd = 7 - remainder;
    for (let i = 1; i <= toAdd; i++) {
      const date = shiftDate(lastDate, i);
      cells.push(makeCell(date, false, today, statsByDay, maxKm));
    }
  }

  return cells;
}

/** Shifts a YYYY-MM string by `delta` months, handling year boundaries. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const idx = y! * 12 + (m! - 1) + delta;
  const yy = Math.floor(idx / 12);
  const mm = (idx % 12) + 1;
  return `${yy}-${String(mm).padStart(2, "0")}`;
}

const MONTH_RE = /^\d{4}-\d{2}$/;

/** Validates a YYYY-MM string (calendar-valid month 01-12). */
export function isValidMonthParam(month: string): boolean {
  if (!MONTH_RE.test(month)) return false;
  const m = Number(month.slice(5, 7));
  return m >= 1 && m <= 12;
}

/** Formats a YYYY-MM string as a localized month/year label. */
export function formatMonthLabel(month: string, locale = "de"): string {
  const [y, m] = month.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, 1, 12));
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(dt);
}

/** German Mo–So single/double-letter weekday initials, Monday-first. */
export const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
