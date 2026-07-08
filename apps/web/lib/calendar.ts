import "server-only";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { chargeSessions, drives } from "@tripatlas/db";
import { db } from "./db";
import { APP_TIMEZONE } from "./config";
import { dayBounds } from "./day";
import type { CalendarDayStats } from "./calendarGrid";

/** [start, end) UTC instants for a YYYY-MM calendar month in APP_TIMEZONE. */
export function monthBounds(month: string): { start: Date; end: Date } {
  const firstOfMonth = `${month}-01`;
  const { start } = dayBounds(firstOfMonth);
  const [y, m] = month.split("-").map(Number);
  const nextMonth = m === 12 ? `${y! + 1}-01` : `${y}-${String(m! + 1).padStart(2, "0")}`;
  const { start: end } = dayBounds(`${nextMonth}-01`);
  return { start, end };
}

/**
 * Loads per-day drive stats (count + total km) for one vehicle across one
 * calendar month, grouped by local calendar day in APP_TIMEZONE. One grouped
 * query — avoids N+1 across up to 31 days.
 */
async function loadDriveStatsByDay(
  vehicleId: number,
  month: string,
): Promise<Map<string, { driveCount: number; totalKm: number }>> {
  const { start, end } = monthBounds(month);

  const rows = await db
    .select({
      day: sql<string>`to_char(${drives.startTime} AT TIME ZONE ${APP_TIMEZONE}, 'YYYY-MM-DD')`.as(
        "day",
      ),
      driveCount: sql<number>`count(*)::int`.as("drive_count"),
      totalKm: sql<number>`coalesce(sum(${drives.distanceKm}), 0)::float8`.as(
        "total_km",
      ),
    })
    .from(drives)
    .where(
      and(
        eq(drives.vehicleId, vehicleId),
        gte(drives.startTime, start),
        lt(drives.startTime, end),
      ),
    )
    .groupBy(sql`1`);

  const map = new Map<string, { driveCount: number; totalKm: number }>();
  for (const r of rows) {
    map.set(r.day, { driveCount: r.driveCount, totalKm: r.totalKm });
  }
  return map;
}

/**
 * Loads the set of local calendar days (APP_TIMEZONE) within the month that
 * had at least one charge session starting on that day.
 */
async function loadChargeDayCounts(
  vehicleId: number,
  month: string,
): Promise<Map<string, number>> {
  const { start, end } = monthBounds(month);

  const rows = await db
    .select({
      day: sql<string>`to_char(${chargeSessions.startTime} AT TIME ZONE ${APP_TIMEZONE}, 'YYYY-MM-DD')`.as(
        "day",
      ),
      chargeCount: sql<number>`count(*)::int`.as("charge_count"),
    })
    .from(chargeSessions)
    .where(
      and(
        eq(chargeSessions.vehicleId, vehicleId),
        gte(chargeSessions.startTime, start),
        lt(chargeSessions.startTime, end),
      ),
    )
    .groupBy(sql`1`);

  const map = new Map<string, number>();
  for (const r of rows) map.set(r.day, r.chargeCount);
  return map;
}

/**
 * Per-day stats for every day in the given month that has at least one drive
 * or charge session (empty days are simply absent from the map — the caller
 * fills in the grid).
 */
export async function getCalendarMonthStats(
  vehicleId: number,
  month: string,
): Promise<Map<string, CalendarDayStats>> {
  const [driveStats, chargeCounts] = await Promise.all([
    loadDriveStatsByDay(vehicleId, month),
    loadChargeDayCounts(vehicleId, month),
  ]);

  const days = new Set<string>([...driveStats.keys(), ...chargeCounts.keys()]);
  const map = new Map<string, CalendarDayStats>();
  for (const date of days) {
    const d = driveStats.get(date);
    map.set(date, {
      date,
      driveCount: d?.driveCount ?? 0,
      totalKm: d?.totalKm ?? 0,
      chargeCount: chargeCounts.get(date) ?? 0,
    });
  }
  return map;
}
