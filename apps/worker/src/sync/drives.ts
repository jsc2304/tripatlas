import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { drives, type Db } from "@tripatlas/db";
import { deriveDriveEnergy, matchPlace, type MatchablePlace } from "@tripatlas/core";
import type { TeslamateSql } from "../teslamate/client.js";
import {
  fetchCompletedDrivesSince,
  fetchInProgressDrives,
  type TmDrive,
} from "../teslamate/queries.js";
import { getWatermark, recordSyncRun } from "./state.js";
import type { VehicleRef } from "./vehicles.js";

const SOURCE = "teslamate";
const ENTITY = "drives";
// Overlap-Rescan: TeslaMate repariert/merged Fahrten gelegentlich nachträglich.
const OVERLAP_MS = 24 * 60 * 60 * 1000;
const EPOCH = new Date(0);
const CHUNK_SIZE = 200;

export interface DriveSyncResult {
  upserted: number;
  deletedZombies: number;
  upsertedRefs: UpsertedDriveRef[];
}

/** Für den Route-Points-Sync: welche Drives wurden in diesem Zyklus angefasst. */
export interface UpsertedDriveRef {
  tripatlasDriveId: number;
  tmDriveId: number;
  carId: number;
  startTime: Date;
  endTime: Date | null;
}

export async function syncDrives(
  db: Db,
  tm: TeslamateSql,
  vehicleMap: Map<number, VehicleRef>,
  matchablePlaces: MatchablePlace[],
): Promise<DriveSyncResult> {
  try {
    const watermark = (await getWatermark(db, SOURCE, ENTITY)) ?? EPOCH;
    const since = new Date(watermark.getTime() - OVERLAP_MS);

    const completed = await fetchCompletedDrivesSince(tm, since);
    const inProgress = await fetchInProgressDrives(tm);
    const rows = [...completed, ...inProgress];

    let upserted = 0;
    const upsertedRefs: UpsertedDriveRef[] = [];
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const entries = chunk
        .map((d) => {
          const values = toDriveValues(d, vehicleMap, matchablePlaces);
          return values ? { tmDrive: d, values } : null;
        })
        .filter((e) => e !== null);
      if (entries.length === 0) continue;

      const returned = await db
        .insert(drives)
        .values(entries.map((e) => e.values))
        .onConflictDoUpdate({
          target: [drives.source, drives.sourceId],
          // Nur synced Spalten — user-owned Felder (classification, purpose,
          // customer, project, notes, place-Locks) bleiben unangetastet.
          set: {
            vehicleId: sql`excluded.vehicle_id`,
            startTime: sql`excluded.start_time`,
            endTime: sql`excluded.end_time`,
            startOdometerKm: sql`excluded.start_odometer_km`,
            endOdometerKm: sql`excluded.end_odometer_km`,
            distanceKm: sql`excluded.distance_km`,
            durationSeconds: sql`excluded.duration_seconds`,
            startLat: sql`excluded.start_lat`,
            startLon: sql`excluded.start_lon`,
            endLat: sql`excluded.end_lat`,
            endLon: sql`excluded.end_lon`,
            startAddress: sql`excluded.start_address`,
            endAddress: sql`excluded.end_address`,
            // Place-Matching respektiert manuelle Korrekturen: gelockte
            // Zuordnungen behalten den bestehenden Wert (user-owned).
            startPlaceId: sql`CASE WHEN ${drives.startPlaceLocked} THEN ${drives.startPlaceId} ELSE excluded.start_place_id END`,
            endPlaceId: sql`CASE WHEN ${drives.endPlaceLocked} THEN ${drives.endPlaceId} ELSE excluded.end_place_id END`,
            startSoc: sql`excluded.start_soc`,
            endSoc: sql`excluded.end_soc`,
            consumedEnergyKwh: sql`excluded.consumed_energy_kwh`,
            energyIsEstimated: sql`excluded.energy_is_estimated`,
            avgConsumptionWhKm: sql`excluded.avg_consumption_wh_km`,
            ascentM: sql`excluded.ascent_m`,
            descentM: sql`excluded.descent_m`,
            outsideTempAvg: sql`excluded.outside_temp_avg`,
            insideTempAvg: sql`excluded.inside_temp_avg`,
            speedMaxKmh: sql`excluded.speed_max_kmh`,
            powerMaxKw: sql`excluded.power_max_kw`,
            powerMinKw: sql`excluded.power_min_kw`,
            syncedAt: sql`excluded.synced_at`,
            updatedAt: sql`now()`,
          },
        })
        .returning({ id: drives.id, sourceId: drives.sourceId });

      // Reihenfolge von RETURNING bei ON CONFLICT ist nicht garantiert gleich
      // der Insert-Reihenfolge — über sourceId zurückmappen auf den TM-Drive.
      const bySourceId = new Map(entries.map((e) => [e.values.sourceId, e]));
      for (const row of returned) {
        const entry = bySourceId.get(row.sourceId);
        if (!entry) continue;
        upsertedRefs.push({
          tripatlasDriveId: row.id,
          tmDriveId: entry.tmDrive.id,
          carId: entry.tmDrive.car_id,
          startTime: entry.tmDrive.start_time,
          endTime: entry.tmDrive.end_time,
        });
      }
      upserted += entries.length;
    }

    const deletedZombies = await deleteZombieDrives(db, tm, inProgress);

    const watermarkTs =
      completed.length > 0
        ? new Date(
            Math.max(...completed.map((d) => d.end_time!.getTime())),
          )
        : watermark === EPOCH
          ? null
          : watermark;

    await recordSyncRun(db, SOURCE, ENTITY, {
      status: "ok",
      watermarkTs,
      rowsUpserted: upserted,
    });
    return { upserted, deletedZombies, upsertedRefs };
  } catch (err) {
    await recordSyncRun(db, SOURCE, ENTITY, {
      status: "error",
      error: err instanceof Error ? err.message : String(err),
      rowsUpserted: 0,
    });
    throw err;
  }
}

function toDriveValues(
  d: TmDrive,
  vehicleMap: Map<number, VehicleRef>,
  matchablePlaces: MatchablePlace[],
) {
  const vehicle = vehicleMap.get(d.car_id);
  if (!vehicle) {
    console.warn(`[sync:drives] unbekannte car_id ${d.car_id}, Drive ${d.id} übersprungen`);
    return null;
  }

  // Distanz: TeslaMate-eigene GPS-basierte distance bevorzugen, Odometer-Delta
  // zur Plausibilisierung (Vision §15.1: Odometer ist die Abrechnungs-Wahrheit,
  // aber TeslaMates distance ist bereits odometerbasiert berechnet).
  const odoDelta =
    d.start_km != null && d.end_km != null ? d.end_km - d.start_km : null;
  const distanceKm = d.distance ?? odoDelta;
  if (d.distance != null && odoDelta != null && Math.abs(d.distance - odoDelta) > 1) {
    console.warn(
      `[sync:drives] Drive ${d.id}: distance=${d.distance.toFixed(1)} weicht von Odometer-Delta=${odoDelta.toFixed(1)} ab`,
    );
  }

  const durationSeconds =
    d.end_time != null
      ? Math.round((d.end_time.getTime() - d.start_time.getTime()) / 1000)
      : d.duration_min != null
        ? d.duration_min * 60
        : null;

  const energy = deriveDriveEnergy({
    startRatedRangeKm: d.start_rated_range_km,
    endRatedRangeKm: d.end_rated_range_km,
    efficiencyKwhPerKm: vehicle.efficiencyKwhPerKm,
    distanceKm,
  });

  return {
    vehicleId: vehicle.id,
    startTime: d.start_time,
    endTime: d.end_time,
    startOdometerKm: d.start_km,
    endOdometerKm: d.end_km,
    distanceKm,
    durationSeconds,
    startLat: d.start_lat,
    startLon: d.start_lon,
    endLat: d.end_lat,
    endLon: d.end_lon,
    startAddress: d.start_address,
    endAddress: d.end_address,
    startPlaceId: matchPlace(d.start_lat, d.start_lon, matchablePlaces),
    endPlaceId: matchPlace(d.end_lat, d.end_lon, matchablePlaces),
    startSoc: d.start_soc,
    endSoc: d.end_soc,
    consumedEnergyKwh: energy.consumedEnergyKwh,
    energyIsEstimated: energy.isEstimated,
    avgConsumptionWhKm: energy.avgConsumptionWhKm,
    ascentM: d.ascent,
    descentM: d.descent,
    outsideTempAvg: d.outside_temp_avg,
    insideTempAvg: d.inside_temp_avg,
    speedMaxKmh: d.speed_max,
    powerMaxKw: d.power_max,
    powerMinKw: d.power_min,
    source: SOURCE,
    sourceId: String(d.id),
    syncedAt: new Date(),
  };
}

/**
 * TeslaMate verwirft gelegentlich Fahrten nachträglich (z.B. Rangier-Artefakte).
 * Eine bei uns noch offene Fahrt, die es drüben nicht mehr gibt, wäre sonst für
 * immer "Fahrt läuft…" — solche Zombies werden gelöscht.
 */
async function deleteZombieDrives(
  db: Db,
  tm: TeslamateSql,
  inProgress: TmDrive[],
): Promise<number> {
  const openLocal = await db
    .select({ id: drives.id, sourceId: drives.sourceId })
    .from(drives)
    .where(and(eq(drives.source, SOURCE), isNull(drives.endTime)));
  if (openLocal.length === 0) return 0;

  const stillOpenRemote = new Set(inProgress.map((d) => String(d.id)));
  const candidates = openLocal.filter((r) => !stillOpenRemote.has(r.sourceId));
  if (candidates.length === 0) return 0;

  // Existiert die Fahrt drüben noch (dann wurde sie nur abgeschlossen und der
  // Completed-Sync aktualisiert sie), oder ist sie weg (→ löschen)?
  const remoteIds = await tm<{ id: number }[]>`
    SELECT id FROM drives WHERE id = ANY(${candidates.map((c) => Number(c.sourceId))})
  `;
  const existing = new Set(remoteIds.map((r) => String(r.id)));
  const toDelete = candidates.filter((c) => !existing.has(c.sourceId));
  if (toDelete.length === 0) return 0;

  await db.delete(drives).where(
    inArray(
      drives.id,
      toDelete.map((c) => c.id),
    ),
  );
  console.warn(
    `[sync:drives] ${toDelete.length} von TeslaMate verworfene offene Fahrt(en) entfernt`,
  );
  return toDelete.length;
}
