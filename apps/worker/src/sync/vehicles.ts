import { and, eq, sql } from "drizzle-orm";
import { syncState, vehicles, type Db } from "@tripatlas/db";
import type { TeslamateSql } from "../teslamate/client.js";
import { fetchCars } from "../teslamate/queries.js";

export interface VehicleRef {
  id: number;
  /** Effektive Effizienz: TeslaMate-gelernt, sonst User-Override (Vision §15.3). */
  efficiencyKwhPerKm: number | null;
}

/**
 * Synct TeslaMate-Fahrzeuge und liefert die Map TeslaMate-car_id → Vehicle,
 * die der Drive-/Charge-Sync für FK-Auflösung und Energie-Schätzung braucht.
 */
export async function syncVehicles(
  db: Db,
  tm: TeslamateSql,
): Promise<Map<number, VehicleRef>> {
  const cars = await fetchCars(tm);
  const map = new Map<number, VehicleRef>();

  for (const car of cars) {
    const previous = await db
      .select({
        efficiencyKwhPerKm: vehicles.efficiencyKwhPerKm,
        efficiencyOverrideKwhPerKm: vehicles.efficiencyOverrideKwhPerKm,
      })
      .from(vehicles)
      .where(
        and(eq(vehicles.source, "teslamate"), eq(vehicles.sourceId, String(car.id))),
      );

    const synced = {
      displayName: car.name ?? `Tesla ${car.model ?? ""}`.trim(),
      vin: car.vin,
      model: car.model,
      trimBadging: car.trim_badging,
      efficiencyKwhPerKm: car.efficiency,
      updatedAt: sql`now()`,
    };
    const rows = await db
      .insert(vehicles)
      .values({
        displayName: synced.displayName,
        vin: car.vin,
        model: car.model,
        trimBadging: car.trim_badging,
        efficiencyKwhPerKm: car.efficiency,
        source: "teslamate",
        sourceId: String(car.id),
      })
      .onConflictDoUpdate({
        target: [vehicles.source, vehicles.sourceId],
        set: synced,
      })
      .returning({ id: vehicles.id });
    // Effektive Effizienz: TeslaMate-gelernt gewinnt (fahrzeugspezifisch),
    // sonst der User-Override aus den Settings (Vision §15.3 Fallback).
    const override = previous[0]?.efficiencyOverrideKwhPerKm ?? null;
    const effective = car.efficiency ?? override;
    map.set(car.id, {
      id: rows[0]!.id,
      efficiencyKwhPerKm: effective,
    });

    // TeslaMate lernt die Effizienz erst aus vollständigen Ladevorgängen —
    // frische Installationen liefern anfangs NULL und alle Energie-Ableitungen
    // bleiben leer. Ändert sich die effektive Effizienz (TeslaMate lernt oder
    // Override greift erstmals), Watermark zurücksetzen: der nächste Drive-Sync
    // rechnet dann alle Fahrten rückwirkend neu (Annotationen überleben,
    // Upsert fasst nur synced Spalten an). Der Override-Fall selbst wird von
    // der Settings-Action getriggert — hier geht es um TeslaMate-Änderungen.
    const prevEffective = previous[0]?.efficiencyKwhPerKm ?? override;
    if (previous.length > 0 && car.efficiency != null && prevEffective !== car.efficiency) {
      await db
        .update(syncState)
        .set({ watermarkTs: null })
        .where(and(eq(syncState.source, "teslamate"), eq(syncState.entity, "drives")));
      console.log(
        `[sync:vehicles] Effizienz für "${synced.displayName}" jetzt ${car.efficiency} kWh/km ` +
          `(vorher ${prevEffective ?? "unbekannt"}) — voller Drive-Re-Sync zur Energie-Neuberechnung ausgelöst`,
      );
    }
  }

  return map;
}
