import { eq, inArray } from "drizzle-orm";
import { places, settings, type Db } from "@tripatlas/db";
import type { TeslamateSql } from "../teslamate/client.js";
import { fetchGeofences } from "../teslamate/queries.js";

const SETTINGS_KEY = "geofence_import_done";
const SOURCE = "teslamate_geofence";

export interface GeofenceImportResult {
  imported: number;
}

/**
 * Einmaliger Import der TeslaMate-Geofences als Places. Places sind danach
 * User-Domäne (Name, Typ, Radius frei editierbar) — es wird nie erneut
 * synct, nur der Settings-Flag entscheidet, ob der Import schon lief.
 */
export async function syncGeofenceImport(
  db: Db,
  tm: TeslamateSql,
): Promise<GeofenceImportResult> {
  const done = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, SETTINGS_KEY));
  if (done.length > 0 && done[0]!.value === true) {
    return { imported: 0 };
  }

  const geofences = await fetchGeofences(tm);

  // places hat kein UNIQUE(source, source_id) — Duplikate manuell per
  // Existenz-Check vermeiden statt ON CONFLICT.
  const existing =
    geofences.length > 0
      ? await db
          .select({ sourceId: places.sourceId })
          .from(places)
          .where(
            inArray(
              places.sourceId,
              geofences.map((g) => String(g.id)),
            ),
          )
      : [];
  const existingIds = new Set(existing.map((e) => e.sourceId));

  const toInsert = geofences.filter((g) => !existingIds.has(String(g.id)));

  if (toInsert.length > 0) {
    await db.insert(places).values(
      toInsert.map((g) => ({
        name: g.name,
        type: "other" as const,
        lat: g.latitude,
        lon: g.longitude,
        radiusM: g.radius,
        source: SOURCE,
        sourceId: String(g.id),
      })),
    );
  }

  await db
    .insert(settings)
    .values({ key: SETTINGS_KEY, value: true })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: true, updatedAt: new Date() },
    });

  return { imported: toInsert.length };
}
