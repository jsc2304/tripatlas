import { sql } from "drizzle-orm";
import { softwareUpdates, type Db } from "@tripatlas/db";
import type { TeslamateSql } from "../teslamate/client.js";
import { fetchUpdates, type TmUpdate } from "../teslamate/queries.js";
import { recordSyncRun } from "./state.js";
import type { VehicleRef } from "./vehicles.js";

const SOURCE = "teslamate";
const ENTITY = "software_updates";

export interface SoftwareUpdatesSyncResult {
  upserted: number;
}

/**
 * Synct die Software-Update-Historie aus TeslaMate `updates`. Winzige
 * Tabelle — kompletter Fetch jeden Zyklus, kein Watermark nötig.
 */
export async function syncSoftwareUpdates(
  db: Db,
  tm: TeslamateSql,
  vehicleMap: Map<number, VehicleRef>,
): Promise<SoftwareUpdatesSyncResult> {
  try {
    const rows = await fetchUpdates(tm);
    const values = rows
      .map((u) => toSoftwareUpdateValues(u, vehicleMap))
      .filter((v) => v !== null);

    if (values.length > 0) {
      await db
        .insert(softwareUpdates)
        .values(values)
        .onConflictDoUpdate({
          target: [softwareUpdates.source, softwareUpdates.sourceId],
          set: {
            vehicleId: sql`excluded.vehicle_id`,
            version: sql`excluded.version`,
            startTime: sql`excluded.start_time`,
            endTime: sql`excluded.end_time`,
            syncedAt: sql`excluded.synced_at`,
          },
        });
    }

    await recordSyncRun(db, SOURCE, ENTITY, {
      status: "ok",
      rowsUpserted: values.length,
    });
    return { upserted: values.length };
  } catch (err) {
    await recordSyncRun(db, SOURCE, ENTITY, {
      status: "error",
      error: err instanceof Error ? err.message : String(err),
      rowsUpserted: 0,
    });
    throw err;
  }
}

function toSoftwareUpdateValues(u: TmUpdate, vehicleMap: Map<number, VehicleRef>) {
  const vehicle = vehicleMap.get(u.car_id);
  if (!vehicle) {
    console.warn(
      `[sync:softwareUpdates] unbekannte car_id ${u.car_id}, Update ${u.id} übersprungen`,
    );
    return null;
  }

  return {
    vehicleId: vehicle.id,
    version: u.version,
    startTime: u.start_time,
    endTime: u.end_time,
    source: SOURCE,
    sourceId: String(u.id),
    syncedAt: new Date(),
  };
}
