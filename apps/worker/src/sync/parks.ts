import { and, eq, notInArray, sql } from "drizzle-orm";
import { drives, parkSessions, vehicles, type Db } from "@tripatlas/db";
import {
  deriveParkSessions,
  matchPlace,
  type MatchablePlace,
  type ParkInput,
} from "@tripatlas/core";
import { recordSyncRun } from "./state.js";

const SOURCE = "derived";
const ENTITY = "parks";

export interface ParkSyncResult {
  upserted: number;
  deleted: number;
}

/**
 * Leitet Park-Sessions aus den bereits gesyncten Fahrten ab (pro Fahrzeug —
 * 139 Fahrten insgesamt sind trivial, kein Watermark nötig). Läuft nach jedem
 * Drive-Sync, damit nachträglich reparierte/gelöschte Fahrten die Parks
 * konsistent nachziehen.
 */
export async function syncParks(
  db: Db,
  matchablePlaces: MatchablePlace[],
): Promise<ParkSyncResult> {
  try {
    const allVehicles = await db.select({ id: vehicles.id }).from(vehicles);

    let upserted = 0;
    let deleted = 0;

    for (const vehicle of allVehicles) {
      const vehicleDrives = await db
        .select({
          sourceId: drives.sourceId,
          startTime: drives.startTime,
          endTime: drives.endTime,
          endLat: drives.endLat,
          endLon: drives.endLon,
          endAddress: drives.endAddress,
          startOdometerKm: drives.startOdometerKm,
          endOdometerKm: drives.endOdometerKm,
        })
        .from(drives)
        .where(eq(drives.vehicleId, vehicle.id))
        .orderBy(drives.startTime);

      const input: ParkInput[] = vehicleDrives.map((d) => ({
        sourceId: d.sourceId,
        startTime: d.startTime,
        endTime: d.endTime,
        endLat: d.endLat,
        endLon: d.endLon,
        endAddress: d.endAddress,
        // Odometer für den Phantom-Park-Schutz (ungeloggte Fahrstrecke zwischen
        // zwei Fahrten, z.B. die Tessie→TeslaMate-Lücke).
        endOdometerKm: d.endOdometerKm,
        startOdometerKm: d.startOdometerKm,
      }));

      const derivedParks = deriveParkSessions(input);

      if (derivedParks.length > 0) {
        const values = derivedParks.map((p) => ({
          vehicleId: vehicle.id,
          startTime: p.startTime,
          endTime: p.endTime,
          lat: p.lat,
          lon: p.lon,
          address: p.address,
          placeId: matchPlace(p.lat, p.lon, matchablePlaces),
          durationSeconds: p.durationSeconds,
          source: SOURCE,
          sourceId: p.sourceId,
          syncedAt: new Date(),
        }));

        await db
          .insert(parkSessions)
          .values(values)
          .onConflictDoUpdate({
            target: [parkSessions.source, parkSessions.sourceId],
            // Nur synced Spalten — placeLocked (user-owned) bleibt unangetastet.
            set: {
              vehicleId: sql`excluded.vehicle_id`,
              startTime: sql`excluded.start_time`,
              endTime: sql`excluded.end_time`,
              lat: sql`excluded.lat`,
              lon: sql`excluded.lon`,
              address: sql`excluded.address`,
              // Gelockte Place-Zuordnung behält den bestehenden Wert (user-owned).
              placeId: sql`CASE WHEN ${parkSessions.placeLocked} THEN ${parkSessions.placeId} ELSE excluded.place_id END`,
              durationSeconds: sql`excluded.duration_seconds`,
              syncedAt: sql`excluded.synced_at`,
              updatedAt: sql`now()`,
            },
          });
        upserted += values.length;
      }

      // Fahrten wurden nachträglich gemergt/gelöscht → verwaiste derived Parks
      // dieses Fahrzeugs entfernen (sourceId wird nicht mehr produziert).
      const currentSourceIds = derivedParks.map((p) => p.sourceId);
      const deleteResult =
        currentSourceIds.length > 0
          ? await db
              .delete(parkSessions)
              .where(
                and(
                  eq(parkSessions.source, SOURCE),
                  eq(parkSessions.vehicleId, vehicle.id),
                  notInArray(parkSessions.sourceId, currentSourceIds),
                ),
              )
              .returning({ id: parkSessions.id })
          : await db
              .delete(parkSessions)
              .where(
                and(
                  eq(parkSessions.source, SOURCE),
                  eq(parkSessions.vehicleId, vehicle.id),
                ),
              )
              .returning({ id: parkSessions.id });
      deleted += deleteResult.length;
    }

    await recordSyncRun(db, SOURCE, ENTITY, {
      status: "ok",
      rowsUpserted: upserted,
    });
    return { upserted, deleted };
  } catch (err) {
    await recordSyncRun(db, SOURCE, ENTITY, {
      status: "error",
      error: err instanceof Error ? err.message : String(err),
      rowsUpserted: 0,
    });
    throw err;
  }
}
