import { eq } from "drizzle-orm";
import { routePoints, type Db } from "@tripatlas/db";
import type { TeslamateSql } from "../teslamate/client.js";
import { fetchPositionsForDrive, type TmPosition } from "../teslamate/queries.js";
import type { UpsertedDriveRef } from "./drives.js";

const CHUNK_SIZE = 500;
// Downsampling: erster und letzter Punkt immer behalten, dazwischen nur Punkte
// mit mindestens 15s Abstand zum zuletzt behaltenen Punkt.
const MIN_INTERVAL_MS = 15 * 1000;

export interface RoutePointsSyncResult {
  drivesProcessed: number;
  pointsInserted: number;
}

/**
 * Lädt Positionsdaten für die in diesem Zyklus upgeserteten (abgeschlossenen)
 * Fahrten und schreibt sie downgesampelt als Route-Punkte. Idempotent pro
 * Fahrt: alte Punkte werden vor dem Insert gelöscht. Kein eigener sync_state-
 * Eintrag — hängt am Drive-Sync huckepack.
 */
export async function syncRoutePoints(
  db: Db,
  tm: TeslamateSql,
  refs: UpsertedDriveRef[],
): Promise<RoutePointsSyncResult> {
  let drivesProcessed = 0;
  let pointsInserted = 0;

  for (const ref of refs) {
    if (ref.endTime == null) continue; // nur abgeschlossene Fahrten haben eine feste Route

    const positions = await fetchPositionsForDrive(
      tm,
      ref.carId,
      ref.startTime,
      ref.endTime,
    );
    const sampled = downsample(positions);

    await db.delete(routePoints).where(eq(routePoints.driveId, ref.tripatlasDriveId));

    if (sampled.length > 0) {
      const values = sampled.map((p) => ({
        driveId: ref.tripatlasDriveId,
        ts: p.date,
        lat: p.latitude,
        lon: p.longitude,
        speedKmh: p.speed,
        odometerKm: p.odometer,
        soc: p.soc,
      }));

      for (let i = 0; i < values.length; i += CHUNK_SIZE) {
        const chunk = values.slice(i, i + CHUNK_SIZE);
        await db.insert(routePoints).values(chunk);
      }
      pointsInserted += values.length;
    }
    drivesProcessed++;
  }

  return { drivesProcessed, pointsInserted };
}

function downsample(positions: TmPosition[]): TmPosition[] {
  if (positions.length === 0) return [];

  const result: TmPosition[] = [positions[0]!];
  let lastKept = positions[0]!;

  for (let i = 1; i < positions.length - 1; i++) {
    const p = positions[i]!;
    if (p.date.getTime() - lastKept.date.getTime() >= MIN_INTERVAL_MS) {
      result.push(p);
      lastKept = p;
    }
  }

  const last = positions[positions.length - 1]!;
  if (last !== result[result.length - 1]) {
    result.push(last);
  }

  return result;
}
