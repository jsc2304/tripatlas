import { places, type Db } from "@tripatlas/db";
import type { MatchablePlace } from "@tripatlas/core";

/** Lädt alle Places einmal pro Sync-Zyklus (In-Memory-Matching, kein PostGIS). */
export async function loadMatchablePlaces(db: Db): Promise<MatchablePlace[]> {
  return db
    .select({
      id: places.id,
      lat: places.lat,
      lon: places.lon,
      radiusM: places.radiusM,
    })
    .from(places);
}
