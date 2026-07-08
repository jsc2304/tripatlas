import { and, eq, ne, or, isNull, isNotNull } from "drizzle-orm";
import { chargeSessions, drives, parkSessions, type Db } from "@tripatlas/db";
import { matchPlace } from "@tripatlas/core";
import { loadMatchablePlaces } from "./places.js";

export interface RematchResult {
  drivesUpdated: number;
  chargesUpdated: number;
  parksUpdated: number;
}

/**
 * Rechnet alle Place-Zuordnungen neu (nach Anlegen/Ändern/Löschen von Places).
 * Gelockte Zuordnungen (manuelle Korrekturen) bleiben unangetastet.
 * Datenmengen sind single-user-klein — Rechnen in TS statt SQL-Haversine.
 */
export async function rematchPlaces(db: Db): Promise<RematchResult> {
  const matchable = await loadMatchablePlaces(db);
  let drivesUpdated = 0;
  let chargesUpdated = 0;
  let parksUpdated = 0;

  // Drives: Start- und End-Place getrennt gelockt
  const allDrives = await db
    .select({
      id: drives.id,
      startLat: drives.startLat,
      startLon: drives.startLon,
      endLat: drives.endLat,
      endLon: drives.endLon,
      startPlaceId: drives.startPlaceId,
      endPlaceId: drives.endPlaceId,
      startPlaceLocked: drives.startPlaceLocked,
      endPlaceLocked: drives.endPlaceLocked,
    })
    .from(drives);
  for (const d of allDrives) {
    const updates: Partial<{ startPlaceId: number | null; endPlaceId: number | null }> = {};
    if (!d.startPlaceLocked) {
      const match = matchPlace(d.startLat, d.startLon, matchable);
      if (match !== d.startPlaceId) updates.startPlaceId = match;
    }
    if (!d.endPlaceLocked) {
      const match = matchPlace(d.endLat, d.endLon, matchable);
      if (match !== d.endPlaceId) updates.endPlaceId = match;
    }
    if (Object.keys(updates).length > 0) {
      await db.update(drives).set(updates).where(eq(drives.id, d.id));
      drivesUpdated++;
    }
  }

  const rematchSimple = async (
    table: typeof chargeSessions | typeof parkSessions,
  ): Promise<number> => {
    const rows = await db
      .select({
        id: table.id,
        lat: table.lat,
        lon: table.lon,
        placeId: table.placeId,
      })
      .from(table)
      .where(eq(table.placeLocked, false));
    let updated = 0;
    for (const row of rows) {
      const match = matchPlace(row.lat, row.lon, matchable);
      if (match !== row.placeId) {
        await db.update(table).set({ placeId: match }).where(eq(table.id, row.id));
        updated++;
      }
    }
    return updated;
  };

  chargesUpdated = await rematchSimple(chargeSessions);
  parksUpdated = await rematchSimple(parkSessions);

  return { drivesUpdated, chargesUpdated, parksUpdated };
}
