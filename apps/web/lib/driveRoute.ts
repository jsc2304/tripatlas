import "server-only";
import { asc, eq } from "drizzle-orm";
import { routePoints } from "@tripatlas/db";
import { db } from "./db";

/** [lat, lon, unix_ts_ms, speedKmh, soc] tuple for a single route point. */
export type RoutePointTuple = [number, number, number, number | null, number | null];

/**
 * Ein Route-Punkt mit allen für das Multi-Kurven-Chart „Verlauf" (M18)
 * relevanten Messwerten. lat/lon dienen der kumulierten Distanz-Achse.
 */
export interface ChartRoutePoint {
  lat: number;
  lon: number;
  elevationM: number | null;
  soc: number | null;
  speedKmh: number | null;
}

// Above this many points, thin server-side so the client payload/DOM stays
// light (e.g. very long trips sampled every ~15s can have thousands of rows).
const MAX_POINTS = 1500;

export interface DriveRoute {
  /** Ordered points, thinned to at most MAX_POINTS for a lean payload. */
  points: RoutePointTuple[];
  /** True number of recorded route points (pre-thinning), for display. */
  totalCount: number;
  /** Anteil der Punkte mit befülltem elevation_m (0..1), für das Höhenprofil. */
  elevationCoverage: number;
  /** Alle Messwerte je Punkt (thinned), für das Multi-Kurven-Chart (M18). */
  chartPoints: ChartRoutePoint[];
}

/** Ordered route points for a drive, thinned to at most MAX_POINTS. */
export async function getRoutePoints(driveId: number): Promise<DriveRoute> {
  const rows = await db
    .select({
      lat: routePoints.lat,
      lon: routePoints.lon,
      ts: routePoints.ts,
      speedKmh: routePoints.speedKmh,
      soc: routePoints.soc,
      elevationM: routePoints.elevationM,
    })
    .from(routePoints)
    .where(eq(routePoints.driveId, driveId))
    .orderBy(asc(routePoints.ts));

  const thinned = thin(rows, MAX_POINTS);
  const withElevation = rows.filter((r) => r.elevationM != null).length;

  return {
    points: thinned.map((r) => [r.lat, r.lon, r.ts.getTime(), r.speedKmh, r.soc]),
    totalCount: rows.length,
    elevationCoverage: rows.length > 0 ? withElevation / rows.length : 0,
    chartPoints: thinned.map((r) => ({
      lat: r.lat,
      lon: r.lon,
      elevationM: r.elevationM,
      soc: r.soc,
      speedKmh: r.speedKmh,
    })),
  };
}

/** Keep every nth row so the result has at most `max` entries, always
 * including the first and last point (start/end markers rely on them). */
function thin<T>(rows: T[], max: number): T[] {
  if (rows.length <= max) return rows;
  const step = Math.ceil(rows.length / max);
  const out: T[] = [];
  for (let i = 0; i < rows.length; i += step) {
    out.push(rows[i]);
  }
  const last = rows[rows.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}
