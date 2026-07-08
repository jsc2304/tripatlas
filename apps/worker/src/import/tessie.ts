import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import { and, eq, min, sql } from "drizzle-orm";
import {
  chargePoints,
  chargeSessions,
  drives,
  routePoints,
  vehicles,
  type Db,
} from "@tripatlas/db";
import {
  estimateUsablePackKwh,
  lookupNearest,
  matchPlace,
  parseCsvLine,
  segmentCharges,
  segmentDrives,
  type ChargeEpisode,
  type ChargeSample,
  type DriveEpisode,
  type DriveSample,
  type MatchablePlace,
  type PackSample,
} from "@tripatlas/core";
import { loadMatchablePlaces } from "../sync/places.js";

const SOURCE = "tessie";

// Einheiten-Umrechnung beim Ingest (Tessie liefert imperiale Einheiten).
const MI_TO_KM = 1.609344;
const MPH_TO_KMH = 1.609344;

// Lookup-Toleranzen (siehe M24-Vorgabe).
const SOC_TOLERANCE_MS = 10 * 60 * 1000;
const ROUTE_SOC_TOLERANCE_MS = 5 * 60 * 1000;
const ENERGY_TOLERANCE_MS = 10 * 60 * 1000;
const CHARGE_GPS_TOLERANCE_MS = 60 * 60 * 1000;
const CLIMATE_TOLERANCE_MS = 10 * 60 * 1000;

// Downsampling der Punkt-Serien (historische Daten — halber Takt reicht).
const ROUTE_MIN_INTERVAL_MS = 30 * 1000;
const CHARGE_POINT_MIN_INTERVAL_MS = 60 * 1000;
const POINT_CHUNK_SIZE = 500;

const PROGRESS_EVERY = 500;

export interface ImportTessieOptions {
  vehicleId?: number;
}

// --- CSV-Rohserien (kompakte Parallel-Arrays statt 1,6M Objektkopien) --------

interface DrivingData {
  samples: DriveSample[]; // für die Segmentierung
  gpsTs: number[]; // GPS-Positionsserie (für Charge-Standort-Lookup)
  gpsLat: number[];
  gpsLon: number[];
}

interface ChargingData {
  samples: ChargeSample[]; // für die Segmentierung
  levelTs: number[]; // Usable-Battery-Level-Serie (für SoC-Lookups)
  levelVal: number[];
}

interface ClimateData {
  ts: number[];
  outside: (number | null)[];
}

interface BatteryData {
  ts: number[];
  lifetimeKwh: (number | null)[];
  remainingKwh: (number | null)[];
}

// --- Parse-Helfer ------------------------------------------------------------

/** "2023-01-07 20:07:44" (UTC) → epoch ms, oder null bei ungültig. */
function parseTs(s: string | null): number | null {
  if (s == null) return null;
  const ms = Date.parse(`${s.replace(" ", "T")}Z`);
  return Number.isNaN(ms) ? null : ms;
}

function num(s: string | null): number | null {
  if (s == null) return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

/** Streamt eine CSV zeilenweise, überspringt Header und Leerzeilen. */
async function forEachCsvRow(
  filePath: string,
  onRow: (fields: (string | null)[]) => void,
): Promise<void> {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  let first = true;
  for await (const line of rl) {
    if (first) {
      first = false;
      continue; // Header
    }
    if (line.length === 0) continue;
    onRow(parseCsvLine(line));
  }
}

// --- Loader ------------------------------------------------------------------

async function loadDriving(dir: string): Promise<DrivingData> {
  const samples: DriveSample[] = [];
  const gpsTs: number[] = [];
  const gpsLat: number[] = [];
  const gpsLon: number[] = [];
  // Shift-Strings internen (nur eine Handvoll distinct) → Speicher sparen.
  const shiftPool = new Map<string, string>();

  await forEachCsvRow(path.join(dir, "driving_states.csv"), (f) => {
    const ts = parseTs(f[0]);
    const odoMi = num(f[4]);
    if (ts == null || odoMi == null) return; // Odometer ist nie leer; defensiv
    const lat = num(f[1]);
    const lon = num(f[2]);
    let shift = f[3];
    if (shift != null) {
      const pooled = shiftPool.get(shift);
      if (pooled == null) shiftPool.set(shift, shift);
      else shift = pooled;
    }
    const speedMph = num(f[5]);
    samples.push({
      ts,
      lat,
      lon,
      shift,
      odometerKm: odoMi * MI_TO_KM,
      speedKmh: speedMph == null ? null : speedMph * MPH_TO_KMH,
    });
    if (lat != null && lon != null) {
      gpsTs.push(ts);
      gpsLat.push(lat);
      gpsLon.push(lon);
    }
  });

  return { samples, gpsTs, gpsLat, gpsLon };
}

async function loadCharging(dir: string): Promise<ChargingData> {
  const samples: ChargeSample[] = [];
  const levelTs: number[] = [];
  const levelVal: number[] = [];
  const statePool = new Map<string, string>();

  await forEachCsvRow(path.join(dir, "charging_states.csv"), (f) => {
    const ts = parseTs(f[0]);
    if (ts == null) return;
    let state = f[1];
    if (state != null) {
      const pooled = statePool.get(state);
      if (pooled == null) statePool.set(state, state);
      else state = pooled;
    }
    const soc = num(f[2]);
    samples.push({
      ts,
      state,
      soc,
      powerKw: num(f[8]),
      phases: num(f[7]),
      voltage: num(f[9]),
    });
    // Usable-Level-Serie: in praktisch allen Zuständen geloggt, also über die
    // gesamte Historie als SoC-Referenz nutzbar (nicht nur beim Laden).
    if (soc != null) {
      levelTs.push(ts);
      levelVal.push(soc);
    }
  });

  return { samples, levelTs, levelVal };
}

async function loadClimate(dir: string): Promise<ClimateData> {
  const ts: number[] = [];
  const outside: (number | null)[] = [];
  await forEachCsvRow(path.join(dir, "climate_states.csv"), (f) => {
    const t = parseTs(f[0]);
    if (t == null) return;
    ts.push(t);
    outside.push(num(f[3])); // Outside Temp (°C)
  });
  return { ts, outside };
}

async function loadBattery(dir: string): Promise<BatteryData> {
  const ts: number[] = [];
  const lifetimeKwh: (number | null)[] = [];
  const remainingKwh: (number | null)[] = [];
  await forEachCsvRow(path.join(dir, "battery_states.csv"), (f) => {
    const t = parseTs(f[0]);
    if (t == null) return;
    ts.push(t);
    lifetimeKwh.push(num(f[1])); // Lifetime Energy Used (kWh)
    remainingKwh.push(num(f[2])); // Energy Remaining (kWh)
  });
  return { ts, lifetimeKwh, remainingKwh };
}

// --- Fenster-/Lookup-Helfer --------------------------------------------------

/** Mittelwert der Nicht-Null-Werte im Zeitfenster [startMs, endMs]. */
function windowAvg(
  ts: number[],
  vals: (number | null)[],
  startMs: number,
  endMs: number,
): number | null {
  let lo = 0;
  let hi = ts.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (ts[mid]! < startMs) lo = mid + 1;
    else hi = mid;
  }
  let sum = 0;
  let count = 0;
  for (let i = lo; i < ts.length && ts[i]! <= endMs; i++) {
    const v = vals[i];
    if (v != null) {
      sum += v;
      count++;
    }
  }
  return count > 0 ? sum / count : null;
}

/** SoC (%) aus der Usable-Level-Serie am nächstgelegenen Zeitpunkt. */
function nearestSoc(
  data: ChargingData,
  tsMs: number,
  toleranceMs: number,
): number | null {
  const idx = lookupNearest(data.levelTs, tsMs, toleranceMs);
  return idx < 0 ? null : Math.round(data.levelVal[idx]!);
}

// --- Vehicle-Auflösung -------------------------------------------------------

async function resolveVehicleId(db: Db, opts: ImportTessieOptions): Promise<number> {
  if (opts.vehicleId != null) {
    const rows = await db
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(eq(vehicles.id, opts.vehicleId));
    if (rows.length === 0) {
      throw new Error(`Fahrzeug mit id ${opts.vehicleId} existiert nicht.`);
    }
    return rows[0]!.id;
  }
  const rows = await db.select({ id: vehicles.id }).from(vehicles);
  if (rows.length === 0) {
    throw new Error(
      "Keine Fahrzeuge in der DB — erst einen Sync-Zyklus laufen lassen oder --vehicle-id angeben.",
    );
  }
  if (rows.length > 1) {
    throw new Error(
      `Mehrere Fahrzeuge vorhanden (${rows.map((r) => r.id).join(", ")}) — --vehicle-id angeben.`,
    );
  }
  return rows[0]!.id;
}

/** Frühester Start existierender TeslaMate-Fahrten (Overlap-Guard-Grenze). */
async function teslamateStartFloor(db: Db, vehicleId: number): Promise<number | null> {
  const rows = await db
    .select({ min: min(drives.startTime) })
    .from(drives)
    .where(and(eq(drives.source, "teslamate"), eq(drives.vehicleId, vehicleId)));
  const m = rows[0]?.min ?? null;
  return m == null ? null : m.getTime();
}

// --- Drives ------------------------------------------------------------------

function firstGps(samples: DriveSample[]): { lat: number | null; lon: number | null } {
  for (const s of samples) {
    if (s.lat != null && s.lon != null) return { lat: s.lat, lon: s.lon };
  }
  return { lat: null, lon: null };
}

function lastGps(samples: DriveSample[]): { lat: number | null; lon: number | null } {
  for (let i = samples.length - 1; i >= 0; i--) {
    const s = samples[i]!;
    if (s.lat != null && s.lon != null) return { lat: s.lat, lon: s.lon };
  }
  return { lat: null, lon: null };
}

function buildDriveValues(
  ep: DriveEpisode,
  vehicleId: number,
  charging: ChargingData,
  battery: BatteryData,
  climate: ClimateData,
  packKwh: number | null,
  places: MatchablePlace[],
) {
  const start = firstGps(ep.samples);
  const end = lastGps(ep.samples);
  const distanceKm = ep.endOdoKm - ep.startOdoKm;
  const durationSeconds = Math.round((ep.endTs - ep.startTs) / 1000);

  const startSoc = nearestSoc(charging, ep.startTs, SOC_TOLERANCE_MS);
  const endSoc = nearestSoc(charging, ep.endTs, SOC_TOLERANCE_MS);

  let speedMaxKmh: number | null = null;
  for (const s of ep.samples) {
    if (s.speedKmh != null && (speedMaxKmh == null || s.speedKmh > speedMaxKmh)) {
      speedMaxKmh = s.speedKmh;
    }
  }

  // Energie PRIMÄR aus dem Lifetime-Energie-Zähler (Delta über die Fahrt) —
  // exakt, kein Schätzwert. FALLBACK über SoC-Delta × Pack-Kapazität, wenn die
  // Batterie-Serie die Fahrt nicht abdeckt (vor 2024-03-16 oder Lookup-Miss).
  let consumedEnergyKwh: number | null = null;
  let energyIsEstimated = true;
  const startIdx = lookupNearest(battery.ts, ep.startTs, ENERGY_TOLERANCE_MS);
  const endIdx = lookupNearest(battery.ts, ep.endTs, ENERGY_TOLERANCE_MS);
  const startLifetime = startIdx < 0 ? null : battery.lifetimeKwh[startIdx];
  const endLifetime = endIdx < 0 ? null : battery.lifetimeKwh[endIdx];
  if (startLifetime != null && endLifetime != null) {
    consumedEnergyKwh = Math.max(0, endLifetime - startLifetime);
    energyIsEstimated = false;
  } else if (startSoc != null && endSoc != null && packKwh != null) {
    consumedEnergyKwh = Math.max(0, ((startSoc - endSoc) / 100) * packKwh);
    energyIsEstimated = true;
  }

  const avgConsumptionWhKm =
    consumedEnergyKwh != null && distanceKm >= 0.5
      ? (consumedEnergyKwh * 1000) / distanceKm
      : null;

  return {
    vehicleId,
    startTime: new Date(ep.startTs),
    endTime: new Date(ep.endTs),
    startOdometerKm: ep.startOdoKm,
    endOdometerKm: ep.endOdoKm,
    distanceKm,
    durationSeconds,
    startLat: start.lat,
    startLon: start.lon,
    endLat: end.lat,
    endLon: end.lon,
    startPlaceId: matchPlace(start.lat, start.lon, places),
    endPlaceId: matchPlace(end.lat, end.lon, places),
    startSoc,
    endSoc,
    consumedEnergyKwh,
    energyIsEstimated,
    avgConsumptionWhKm,
    outsideTempAvg: windowAvg(climate.ts, climate.outside, ep.startTs, ep.endTs),
    speedMaxKmh: speedMaxKmh == null ? null : Math.round(speedMaxKmh),
    source: SOURCE,
    sourceId: `drive:${new Date(ep.startTs).toISOString()}`,
    syncedAt: new Date(),
  };
}

async function upsertDrive(
  db: Db,
  values: ReturnType<typeof buildDriveValues>,
): Promise<number> {
  const returned = await db
    .insert(drives)
    .values(values)
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
        startPlaceId: sql`CASE WHEN ${drives.startPlaceLocked} THEN ${drives.startPlaceId} ELSE excluded.start_place_id END`,
        endPlaceId: sql`CASE WHEN ${drives.endPlaceLocked} THEN ${drives.endPlaceId} ELSE excluded.end_place_id END`,
        startSoc: sql`excluded.start_soc`,
        endSoc: sql`excluded.end_soc`,
        consumedEnergyKwh: sql`excluded.consumed_energy_kwh`,
        energyIsEstimated: sql`excluded.energy_is_estimated`,
        avgConsumptionWhKm: sql`excluded.avg_consumption_wh_km`,
        outsideTempAvg: sql`excluded.outside_temp_avg`,
        speedMaxKmh: sql`excluded.speed_max_kmh`,
        syncedAt: sql`excluded.synced_at`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: drives.id });
  return returned[0]!.id;
}

/** Route-Punkte einer Fahrt (GPS-Samples, ≥30s ausgedünnt, erster+letzter). */
async function writeRoutePoints(
  db: Db,
  driveId: number,
  ep: DriveEpisode,
  charging: ChargingData,
): Promise<number> {
  const gps = ep.samples.filter((s) => s.lat != null && s.lon != null);
  const kept: DriveSample[] = [];
  if (gps.length > 0) {
    kept.push(gps[0]!);
    let lastKept = gps[0]!;
    for (let i = 1; i < gps.length - 1; i++) {
      const s = gps[i]!;
      if (s.ts - lastKept.ts >= ROUTE_MIN_INTERVAL_MS) {
        kept.push(s);
        lastKept = s;
      }
    }
    const last = gps[gps.length - 1]!;
    if (last !== kept[kept.length - 1]) kept.push(last);
  }

  // Idempotent: alte Punkte der Fahrt löschen und neu schreiben (route_points-Muster).
  await db.delete(routePoints).where(eq(routePoints.driveId, driveId));
  if (kept.length === 0) return 0;

  const values = kept.map((s) => ({
    driveId,
    ts: new Date(s.ts),
    lat: s.lat!,
    lon: s.lon!,
    elevationM: null, // Höhen füllt der Elevation-Backfill nach
    speedKmh: s.speedKmh,
    odometerKm: s.odometerKm,
    soc: nearestSoc(charging, s.ts, ROUTE_SOC_TOLERANCE_MS),
  }));
  for (let i = 0; i < values.length; i += POINT_CHUNK_SIZE) {
    await db.insert(routePoints).values(values.slice(i, i + POINT_CHUNK_SIZE));
  }
  return values.length;
}

// --- Charges -----------------------------------------------------------------

function buildChargeValues(
  ep: ChargeEpisode,
  vehicleId: number,
  driving: DrivingData,
  climate: ClimateData,
  packKwh: number | null,
  places: MatchablePlace[],
) {
  const startSoc = ep.startSoc == null ? null : Math.round(ep.startSoc);
  const endSoc = ep.endSoc == null ? null : Math.round(ep.endSoc);

  // Geladene Energie aus dem SoC-Hub × Pack-Kapazität. Das Leistungsintegral
  // (∫P dt) unterschätzt real um 10–17 % (Ladeverluste/Sampling), daher der
  // SoC-basierte Ansatz.
  const energyAddedKwh =
    startSoc != null && endSoc != null && packKwh != null
      ? Math.max(0, ((endSoc - startSoc) / 100) * packKwh)
      : null;

  // Standort: nächstes GPS-Sample der Fahr-Serie (±60 min) — charging_states
  // selbst hat keine Koordinaten.
  const gpsIdx = lookupNearest(driving.gpsTs, ep.startTs, CHARGE_GPS_TOLERANCE_MS);
  const lat = gpsIdx < 0 ? null : driving.gpsLat[gpsIdx]!;
  const lon = gpsIdx < 0 ? null : driving.gpsLon[gpsIdx]!;

  return {
    vehicleId,
    startTime: new Date(ep.startTs),
    endTime: new Date(ep.endTs),
    lat,
    lon,
    placeId: matchPlace(lat, lon, places),
    startSoc,
    endSoc,
    energyAddedKwh,
    energyUsedKwh: null,
    maxPowerKw: ep.maxPowerKw,
    avgPowerKw: ep.avgPowerKw,
    chargerType: ep.chargerType,
    outsideTempAvg: windowAvg(climate.ts, climate.outside, ep.startTs, ep.endTs),
    durationSeconds: Math.round((ep.endTs - ep.startTs) / 1000),
    // cost/currency/notes sind user-owned — hier nur beim INSERT als null gesetzt.
    cost: null,
    currency: null,
    source: SOURCE,
    sourceId: `charge:${new Date(ep.startTs).toISOString()}`,
    syncedAt: new Date(),
  };
}

async function upsertCharge(
  db: Db,
  values: ReturnType<typeof buildChargeValues>,
): Promise<number> {
  const returned = await db
    .insert(chargeSessions)
    .values(values)
    .onConflictDoUpdate({
      target: [chargeSessions.source, chargeSessions.sourceId],
      // Nur synced Spalten — cost, currency, notes, place-Lock bleiben unangetastet.
      set: {
        vehicleId: sql`excluded.vehicle_id`,
        startTime: sql`excluded.start_time`,
        endTime: sql`excluded.end_time`,
        lat: sql`excluded.lat`,
        lon: sql`excluded.lon`,
        placeId: sql`CASE WHEN ${chargeSessions.placeLocked} THEN ${chargeSessions.placeId} ELSE excluded.place_id END`,
        startSoc: sql`excluded.start_soc`,
        endSoc: sql`excluded.end_soc`,
        energyAddedKwh: sql`excluded.energy_added_kwh`,
        energyUsedKwh: sql`excluded.energy_used_kwh`,
        maxPowerKw: sql`excluded.max_power_kw`,
        avgPowerKw: sql`excluded.avg_power_kw`,
        chargerType: sql`excluded.charger_type`,
        outsideTempAvg: sql`excluded.outside_temp_avg`,
        durationSeconds: sql`excluded.duration_seconds`,
        syncedAt: sql`excluded.synced_at`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: chargeSessions.id });
  return returned[0]!.id;
}

/** Ladekurve (Leistungssamples, ≥60s ausgedünnt, erster+letzter). */
async function writeChargePoints(
  db: Db,
  chargeSessionId: number,
  ep: ChargeEpisode,
  climate: ClimateData,
): Promise<number> {
  const src = ep.samples;
  const kept: ChargeSample[] = [];
  if (src.length > 0) {
    kept.push(src[0]!);
    let lastKept = src[0]!;
    for (let i = 1; i < src.length - 1; i++) {
      const s = src[i]!;
      if (s.ts - lastKept.ts >= CHARGE_POINT_MIN_INTERVAL_MS) {
        kept.push(s);
        lastKept = s;
      }
    }
    const last = src[src.length - 1]!;
    if (last !== kept[kept.length - 1]) kept.push(last);
  }

  await db
    .delete(chargePoints)
    .where(eq(chargePoints.chargeSessionId, chargeSessionId));
  if (kept.length === 0) return 0;

  const values = kept.map((s) => {
    const cIdx = lookupNearest(climate.ts, s.ts, CLIMATE_TOLERANCE_MS);
    return {
      chargeSessionId,
      ts: new Date(s.ts),
      powerKw: s.powerKw,
      soc: s.soc == null ? null : Math.round(s.soc),
      outsideTemp: cIdx < 0 ? null : climate.outside[cIdx],
    };
  });
  for (let i = 0; i < values.length; i += POINT_CHUNK_SIZE) {
    await db.insert(chargePoints).values(values.slice(i, i + POINT_CHUNK_SIZE));
  }
  return values.length;
}

// --- Orchestrierung ----------------------------------------------------------

export interface ImportTessieResult {
  drivesImported: number;
  chargesImported: number;
  routePointsImported: number;
  chargePointsImported: number;
  drivesSkipped: number;
  chargesSkipped: number;
  packKwh: number | null;
  totalKm: number;
  minTs: number | null;
  maxTs: number | null;
}

export async function importTessie(
  db: Db,
  dir: string,
  opts: ImportTessieOptions = {},
): Promise<ImportTessieResult> {
  console.log(`[import-tessie] lade CSVs aus ${dir} …`);
  const [driving, charging, climate, battery] = await Promise.all([
    loadDriving(dir),
    loadCharging(dir),
    loadClimate(dir),
    loadBattery(dir),
  ]);
  console.log(
    `[import-tessie] geladen: ${driving.samples.length} driving, ` +
      `${charging.samples.length} charging, ${climate.ts.length} climate, ` +
      `${battery.ts.length} battery samples`,
  );

  const vehicleId = await resolveVehicleId(db, opts);

  // Pack-Kapazität aus Batterie-Samples, gepaart mit dem nächstgelegenen
  // Usable-Level (±5 min) — battery_states enthält kein SoC.
  const packSamples: PackSample[] = [];
  for (let i = 0; i < battery.ts.length; i++) {
    const remaining = battery.remainingKwh[i];
    if (remaining == null) continue;
    const levelIdx = lookupNearest(charging.levelTs, battery.ts[i]!, ROUTE_SOC_TOLERANCE_MS);
    if (levelIdx < 0) continue;
    packSamples.push({
      usableLevel: charging.levelVal[levelIdx]!,
      energyRemainingKwh: remaining,
    });
  }
  const packKwh = estimateUsablePackKwh(packSamples);
  console.log(
    `[import-tessie] Pack-Kapazität geschätzt: ${packKwh == null ? "—" : `${packKwh.toFixed(1)} kWh`} ` +
      `(aus ${packSamples.length} Samples)`,
  );

  const floor = await teslamateStartFloor(db, vehicleId);
  const places = await loadMatchablePlaces(db);

  const driveEpisodes = segmentDrives(driving.samples);
  const chargeEpisodes = segmentCharges(charging.samples);
  console.log(
    `[import-tessie] segmentiert: ${driveEpisodes.length} Fahrt-, ` +
      `${chargeEpisodes.length} Lade-Episoden`,
  );

  let drivesImported = 0;
  let routePointsImported = 0;
  let drivesSkipped = 0;
  let totalKm = 0;
  let minTs: number | null = null;
  let maxTs: number | null = null;

  for (const ep of driveEpisodes) {
    // Overlap-Guard: keine Rekonstruktion in den TeslaMate-Zeitraum hinein.
    if (floor != null && ep.startTs >= floor) {
      drivesSkipped++;
      continue;
    }
    const values = buildDriveValues(ep, vehicleId, charging, battery, climate, packKwh, places);
    const driveId = await upsertDrive(db, values);
    routePointsImported += await writeRoutePoints(db, driveId, ep, charging);
    drivesImported++;
    totalKm += ep.endOdoKm - ep.startOdoKm;
    minTs = minTs == null ? ep.startTs : Math.min(minTs, ep.startTs);
    maxTs = maxTs == null ? ep.endTs : Math.max(maxTs, ep.endTs);
    if (drivesImported % PROGRESS_EVERY === 0) {
      console.log(`[import-tessie] … ${drivesImported} Fahrten importiert`);
    }
  }

  let chargesImported = 0;
  let chargePointsImported = 0;
  let chargesSkipped = 0;

  for (const ep of chargeEpisodes) {
    if (floor != null && ep.startTs >= floor) {
      chargesSkipped++;
      continue;
    }
    const values = buildChargeValues(ep, vehicleId, driving, climate, packKwh, places);
    const chargeSessionId = await upsertCharge(db, values);
    chargePointsImported += await writeChargePoints(db, chargeSessionId, ep, climate);
    chargesImported++;
  }

  const result: ImportTessieResult = {
    drivesImported,
    chargesImported,
    routePointsImported,
    chargePointsImported,
    drivesSkipped,
    chargesSkipped,
    packKwh,
    totalKm,
    minTs,
    maxTs,
  };

  console.log(
    `[import-tessie] fertig: ${drivesImported} Fahrten, ${chargesImported} Ladevorgänge, ` +
      `${routePointsImported} Route-Punkte, ${chargePointsImported} Ladekurven-Punkte importiert` +
      (drivesSkipped > 0 || chargesSkipped > 0
        ? ` (übersprungen: ${drivesSkipped} Fahrten, ${chargesSkipped} Ladevorgänge im TeslaMate-Zeitraum)`
        : "") +
      `; Strecke ≈ ${Math.round(totalKm)} km; Zeitraum ` +
      `${minTs == null ? "—" : new Date(minTs).toISOString()} → ` +
      `${maxTs == null ? "—" : new Date(maxTs).toISOString()}`,
  );

  return result;
}
