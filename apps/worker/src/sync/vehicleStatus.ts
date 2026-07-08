import { sql } from "drizzle-orm";
import { vehicleStatus, type Db } from "@tripatlas/db";
import type { TeslamateSql } from "../teslamate/client.js";
import { fetchLatestPositions, fetchLatestStates } from "../teslamate/queries.js";
import type { VehicleRef } from "./vehicles.js";

export interface VehicleStatusSyncResult {
  upserted: number;
}

/**
 * Synct pro Fahrzeug die neueste Position + den neuesten State aus TeslaMate
 * in `vehicle_status` — eine Zeile pro Fahrzeug, komplett vom Sync
 * überschrieben (keine user-owned Spalten, kein Watermark nötig: der
 * DISTINCT ON liefert je Zyklus ohnehin nur den aktuellsten Stand).
 * Failure-soft: schlägt es fehl, bleibt die Startseite auf dem letzten Stand
 * stehen statt den ganzen Sync-Zyklus zu kippen.
 */
export async function syncVehicleStatus(
  db: Db,
  tm: TeslamateSql,
  vehicleMap: Map<number, VehicleRef>,
): Promise<VehicleStatusSyncResult> {
  try {
    const [positions, states] = await Promise.all([
      fetchLatestPositions(tm),
      fetchLatestStates(tm),
    ]);

    const positionByCarId = new Map(positions.map((p) => [p.car_id, p]));
    const stateByCarId = new Map(states.map((s) => [s.car_id, s]));

    let upserted = 0;
    const now = new Date();

    for (const [carId, vehicleRef] of vehicleMap) {
      const position = positionByCarId.get(carId);
      const state = stateByCarId.get(carId);
      if (!position && !state) continue;

      const values = {
        vehicleId: vehicleRef.id,
        ts: position?.date ?? null,
        lat: position?.latitude ?? null,
        lon: position?.longitude ?? null,
        soc: position?.soc ?? null,
        ratedRangeKm: position?.rated_range_km ?? null,
        odometerKm: position?.odometer ?? null,
        state: state?.state ?? null,
        stateSince: state?.start_date ?? null,
        tpmsFlBar: position?.tpms_pressure_fl ?? null,
        tpmsFrBar: position?.tpms_pressure_fr ?? null,
        tpmsRlBar: position?.tpms_pressure_rl ?? null,
        tpmsRrBar: position?.tpms_pressure_rr ?? null,
        syncedAt: now,
      };

      await db
        .insert(vehicleStatus)
        .values(values)
        .onConflictDoUpdate({
          target: vehicleStatus.vehicleId,
          set: {
            ts: sql`excluded.ts`,
            lat: sql`excluded.lat`,
            lon: sql`excluded.lon`,
            soc: sql`excluded.soc`,
            ratedRangeKm: sql`excluded.rated_range_km`,
            odometerKm: sql`excluded.odometer_km`,
            state: sql`excluded.state`,
            stateSince: sql`excluded.state_since`,
            tpmsFlBar: sql`excluded.tpms_fl_bar`,
            tpmsFrBar: sql`excluded.tpms_fr_bar`,
            tpmsRlBar: sql`excluded.tpms_rl_bar`,
            tpmsRrBar: sql`excluded.tpms_rr_bar`,
            syncedAt: sql`excluded.synced_at`,
          },
        });
      upserted++;
    }

    return { upserted };
  } catch {
    // Failure-soft: kein throw, kein sync_state-Eintrag nötig (siehe
    // Modul-Kommentar) — nächster Zyklus versucht es erneut.
    return { upserted: 0 };
  }
}
