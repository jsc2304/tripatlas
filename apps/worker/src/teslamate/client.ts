import postgres from "postgres";

export type TeslamateSql = postgres.Sql;

export function createTeslamateClient(url: string): TeslamateSql {
  return postgres(url, {
    max: 2,
    // Wir lesen nur — falls die Rolle doch Schreibrechte hat, schützt das
    // zumindest vor versehentlichen Writes über diese Connection.
    connection: { default_transaction_read_only: true },
  });
}

/**
 * Prüft beim Start, ob die TeslaMate-DB die erwarteten Spalten hat.
 * TeslaMate-Migrationen benennen gelegentlich um — lieber ein klarer
 * Fehler beim Start als stiller Datenmüll.
 */
export async function probeTeslamateSchema(sql: TeslamateSql): Promise<void> {
  const required: Record<string, string[]> = {
    cars: ["id", "name", "vin", "model", "trim_badging", "efficiency"],
    drives: [
      "id",
      "car_id",
      "start_date",
      "end_date",
      "start_km",
      "end_km",
      "distance",
      "duration_min",
      "ascent",
      "descent",
      "start_rated_range_km",
      "end_rated_range_km",
      "start_position_id",
      "end_position_id",
      "start_address_id",
      "end_address_id",
      "start_geofence_id",
      "end_geofence_id",
      "outside_temp_avg",
      "inside_temp_avg",
      "speed_max",
      "power_max",
      "power_min",
    ],
    positions: [
      "id",
      "car_id",
      "latitude",
      "longitude",
      "battery_level",
      "usable_battery_level",
      "date",
      "speed",
      "odometer",
      "tpms_pressure_fl",
      "tpms_pressure_fr",
      "tpms_pressure_rl",
      "tpms_pressure_rr",
    ],
    addresses: ["id", "name", "road", "house_number", "city", "display_name"],
    charging_processes: [
      "id",
      "car_id",
      "start_date",
      "end_date",
      "charge_energy_added",
      "charge_energy_used",
      "start_battery_level",
      "end_battery_level",
      "position_id",
      "address_id",
      "geofence_id",
      "cost",
      "outside_temp_avg",
    ],
    charges: [
      "charging_process_id",
      "charger_power",
      "fast_charger_present",
      "date",
      "battery_level",
      "usable_battery_level",
      "outside_temp",
    ],
    geofences: ["id", "name", "latitude", "longitude", "radius"],
    updates: ["id", "car_id", "start_date", "end_date", "version"],
  };

  const rows = await sql<{ table_name: string; column_name: string }[]>`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
  `;
  const have = new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));

  const missing: string[] = [];
  for (const [table, cols] of Object.entries(required)) {
    for (const col of cols) {
      if (!have.has(`${table}.${col}`)) missing.push(`${table}.${col}`);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `TeslaMate-Schema passt nicht (fehlende Spalten: ${missing.join(", ")}). ` +
        `Vermutlich inkompatible TeslaMate-Version — getestet mit v4.x.`,
    );
  }
}
