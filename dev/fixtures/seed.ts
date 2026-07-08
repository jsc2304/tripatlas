/**
 * Seed script for a fake TeslaMate database, so Tripatlas can be developed
 * without a real car / real TeslaMate instance.
 *
 * Connects via TESLAMATE_DATABASE_URL (defaults to the docker-compose.dev.yml
 * teslamate-db service). Idempotent: truncates the relevant tables (restart
 * identity) before inserting, so re-running produces the same data.
 *
 * Fixture world: one car ("Blitzkarre", Model 3) commuting around Zurich,
 * Switzerland, for ~6 weeks, plus one weekend road trip to Chur.
 *
 * Run with: pnpm db:seed:teslamate  (from repo root)
 *        or: pnpm --filter @tripatlas/fixtures seed
 */
import postgres from "postgres";

const DATABASE_URL =
  process.env.TESLAMATE_DATABASE_URL ??
  "postgres://teslamate:teslamate@localhost:5433/teslamate";

const sql = postgres(DATABASE_URL, { max: 1 });

// ---------------------------------------------------------------------------
// Constants / fixture world
// ---------------------------------------------------------------------------

const EFFICIENCY_KWH_PER_KM = 0.152;
// Rated range consumed per km driven is slightly worse than the "lab"
// efficiency would suggest (climate, elevation, driving style headroom).
const RANGE_DROP_FACTOR = 1.15;
// Nominal battery capacity used to convert rated-range deltas <-> kWh, and to
// derive rated_battery_range_km from battery_level for a fresh full charge.
const BATTERY_CAPACITY_KWH = 57.5; // Model 3 RWD-ish usable capacity
const FULL_RATED_RANGE_KM = 415; // rated range at 100% SoC

const CAR = {
  eid: 1111111111,
  vid: 2222222222,
  vin: "5YJ3E7EA1PF000001",
  name: "Blitzkarre",
  model: "3",
  trim_badging: "74d",
  exterior_color: "DeepBlueMetallic",
  wheel_type: "Aero19",
  efficiency: EFFICIENCY_KWH_PER_KM,
};

type LatLon = { lat: number; lon: number };

const ZUHAUSE: LatLon = { lat: 47.3769, lon: 8.5417 };
const BUERO: LatLon = { lat: 47.3902, lon: 8.5158 };
const KUNDE_MUELLER: LatLon = { lat: 47.4245, lon: 8.606 };
const RASTSTAETTE: LatLon = { lat: 47.175, lon: 8.96 };
const CHUR: LatLon = { lat: 46.8499, lon: 9.533 };
// Local errand stop (supermarket) a few minutes from Zuhause — used for
// short weekend / evening drives so the fixture isn't only commute traffic.
const SUPERMARKT: LatLon = { lat: 47.3701, lon: 8.5322 };

const GEOFENCES = [
  { name: "Zuhause", ...ZUHAUSE, radius: 100 },
  { name: "Büro", ...BUERO, radius: 120 },
  { name: "Kunde Müller", ...KUNDE_MUELLER, radius: 150 },
] as const;

const ADDRESSES = [
  {
    key: "zuhause",
    display_name: "Musterstrasse 1, 8001 Zürich, Schweiz",
    name: "Musterstrasse 1",
    road: "Musterstrasse",
    house_number: "1",
    city: "Zürich",
    postcode: "8001",
    state: "Zürich",
    country: "Schweiz",
    ...ZUHAUSE,
  },
  {
    key: "buero",
    display_name: "Bahnhofstrasse 50, 8001 Zürich, Schweiz",
    name: "Bahnhofstrasse 50",
    road: "Bahnhofstrasse",
    house_number: "50",
    city: "Zürich",
    postcode: "8001",
    state: "Zürich",
    country: "Schweiz",
    ...BUERO,
  },
  {
    key: "kunde",
    display_name: "Industriestrasse 12, 8600 Dübendorf, Schweiz",
    name: "Industriestrasse 12",
    road: "Industriestrasse",
    house_number: "12",
    city: "Dübendorf",
    postcode: "8600",
    state: "Zürich",
    country: "Schweiz",
    ...KUNDE_MUELLER,
  },
  {
    key: "raststaette",
    display_name: "Raststätte Neuhaus, A3, 8855 Neuhaus SZ, Schweiz",
    name: "Raststätte Neuhaus",
    road: "A3",
    house_number: null,
    city: "Neuhaus",
    postcode: "8855",
    state: "Schwyz",
    country: "Schweiz",
    ...RASTSTAETTE,
  },
  {
    key: "chur",
    display_name: "Bahnhofplatz 3, 7000 Chur, Schweiz",
    name: "Bahnhofplatz 3",
    road: "Bahnhofplatz",
    house_number: "3",
    city: "Chur",
    postcode: "7000",
    state: "Graubünden",
    country: "Schweiz",
    ...CHUR,
  },
  {
    key: "supermarkt",
    display_name: "Coop Supermarkt, Seebahnstrasse 8, 8004 Zürich, Schweiz",
    name: "Coop Supermarkt",
    road: "Seebahnstrasse",
    house_number: "8",
    city: "Zürich",
    postcode: "8004",
    state: "Zürich",
    country: "Schweiz",
    ...SUPERMARKT,
  },
] as const;

// ---------------------------------------------------------------------------
// Date range: 6 full weeks (Mon-Fri commuting pattern), ending "yesterday".
// ---------------------------------------------------------------------------

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function atTime(day: Date, hh: number, mm: number): Date {
  const r = new Date(day);
  r.setHours(hh, mm, 0, 0);
  return r;
}

const now = new Date();
const yesterday = startOfDay(addDays(now, -1));
// Monday of the week containing "yesterday"
const endWeekMonday = addDays(yesterday, -(((yesterday.getDay() + 6) % 7)));
const startMonday = addDays(endWeekMonday, -5 * 7); // 6 weeks total incl. end week

const WEEKS = 6;
const weekMondays = Array.from({ length: WEEKS }, (_, i) =>
  addDays(startMonday, i * 7),
);

// Weekend road trip: Saturday of the 3rd week (0-indexed week 2)
const weekendMonday = weekMondays[2];
const weekendSaturday = addDays(weekendMonday, 5);
const weekendSunday = addDays(weekendMonday, 6);

// Software-Update-Historie (TeslaMate `updates`): drei Updates über die
// 6-Wochen-Fixture verteilt, jeweils an einem frühen Morgen (Fahrzeug parkt
// zuhause) installiert. Reicht bis zur letzten vollen Woche, damit auch ein
// "offenes" Update (end_date NULL, gerade angestoßen) getestet werden kann.
const SOFTWARE_UPDATES = [
  { monday: weekMondays[0]!, dayOffset: 2, version: "2024.14.9", durationMin: 35 },
  { monday: weekMondays[2]!, dayOffset: 3, version: "2024.20.1", durationMin: 40 },
  { monday: weekMondays[4]!, dayOffset: 1, version: "2024.26.3", durationMin: 30 },
  // Neuestes Update: noch "laufend" (end_date NULL) am letzten Fixture-Tag.
  { monday: weekMondays[5]!, dayOffset: 4, version: "2024.32.7", durationMin: null },
] as const;

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineKm(a: LatLon, b: LatLon): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Simple seeded PRNG (mulberry32) for reproducible jitter.
function makeRng(seed: number) {
  let a = seed;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = makeRng(42);

function jitter(scale: number): number {
  return (rng() - 0.5) * 2 * scale;
}

// Nominal cold tire pressure for a Model 3 (bar) — front slightly lower than
// rear is typical. Small per-reading jitter so values aren't perfectly flat.
const TPMS_FRONT_BAR = 2.9;
const TPMS_REAR_BAR = 2.9;

function tpmsReading(): Pick<
  PositionRow,
  "tpms_pressure_fl" | "tpms_pressure_fr" | "tpms_pressure_rl" | "tpms_pressure_rr"
> {
  return {
    tpms_pressure_fl: Number((TPMS_FRONT_BAR + jitter(0.05)).toFixed(2)),
    tpms_pressure_fr: Number((TPMS_FRONT_BAR + jitter(0.05)).toFixed(2)),
    tpms_pressure_rl: Number((TPMS_REAR_BAR + jitter(0.05)).toFixed(2)),
    tpms_pressure_rr: Number((TPMS_REAR_BAR + jitter(0.05)).toFixed(2)),
  };
}

// Interpolate along a great-circle-ish path with a slight bow (so it isn't a
// perfectly straight line), plus small per-point jitter to feel GPS-like.
function interpolatePoint(
  start: LatLon,
  end: LatLon,
  t: number,
  bowSeed: number,
): LatLon {
  const lat = start.lat + (end.lat - start.lat) * t;
  const lon = start.lon + (end.lon - start.lon) * t;
  // Bow perpendicular to the direct line, peaking at t=0.5
  const bow = Math.sin(t * Math.PI) * 0.0006 * bowSeed;
  const dx = end.lon - start.lon;
  const dy = end.lat - start.lat;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const perpLat = -dx / len;
  const perpLon = dy / len;
  return {
    lat: lat + perpLat * bow + jitter(0.00003),
    lon: lon + perpLon * bow + jitter(0.00003),
  };
}

// ---------------------------------------------------------------------------
// In-memory row builders (ids assigned as we go, matching Postgres serials
// since we TRUNCATE ... RESTART IDENTITY before inserting).
// ---------------------------------------------------------------------------

interface PositionRow {
  date: Date;
  latitude: number;
  longitude: number;
  speed: number | null;
  odometer: number;
  ideal_battery_range_km: number;
  rated_battery_range_km: number;
  battery_level: number;
  usable_battery_level: number;
  car_id: number;
  drive_id: number | null;
  tpms_pressure_fl: number;
  tpms_pressure_fr: number;
  tpms_pressure_rl: number;
  tpms_pressure_rr: number;
}

interface DriveRow {
  start_date: Date;
  end_date: Date;
  start_km: number;
  end_km: number;
  distance: number;
  duration_min: number;
  car_id: number;
  start_address_id: number;
  end_address_id: number;
  start_position_id: number;
  end_position_id: number;
  start_geofence_id: number | null;
  end_geofence_id: number | null;
  start_ideal_range_km: number;
  end_ideal_range_km: number;
  start_rated_range_km: number;
  end_rated_range_km: number;
  speed_max: number;
  power_max: number;
  power_min: number;
  outside_temp_avg: number;
  inside_temp_avg: number;
  ascent: number;
  descent: number;
}

interface ChargeRow {
  date: Date;
  battery_level: number;
  usable_battery_level: number;
  charge_energy_added: number;
  charger_power: number;
  charger_phases: number | null;
  charger_voltage: number | null;
  fast_charger_present: boolean;
  ideal_battery_range_km: number;
  rated_battery_range_km: number;
  charging_process_id: number;
  outside_temp: number;
}

interface ChargingProcessRow {
  start_date: Date;
  end_date: Date;
  charge_energy_added: number;
  charge_energy_used: number;
  start_battery_level: number;
  end_battery_level: number;
  duration_min: number;
  car_id: number;
  position_id: number;
  address_id: number | null;
  geofence_id: number | null;
  start_ideal_range_km: number;
  end_ideal_range_km: number;
  start_rated_range_km: number;
  end_rated_range_km: number;
  cost: number | null;
}

// Simulation state, mutated as we walk through time.
let odometer = 24500.0; // km
let batteryLevel = 78; // % SoC, integer as TeslaMate stores smallint
const usableOffset = 0; // usable_battery_level == battery_level (no LFP min-buffer modeling)

function ratedRangeForSoc(soc: number): number {
  return (soc / 100) * FULL_RATED_RANGE_KM;
}
function idealRangeForSoc(soc: number): number {
  // ideal range is typically a bit higher than rated range at the same SoC
  return ratedRangeForSoc(soc) * 1.07;
}

const positions: PositionRow[] = [];
const drives: DriveRow[] = [];
const chargingProcesses: ChargingProcessRow[] = [];
const charges: ChargeRow[] = [];

let positionIdCounter = 0; // 1-based, mirrors serial after TRUNCATE RESTART IDENTITY
let driveIdCounter = 0;
let chargingProcessIdCounter = 0;

const addressIdByKey: Record<string, number> = {
  zuhause: 1,
  buero: 2,
  kunde: 3,
  raststaette: 4,
  chur: 5,
  supermarkt: 6,
};
const geofenceIdByName: Record<string, number> = {
  Zuhause: 1,
  Büro: 2,
  "Kunde Müller": 3,
};

const CAR_ID = 1;

/**
 * Simulate one drive: builds interpolated position rows (~1 every 15s),
 * updates odometer + battery state, and returns the drive row (positions
 * pushed to the shared `positions` array as a side effect).
 */
function simulateDrive(opts: {
  start: Date;
  fromKey: keyof typeof addressIdByKey;
  toKey: keyof typeof addressIdByKey;
  from: LatLon;
  to: LatLon;
  distanceKm: number;
  durationMin: number;
  cruiseSpeedKmh: number;
  startGeofence: string | null;
  endGeofence: string | null;
}): DriveRow {
  const {
    start,
    fromKey,
    toKey,
    from,
    to,
    distanceKm,
    durationMin,
    cruiseSpeedKmh,
    startGeofence,
    endGeofence,
  } = opts;

  const durationSec = durationMin * 60;
  // TeslaMate logs a position roughly every 5-10s while actively driving; we
  // use ~7s so the ~6-week fixture clears a healthy position count without
  // inflating trip counts beyond the described weekly pattern.
  const stepSec = 7;
  const numSteps = Math.max(2, Math.round(durationSec / stepSec));

  const startOdometer = odometer;
  const startBattery = batteryLevel;
  const startIdeal = idealRangeForSoc(startBattery);
  const startRated = ratedRangeForSoc(startBattery);

  // Total rated-range km consumed by this drive.
  const rangeConsumed = distanceKm * RANGE_DROP_FACTOR;
  const socConsumed = (rangeConsumed / FULL_RATED_RANGE_KM) * 100;

  const bowSeed = rng() > 0.5 ? 1 : -1;

  let speedMax = 0;
  let firstPositionId: number | null = null;
  let lastPositionId = 0;

  for (let i = 0; i <= numSteps; i++) {
    const t = i / numSteps;
    const point = interpolatePoint(from, to, t, bowSeed);
    const date = new Date(start.getTime() + t * durationSec * 1000);
    const traveled = distanceKm * t;

    // Speed profile: ramp up, cruise, ramp down.
    let speed: number;
    const ramp = 0.08;
    if (t < ramp) {
      speed = cruiseSpeedKmh * (t / ramp);
    } else if (t > 1 - ramp) {
      speed = cruiseSpeedKmh * ((1 - t) / ramp);
    } else {
      speed = cruiseSpeedKmh;
    }
    speed = Math.max(5, speed + jitter(4));
    speedMax = Math.max(speedMax, speed);

    const soc = startBattery - socConsumed * t;
    const socRounded = Math.max(1, Math.round(soc));

    positionIdCounter += 1;
    if (firstPositionId === null) firstPositionId = positionIdCounter;
    lastPositionId = positionIdCounter;

    positions.push({
      date,
      latitude: point.lat,
      longitude: point.lon,
      speed: Math.round(speed),
      odometer: startOdometer + traveled,
      ideal_battery_range_km: idealRangeForSoc(soc),
      rated_battery_range_km: ratedRangeForSoc(soc),
      battery_level: socRounded,
      usable_battery_level: Math.max(0, socRounded - usableOffset),
      car_id: CAR_ID,
      drive_id: null, // filled in after we know the drive id
      ...tpmsReading(),
    });
  }

  odometer = startOdometer + distanceKm;
  batteryLevel = Math.max(1, Math.round(startBattery - socConsumed));

  const endDate = new Date(start.getTime() + durationSec * 1000);

  driveIdCounter += 1;
  const driveId = driveIdCounter;
  // Retroactively tag the positions we just generated with this drive id.
  for (let i = positions.length - (numSteps + 1); i < positions.length; i++) {
    positions[i]!.drive_id = driveId;
  }

  const outsideTemp = 16 + jitter(6);

  return {
    start_date: start,
    end_date: endDate,
    start_km: startOdometer,
    end_km: odometer,
    distance: distanceKm,
    duration_min: durationMin,
    car_id: CAR_ID,
    start_address_id: addressIdByKey[fromKey],
    end_address_id: addressIdByKey[toKey],
    start_position_id: firstPositionId!,
    end_position_id: lastPositionId,
    start_geofence_id: startGeofence ? geofenceIdByName[startGeofence]! : null,
    end_geofence_id: endGeofence ? geofenceIdByName[endGeofence]! : null,
    start_ideal_range_km: startIdeal,
    end_ideal_range_km: idealRangeForSoc(batteryLevel),
    start_rated_range_km: startRated,
    end_rated_range_km: ratedRangeForSoc(batteryLevel),
    speed_max: Math.round(speedMax),
    power_max: Math.round(60 + jitter(20)),
    power_min: Math.round(-15 - jitter(10)),
    outside_temp_avg: outsideTemp,
    inside_temp_avg: 21 + jitter(2),
    ascent: Math.round(Math.max(0, 20 + jitter(15))),
    descent: Math.round(Math.max(0, 20 + jitter(15))),
  };
}

/** Small vampire drain while parked (percent SoC lost per hour). */
const VAMPIRE_DRAIN_PCT_PER_HOUR = 0.15;

function applyParkedDrain(hours: number) {
  const loss = VAMPIRE_DRAIN_PCT_PER_HOUR * hours;
  batteryLevel = Math.max(1, Math.round(batteryLevel - loss));
}

/**
 * Simulate a charging process: ramps power up, holds, tapers as it approaches
 * the target SoC. Produces one `charges` row roughly every 60s.
 */
function simulateCharging(opts: {
  start: Date;
  addressKey: keyof typeof addressIdByKey;
  geofenceName: string | null;
  targetSoc: number;
  isDc: boolean;
  peakKw: number;
  cost: number | null;
  positionCoord: LatLon;
}): ChargingProcessRow {
  const { start, addressKey, geofenceName, targetSoc, isDc, peakKw, cost, positionCoord } =
    opts;

  const startSoc = batteryLevel;
  const startIdeal = idealRangeForSoc(startSoc);
  const startRated = ratedRangeForSoc(startSoc);
  const socToAdd = Math.max(0, targetSoc - startSoc);
  const energyAddedKwh = (socToAdd / 100) * BATTERY_CAPACITY_KWH;

  // Rough duration estimate from average power over the session (tapering
  // curve loses ~30% of peak on average for DC, ~flat for AC).
  const avgKw = isDc ? peakKw * 0.62 : peakKw * 0.97;
  const durationHours = avgKw > 0 ? energyAddedKwh / avgKw : 0;
  const durationMin = Math.max(5, Math.round(durationHours * 60));
  const stepMin = 1;
  const numSteps = Math.max(1, Math.round(durationMin / stepMin));

  // Position row that charging_processes.position_id references (required,
  // NOT NULL). Not linked to a drive.
  positionIdCounter += 1;
  const chargePositionId = positionIdCounter;
  positions.push({
    date: start,
    latitude: positionCoord.lat,
    longitude: positionCoord.lon,
    speed: null,
    odometer,
    ideal_battery_range_km: startIdeal,
    rated_battery_range_km: startRated,
    battery_level: startSoc,
    usable_battery_level: startSoc,
    car_id: CAR_ID,
    drive_id: null,
    ...tpmsReading(),
  });

  chargingProcessIdCounter += 1;
  const chargingProcessId = chargingProcessIdCounter;

  // Session-Basistemperatur (wie bei Fahrten: 16°C Mittel +/- Jitter), pro
  // Messpunkt zusätzlich leicht schwankend — TeslaMate loggt outside_temp
  // pro `charges`-Zeile, nicht nur als Session-Mittel.
  const sessionOutsideTemp = 16 + jitter(6);

  let socAcc = startSoc;
  for (let i = 1; i <= numSteps; i++) {
    const t = i / numSteps;
    const date = new Date(start.getTime() + t * durationMin * 60 * 1000);

    // Power curve: DC tapers hard after ~60% SoC; AC is flat.
    let power: number;
    if (isDc) {
      const soc = startSoc + socToAdd * t;
      const taper = soc < 60 ? 1 : Math.max(0.15, 1 - (soc - 60) / 45);
      power = peakKw * taper;
    } else {
      power = peakKw;
    }

    const stepSocAdd = socToAdd / numSteps;
    socAcc = Math.min(targetSoc, socAcc + stepSocAdd);
    const socRounded = Math.round(socAcc);
    const energySoFar = energyAddedKwh * t;

    charges.push({
      date,
      battery_level: socRounded,
      usable_battery_level: socRounded,
      charge_energy_added: Number(energySoFar.toFixed(2)),
      charger_power: Math.round(power),
      charger_phases: isDc ? null : 3,
      charger_voltage: isDc ? Math.round(370 + jitter(20)) : 230,
      fast_charger_present: isDc,
      ideal_battery_range_km: idealRangeForSoc(socAcc),
      rated_battery_range_km: ratedRangeForSoc(socAcc),
      charging_process_id: chargingProcessId,
      outside_temp: Number((sessionOutsideTemp + jitter(0.8)).toFixed(1)),
    });
  }

  batteryLevel = Math.round(targetSoc);
  const endDate = new Date(start.getTime() + durationMin * 60 * 1000);

  return {
    start_date: start,
    end_date: endDate,
    charge_energy_added: Number(energyAddedKwh.toFixed(2)),
    charge_energy_used: Number((energyAddedKwh * 1.08).toFixed(2)), // charging losses
    start_battery_level: startSoc,
    end_battery_level: batteryLevel,
    duration_min: durationMin,
    car_id: CAR_ID,
    position_id: chargePositionId,
    address_id: addressIdByKey[addressKey],
    geofence_id: geofenceName ? geofenceIdByName[geofenceName]! : null,
    start_ideal_range_km: startIdeal,
    end_ideal_range_km: idealRangeForSoc(batteryLevel),
    start_rated_range_km: startRated,
    end_rated_range_km: ratedRangeForSoc(batteryLevel),
    cost,
  };
}

// ---------------------------------------------------------------------------
// Build the 6-week timeline
// ---------------------------------------------------------------------------

let lastHomeArrival: Date | null = null;
let eveningsSinceLastCharge = 0;

for (let w = 0; w < WEEKS; w++) {
  const monday = weekMondays[w]!;
  const isWeekendTripWeek = w === 2;

  for (let d = 0; d < 7; d++) {
    const day = addDays(monday, d);
    if (day > yesterday) continue; // never generate data beyond "yesterday"
    const isWeekday = d < 5;

    if (isWeekday) {
      // 07:50 Zuhause -> Büro
      const morning = simulateDrive({
        start: atTime(day, 7, 50),
        fromKey: "zuhause",
        toKey: "buero",
        from: ZUHAUSE,
        to: BUERO,
        distanceKm: 9 + jitter(0.6),
        durationMin: Math.round(25 + jitter(3)),
        cruiseSpeedKmh: 45,
        startGeofence: "Zuhause",
        endGeofence: "Büro",
      });
      drives.push(morning);

      // Tue (1) + Thu (3): Büro -> Kunde Müller -> Büro
      if (d === 1 || d === 3) {
        const toKunde = simulateDrive({
          start: atTime(day, 10, 15),
          fromKey: "buero",
          toKey: "kunde",
          from: BUERO,
          to: KUNDE_MUELLER,
          distanceKm: 12 + jitter(1),
          durationMin: Math.round(22 + jitter(3)),
          cruiseSpeedKmh: 50,
          startGeofence: "Büro",
          endGeofence: "Kunde Müller",
        });
        drives.push(toKunde);
        applyParkedDrain(1.5 / 60); // negligible, brief stop

        const backToBuero = simulateDrive({
          start: atTime(day, 11, 45),
          fromKey: "kunde",
          toKey: "buero",
          from: KUNDE_MUELLER,
          to: BUERO,
          distanceKm: 12 + jitter(1),
          durationMin: Math.round(22 + jitter(3)),
          cruiseSpeedKmh: 50,
          startGeofence: "Kunde Müller",
          endGeofence: "Büro",
        });
        drives.push(backToBuero);
      }

      // Parked at Büro during the day
      applyParkedDrain(7.5);

      // Occasional lunchtime errand on non-customer-visit weekdays (Mon/Wed/Fri):
      // a quick supermarket run near the office.
      if ((d === 0 || d === 2 || d === 4) && rng() < 0.95) {
        const toShop = simulateDrive({
          start: atTime(day, 12, 15),
          fromKey: "buero",
          toKey: "supermarkt",
          from: BUERO,
          to: SUPERMARKT,
          distanceKm: 3.2 + jitter(0.4),
          durationMin: Math.round(10 + jitter(2)),
          cruiseSpeedKmh: 35,
          startGeofence: "Büro",
          endGeofence: null,
        });
        drives.push(toShop);
        applyParkedDrain(0.25);
        const backToOffice = simulateDrive({
          start: atTime(day, 12, 45),
          fromKey: "supermarkt",
          toKey: "buero",
          from: SUPERMARKT,
          to: BUERO,
          distanceKm: 3.2 + jitter(0.4),
          durationMin: Math.round(10 + jitter(2)),
          cruiseSpeedKmh: 35,
          startGeofence: null,
          endGeofence: "Büro",
        });
        drives.push(backToOffice);
      }

      // 17:30 Büro -> Zuhause
      const evening = simulateDrive({
        start: atTime(day, 17, 30),
        fromKey: "buero",
        toKey: "zuhause",
        from: BUERO,
        to: ZUHAUSE,
        distanceKm: 9 + jitter(0.6),
        durationMin: Math.round(25 + jitter(3)),
        cruiseSpeedKmh: 45,
        startGeofence: "Büro",
        endGeofence: "Zuhause",
      });
      drives.push(evening);
      lastHomeArrival = evening.end_date;
      eveningsSinceLastCharge += 1;

      // AC home charging every 2-3 evenings, to 80%.
      const shouldCharge = eveningsSinceLastCharge >= 2 && batteryLevel < 80;
      if (shouldCharge) {
        const chargeStart = addDays(day, 0);
        chargeStart.setHours(19, 30, 0, 0);
        const cp = simulateCharging({
          start: chargeStart,
          addressKey: "zuhause",
          geofenceName: "Zuhause",
          targetSoc: 80,
          isDc: false,
          peakKw: 11,
          cost: null,
          positionCoord: ZUHAUSE,
        });
        chargingProcesses.push(cp);
        eveningsSinceLastCharge = 0;
        applyParkedDrain(12); // rest of the night after charge completes
      } else {
        applyParkedDrain(14); // parked overnight, no charge
      }
    } else if (isWeekendTripWeek && d === 5) {
      // Saturday: weekend road trip Zuhause -> Raststätte -> Chur
      const leg1 = simulateDrive({
        start: atTime(day, 9, 0),
        fromKey: "zuhause",
        toKey: "raststaette",
        from: ZUHAUSE,
        to: RASTSTAETTE,
        distanceKm: 60 + jitter(2),
        durationMin: 35,
        cruiseSpeedKmh: 110,
        startGeofence: "Zuhause",
        endGeofence: null,
      });
      drives.push(leg1);

      // DC fast charge at the Raststätte: ~150kW peak, 20 min, +30kWh
      const socAdd = (30 / BATTERY_CAPACITY_KWH) * 100;
      const chargeStart = new Date(leg1.end_date.getTime() + 3 * 60 * 1000);
      const cp = simulateCharging({
        start: chargeStart,
        addressKey: "raststaette",
        geofenceName: null,
        targetSoc: Math.min(95, Math.round(batteryLevel + socAdd)),
        isDc: true,
        peakKw: 150,
        cost: Number((30 * 0.55).toFixed(2)),
        positionCoord: RASTSTAETTE,
      });
      chargingProcesses.push(cp);

      const leg2Start = new Date(cp.end_date.getTime() + 5 * 60 * 1000);
      const leg2 = simulateDrive({
        start: leg2Start,
        fromKey: "raststaette",
        toKey: "chur",
        from: RASTSTAETTE,
        to: CHUR,
        distanceKm: 60 + jitter(2),
        durationMin: 40,
        cruiseSpeedKmh: 100,
        startGeofence: null,
        endGeofence: null,
      });
      drives.push(leg2);
      applyParkedDrain(20); // overnight in Chur
    } else if (isWeekendTripWeek && d === 6) {
      // Sunday: return trip Chur -> Zuhause
      const ret = simulateDrive({
        start: atTime(day, 16, 0),
        fromKey: "chur",
        toKey: "zuhause",
        from: CHUR,
        to: ZUHAUSE,
        distanceKm: 122 + jitter(3),
        durationMin: 80,
        cruiseSpeedKmh: 110,
        startGeofence: null,
        endGeofence: "Zuhause",
      });
      drives.push(ret);
      lastHomeArrival = ret.end_date;
      eveningsSinceLastCharge += 1;
      applyParkedDrain(14);
    } else {
      // Regular weekend day: mostly parked at home, with an occasional
      // errand (groceries) to keep the fixture from being pure commute data.
      if (rng() < 0.95) {
        const errandStart = atTime(day, d === 5 ? 10 : 11, 0);
        const toShop = simulateDrive({
          start: errandStart,
          fromKey: "zuhause",
          toKey: "supermarkt",
          from: ZUHAUSE,
          to: SUPERMARKT,
          distanceKm: 2.8 + jitter(0.4),
          durationMin: Math.round(9 + jitter(2)),
          cruiseSpeedKmh: 35,
          startGeofence: "Zuhause",
          endGeofence: null,
        });
        drives.push(toShop);
        applyParkedDrain(0.5);
        const backHome = simulateDrive({
          start: new Date(toShop.end_date.getTime() + 25 * 60 * 1000),
          fromKey: "supermarkt",
          toKey: "zuhause",
          from: SUPERMARKT,
          to: ZUHAUSE,
          distanceKm: 2.8 + jitter(0.4),
          durationMin: Math.round(9 + jitter(2)),
          cruiseSpeedKmh: 35,
          startGeofence: null,
          endGeofence: "Zuhause",
        });
        drives.push(backHome);
        eveningsSinceLastCharge += 1;
      } else {
        eveningsSinceLastCharge += 1;
      }

      // Same "every 2-3 evenings" AC charge cadence applies on weekends.
      const shouldChargeWeekend =
        eveningsSinceLastCharge >= 2 &&
        (eveningsSinceLastCharge >= 3 || rng() > 0.5) &&
        batteryLevel < 80;
      if (shouldChargeWeekend) {
        const chargeStart = atTime(day, 19, 30);
        const cp = simulateCharging({
          start: chargeStart,
          addressKey: "zuhause",
          geofenceName: "Zuhause",
          targetSoc: 80,
          isDc: false,
          peakKw: 11,
          cost: null,
          positionCoord: ZUHAUSE,
        });
        chargingProcesses.push(cp);
        eveningsSinceLastCharge = 0;
        applyParkedDrain(12);
      } else {
        applyParkedDrain(23);
      }
    }
  }
}

void lastHomeArrival;

// ---------------------------------------------------------------------------
// DB writes
// ---------------------------------------------------------------------------

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function main() {
  console.log(`Seeding TeslaMate fixture DB at ${DATABASE_URL}`);

  await sql.begin(async (tx) => {
    // Truncate in FK-safe order, restart identity so ids match our
    // in-memory counters (which assume 1-based ids from a fresh sequence).
    await tx`
      TRUNCATE TABLE
        charges,
        charging_processes,
        drives,
        positions,
        states,
        updates,
        cars,
        car_settings,
        geofences,
        addresses
      RESTART IDENTITY CASCADE
    `;

    // car_settings (id=1) then cars (references settings_id)
    const [carSettings] = await tx`
      INSERT INTO car_settings (suspend_min, suspend_after_idle_min, req_not_unlocked, free_supercharging, use_streaming_api, enabled, lfp_battery)
      VALUES (21, 15, false, false, true, true, false)
      RETURNING id
    `;

    await tx`
      INSERT INTO cars (eid, vid, model, efficiency, vin, name, trim_badging, settings_id, exterior_color, wheel_type, display_priority, inserted_at, updated_at)
      VALUES (${CAR.eid}, ${CAR.vid}, ${CAR.model}, ${CAR.efficiency}, ${CAR.vin}, ${CAR.name}, ${CAR.trim_badging}, ${carSettings!.id}, ${CAR.exterior_color}, ${CAR.wheel_type}, 1, now(), now())
    `;

    // updates (software update history)
    for (const u of SOFTWARE_UPDATES) {
      const startDate = atTime(addDays(u.monday, u.dayOffset), 3, 15);
      const endDate = u.durationMin != null
        ? new Date(startDate.getTime() + u.durationMin * 60 * 1000)
        : null;
      await tx`
        INSERT INTO updates (start_date, end_date, version, car_id)
        VALUES (${startDate}, ${endDate}, ${u.version}, ${CAR_ID})
      `;
    }

    // geofences
    for (const g of GEOFENCES) {
      await tx`
        INSERT INTO geofences (name, latitude, longitude, radius, inserted_at, updated_at)
        VALUES (${g.name}, ${g.lat}, ${g.lon}, ${g.radius}, now(), now())
      `;
    }

    // addresses
    for (const a of ADDRESSES) {
      await tx`
        INSERT INTO addresses (display_name, latitude, longitude, name, house_number, road, city, postcode, state, country, inserted_at, updated_at)
        VALUES (${a.display_name}, ${a.lat}, ${a.lon}, ${a.name}, ${a.house_number}, ${a.road}, ${a.city}, ${a.postcode}, ${a.state}, ${a.country}, now(), now())
      `;
    }

    // drives are inserted first, WITHOUT start/end_position_id (positions.drive_id
    // has a FK to drives, so positions must come after; but drives.*_position_id
    // has a FK to positions, so we backfill those with an UPDATE once positions
    // exist). Our in-memory ids are 1-based and match the sequences created by
    // RESTART IDENTITY above, since we insert in the same order we generated them.
    const driveRows = drives.map((d) => [
      d.start_date,
      d.end_date,
      d.start_km,
      d.end_km,
      d.distance,
      d.duration_min,
      d.car_id,
      d.start_address_id,
      d.end_address_id,
      d.start_geofence_id,
      d.end_geofence_id,
      d.start_ideal_range_km,
      d.end_ideal_range_km,
      d.start_rated_range_km,
      d.end_rated_range_km,
      d.speed_max,
      d.power_max,
      d.power_min,
      d.outside_temp_avg,
      d.inside_temp_avg,
      d.ascent,
      d.descent,
    ]);
    for (const batch of chunk(driveRows, 1000)) {
      await tx`
        INSERT INTO drives (start_date, end_date, start_km, end_km, distance, duration_min, car_id, start_address_id, end_address_id, start_geofence_id, end_geofence_id, start_ideal_range_km, end_ideal_range_km, start_rated_range_km, end_rated_range_km, speed_max, power_max, power_min, outside_temp_avg, inside_temp_avg, ascent, descent)
        VALUES ${tx(batch as never)}
      `;
    }

    // positions (bulk insert) — now safe, drives already exist for the FK.
    const positionRows = positions.map((p) => [
      p.date,
      p.latitude,
      p.longitude,
      p.speed,
      p.odometer,
      p.ideal_battery_range_km,
      p.battery_level,
      p.usable_battery_level,
      p.rated_battery_range_km,
      p.car_id,
      p.drive_id,
      p.tpms_pressure_fl,
      p.tpms_pressure_fr,
      p.tpms_pressure_rl,
      p.tpms_pressure_rr,
    ]);
    for (const batch of chunk(positionRows, 2000)) {
      await tx`
        INSERT INTO positions (date, latitude, longitude, speed, odometer, ideal_battery_range_km, battery_level, usable_battery_level, rated_battery_range_km, car_id, drive_id, tpms_pressure_fl, tpms_pressure_fr, tpms_pressure_rl, tpms_pressure_rr)
        VALUES ${tx(batch as never)}
      `;
    }

    // Backfill drives.start_position_id / end_position_id now that positions
    // exist. `drives` was built in insertion order under RESTART IDENTITY, so
    // array index + 1 == the row's serial id.
    const positionBackfill = drives.map((d, i) => [
      i + 1,
      d.start_position_id,
      d.end_position_id,
    ]);
    for (const batch of chunk(positionBackfill, 1000)) {
      const ids = batch.map((r) => r[0]);
      const startIds = batch.map((r) => r[1]);
      const endIds = batch.map((r) => r[2]);
      await tx`
        UPDATE drives AS dr
        SET start_position_id = v.start_position_id, end_position_id = v.end_position_id
        FROM (
          SELECT * FROM unnest(
            ${tx.array(ids)}::integer[],
            ${tx.array(startIds)}::integer[],
            ${tx.array(endIds)}::integer[]
          ) AS t(id, start_position_id, end_position_id)
        ) AS v
        WHERE dr.id = v.id
      `;
    }

    // charging_processes
    const cpRows = chargingProcesses.map((c) => [
      c.start_date,
      c.end_date,
      c.charge_energy_added,
      c.charge_energy_used,
      c.start_battery_level,
      c.end_battery_level,
      c.duration_min,
      c.car_id,
      c.position_id,
      c.address_id,
      c.geofence_id,
      c.start_ideal_range_km,
      c.end_ideal_range_km,
      c.start_rated_range_km,
      c.end_rated_range_km,
      c.cost,
    ]);
    for (const batch of chunk(cpRows, 1000)) {
      await tx`
        INSERT INTO charging_processes (start_date, end_date, charge_energy_added, charge_energy_used, start_battery_level, end_battery_level, duration_min, car_id, position_id, address_id, geofence_id, start_ideal_range_km, end_ideal_range_km, start_rated_range_km, end_rated_range_km, cost)
        VALUES ${tx(batch as never)}
      `;
    }

    // charges
    const chargeRows = charges.map((c) => [
      c.date,
      c.battery_level,
      c.usable_battery_level,
      c.charge_energy_added,
      c.charger_power,
      c.charger_phases,
      c.charger_voltage,
      c.fast_charger_present,
      c.ideal_battery_range_km,
      c.rated_battery_range_km,
      c.charging_process_id,
      c.outside_temp,
    ]);
    for (const batch of chunk(chargeRows, 2000)) {
      await tx`
        INSERT INTO charges (date, battery_level, usable_battery_level, charge_energy_added, charger_power, charger_phases, charger_voltage, fast_charger_present, ideal_battery_range_km, rated_battery_range_km, charging_process_id, outside_temp)
        VALUES ${tx(batch as never)}
      `;
    }
  });

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  const counts = await sql`
    SELECT
      (SELECT count(*) FROM cars) AS cars,
      (SELECT count(*) FROM car_settings) AS car_settings,
      (SELECT count(*) FROM geofences) AS geofences,
      (SELECT count(*) FROM addresses) AS addresses,
      (SELECT count(*) FROM drives) AS drives,
      (SELECT count(*) FROM positions) AS positions,
      (SELECT count(*) FROM charging_processes) AS charging_processes,
      (SELECT count(*) FROM charges) AS charges,
      (SELECT count(*) FROM updates) AS updates
  `;
  const dateRange = await sql`
    SELECT min(start_date) AS min_date, max(end_date) AS max_date FROM drives
  `;
  const odoRange = await sql`
    SELECT min(start_km) AS min_km, max(end_km) AS max_km FROM drives
  `;

  const c = counts[0]!;
  const dr = dateRange[0]!;
  const or_ = odoRange[0]!;

  console.log("");
  console.log("Seed summary");
  console.log("------------");
  console.log(`cars:                ${c.cars}`);
  console.log(`car_settings:        ${c.car_settings}`);
  console.log(`geofences:           ${c.geofences}`);
  console.log(`addresses:           ${c.addresses}`);
  console.log(`drives:              ${c.drives}`);
  console.log(`positions:           ${c.positions}`);
  console.log(`charging_processes:  ${c.charging_processes}`);
  console.log(`charges:             ${c.charges}`);
  console.log(`updates:             ${c.updates}`);
  console.log("");
  console.log(`date range:  ${dr.min_date?.toISOString()} .. ${dr.max_date?.toISOString()}`);
  console.log(`odometer:    ${Number(or_.min_km).toFixed(1)} km .. ${Number(or_.max_km).toFixed(1)} km`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
