import { asc, desc, eq, isNull } from "drizzle-orm";
import { drives, routePoints, type Db } from "@tripatlas/db";
import { recordSyncRun } from "./state.js";

const SOURCE = "open_meteo";
const ENTITY = "elevation";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/elevation";
// Open-Meteo erlaubt bis zu 100 Koordinaten pro Request.
const COORDS_PER_REQUEST = 100;
// Höflichkeitspause zwischen Requests, um die kostenlose API nicht zu fluten.
const PAUSE_MS = 300;
// Obergrenze pro Sync-Zyklus, damit ein Tick nicht Stunden dauert — neueste
// Fahrten zuerst, damit frische Fahrten sofort ihre Höhenprofile bekommen und
// nicht hinter dem ~150k-Punkte-Rückstau der historischen Tessie-Fahrten
// warten müssen; die Historie füllt sich danach sukzessive rückwärts auf.
const DEFAULT_MAX_POINTS_PER_CYCLE = 500;

export interface ElevationSyncResult {
  pointsFilled: number;
}

interface PendingPoint {
  id: number;
  lat: number;
  lon: number;
}

/**
 * Füllt fehlende route_points.elevation_m über die Open-Meteo Elevation API
 * nach. Kein Watermark nötig (kein Zeitfenster) — Fortschritt ergibt sich
 * direkt daraus, dass elevation_m nach dem Füllen nicht mehr NULL ist,
 * spätere Zyklen holen also automatisch nur noch die verbleibenden Punkte
 * (idempotent). Failure-soft: schlägt die API fehl, wird der Fehler in
 * sync_state protokolliert und der nächste Tick versucht es erneut.
 */
// Nach einem 429 (Rate-Limit) pausiert die Elevation-Anreicherung, statt
// jede Minute erneut anzuklopfen. Eskalierend (15 min → ×4 bis 12 h), weil
// Open-Meteo auch Tageslimits kennt — die Wetter-Card hängt an derselben
// IP-Quote, Dauerfeuer legt sonst beide Features lahm.
const RATE_LIMIT_BACKOFF_START_MS = 15 * 60 * 1000;
const RATE_LIMIT_BACKOFF_MAX_MS = 12 * 60 * 60 * 1000;
let backoffMs = RATE_LIMIT_BACKOFF_START_MS;
let backoffUntil = 0;

export async function syncElevations(
  db: Db,
  maxPointsPerCycle = DEFAULT_MAX_POINTS_PER_CYCLE,
): Promise<ElevationSyncResult> {
  if (Date.now() < backoffUntil) {
    return { pointsFilled: 0 };
  }
  try {
    const pending = await loadPendingPoints(db, maxPointsPerCycle);

    let pointsFilled = 0;
    for (let i = 0; i < pending.length; i += COORDS_PER_REQUEST) {
      const chunk = pending.slice(i, i + COORDS_PER_REQUEST);
      const elevations = await fetchElevations(chunk);

      for (let j = 0; j < chunk.length; j++) {
        const elevationM = elevations[j];
        if (elevationM == null) continue;
        await db
          .update(routePoints)
          .set({ elevationM })
          .where(eq(routePoints.id, chunk[j]!.id));
        pointsFilled++;
      }

      if (i + COORDS_PER_REQUEST < pending.length) {
        await sleep(PAUSE_MS);
      }
    }

    backoffMs = RATE_LIMIT_BACKOFF_START_MS;
    await recordSyncRun(db, SOURCE, ENTITY, {
      status: "ok",
      rowsUpserted: pointsFilled,
    });
    return { pointsFilled };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("HTTP 429")) {
      backoffUntil = Date.now() + backoffMs;
      console.warn(
        `[sync:elevation] Open-Meteo Rate-Limit — pausiere ${Math.round(backoffMs / 60000)} min`,
      );
      backoffMs = Math.min(backoffMs * 4, RATE_LIMIT_BACKOFF_MAX_MS);
    }
    await recordSyncRun(db, SOURCE, ENTITY, {
      status: "error",
      error: message,
      rowsUpserted: 0,
    });
    // Failure-soft: Sync-Zyklus soll trotzdem weiterlaufen (kein throw).
    return { pointsFilled: 0 };
  }
}

/**
 * Lädt Route-Punkte ohne Höhenwert, neueste Fahrten zuerst (join über
 * drives.start_time DESC), begrenzt auf maxPointsPerCycle pro Zyklus.
 */
async function loadPendingPoints(
  db: Db,
  maxPointsPerCycle: number,
): Promise<PendingPoint[]> {
  const rows = await db
    .select({
      id: routePoints.id,
      lat: routePoints.lat,
      lon: routePoints.lon,
    })
    .from(routePoints)
    .innerJoin(drives, eq(routePoints.driveId, drives.id))
    .where(isNull(routePoints.elevationM))
    .orderBy(desc(drives.startTime), asc(routePoints.ts))
    .limit(maxPointsPerCycle);
  return rows;
}

/** GET .../elevation?latitude=lat1,lat2,...&longitude=lon1,lon2,... */
async function fetchElevations(points: PendingPoint[]): Promise<(number | null)[]> {
  const url = new URL(OPEN_METEO_URL);
  url.searchParams.set("latitude", points.map((p) => p.lat).join(","));
  url.searchParams.set("longitude", points.map((p) => p.lon).join(","));

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Open-Meteo Elevation API: HTTP ${res.status}`);
  }
  const body = (await res.json()) as { elevation?: number[] };
  if (!Array.isArray(body.elevation)) {
    throw new Error("Open-Meteo Elevation API: unerwartete Antwort (kein elevation-Array)");
  }
  return body.elevation;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
