import { and, asc, eq, isNull, isNotNull } from "drizzle-orm";
import { drives, type Db } from "@tripatlas/db";
import { recordSyncRun } from "./state.js";

const SOURCE = "open_meteo";
const ENTITY = "drive_weather";

const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const HOURLY_PARAMS = "temperature_2m,precipitation,wind_speed_10m,weather_code";
// Archive-API hat ~5 Tage Verzögerung für aktuelle Daten — jüngere Fahrten
// fallen auf die Forecast-API zurück (die past_days mitliefert).
const ARCHIVE_DELAY_DAYS = 7;
const FORECAST_PAST_DAYS = 7;
// Obergrenze pro Zyklus — ältere Fahrten zuerst, Historie füllt sich sukzessive.
const MAX_DRIVES_PER_CYCLE = 20;
// Höflichkeitspause zwischen Requests (ein Request pro Fahrt).
const PAUSE_MS = 250;

export interface DriveWeatherSyncResult {
  drivesFilled: number;
}

interface PendingDrive {
  id: number;
  startTime: Date;
  endTime: Date | null;
  startLat: number;
  startLon: number;
}

interface HourlyWeather {
  temperature_2m: (number | null)[];
  precipitation: (number | null)[];
  wind_speed_10m: (number | null)[];
  weather_code: (number | null)[];
  time: string[];
}

interface OpenMeteoResponse {
  hourly?: HourlyWeather;
}

// Nach einem 429 (Rate-Limit) pausiert der Wetter-Backfill, statt jede Minute
// erneut anzuklopfen. Eskalierend (15 min → ×4 bis 12 h) — teilt sich die
// IP-Quote mit der Elevation-Anreicherung und der Dashboard-Wetterkarte,
// Dauerfeuer würde alle drei Features lahmlegen.
const RATE_LIMIT_BACKOFF_START_MS = 15 * 60 * 1000;
const RATE_LIMIT_BACKOFF_MAX_MS = 12 * 60 * 60 * 1000;
let backoffMs = RATE_LIMIT_BACKOFF_START_MS;
let backoffUntil = 0;

/**
 * Backfill für historisches Wetter zur Fahrtzeit (Open-Meteo Archive API,
 * mit Forecast-API-Fallback für die letzten Tage). Kein Watermark nötig —
 * Fortschritt ergibt sich daraus, dass weather_synced_at nach dem Füllen
 * gesetzt ist; spätere Zyklen holen automatisch nur die verbleibenden
 * Fahrten (idempotent). weather_synced_at wird auch gesetzt, wenn die API
 * geantwortet hat, aber keine Daten für die Stunde lieferte (verhindert
 * Endlos-Refetch) — NICHT bei Netzwerkfehlern/429 (die sollen erneut
 * versucht werden). Failure-soft: Fehler werden in sync_state protokolliert,
 * der Sync-Zyklus läuft weiter.
 */
export async function syncDriveWeather(
  db: Db,
  maxDrivesPerCycle = MAX_DRIVES_PER_CYCLE,
): Promise<DriveWeatherSyncResult> {
  if (Date.now() < backoffUntil) {
    return { drivesFilled: 0 };
  }
  try {
    const pending = await loadPendingDrives(db, maxDrivesPerCycle);

    let drivesFilled = 0;
    for (let i = 0; i < pending.length; i++) {
      const drive = pending[i]!;
      const filled = await fillDriveWeather(db, drive);
      if (filled) drivesFilled++;

      if (i < pending.length - 1) {
        await sleep(PAUSE_MS);
      }
    }

    backoffMs = RATE_LIMIT_BACKOFF_START_MS;
    await recordSyncRun(db, SOURCE, ENTITY, {
      status: "ok",
      rowsUpserted: drivesFilled,
    });
    return { drivesFilled };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("HTTP 429")) {
      backoffUntil = Date.now() + backoffMs;
      const retryMinutes = Math.round(backoffMs / 60000);
      console.warn(
        `[sync:driveWeather] Open-Meteo Rate-Limit — pausiere ${retryMinutes} min`,
      );
      backoffMs = Math.min(backoffMs * 4, RATE_LIMIT_BACKOFF_MAX_MS);
      await recordSyncRun(db, SOURCE, ENTITY, {
        status: "deferred",
        error: `Open-Meteo API rate-limited; retrying in about ${retryMinutes} min`,
        rowsUpserted: 0,
      });
      return { drivesFilled: 0 };
    }
    await recordSyncRun(db, SOURCE, ENTITY, {
      status: "error",
      error: message,
      rowsUpserted: 0,
    });
    // Failure-soft: Sync-Zyklus soll trotzdem weiterlaufen (kein throw).
    return { drivesFilled: 0 };
  }
}

/**
 * Lädt abgeschlossene Fahrten ohne Wetter-Sync, älteste zuerst, begrenzt auf
 * maxDrivesPerCycle pro Zyklus.
 */
async function loadPendingDrives(
  db: Db,
  maxDrivesPerCycle: number,
): Promise<PendingDrive[]> {
  const rows = await db
    .select({
      id: drives.id,
      startTime: drives.startTime,
      endTime: drives.endTime,
      startLat: drives.startLat,
      startLon: drives.startLon,
    })
    .from(drives)
    .where(
      and(
        isNotNull(drives.endTime),
        isNull(drives.weatherSyncedAt),
        isNotNull(drives.startLat),
        isNotNull(drives.startLon),
      ),
    )
    .orderBy(asc(drives.startTime))
    .limit(maxDrivesPerCycle);
  return rows as PendingDrive[];
}

/**
 * Holt das Wetter für den Mittelpunkt einer Fahrt und schreibt es (oder
 * markiert weather_synced_at, wenn die API zwar antwortete, aber keine Daten
 * für die Stunde hatte). Gibt zurück, ob tatsächlich Wetterdaten gefunden
 * wurden (nur für die Zusammenfassung im Zyklus-Log).
 */
async function fillDriveWeather(db: Db, drive: PendingDrive): Promise<boolean> {
  const midpoint = new Date(
    (drive.startTime.getTime() + (drive.endTime?.getTime() ?? drive.startTime.getTime())) / 2,
  );
  const dateStr = midpoint.toISOString().slice(0, 10);
  const ageMs = Date.now() - midpoint.getTime();
  const isRecent = ageMs < ARCHIVE_DELAY_DAYS * 24 * 60 * 60 * 1000;

  let weather = await fetchHourlyWeather(
    ARCHIVE_URL,
    drive.startLat,
    drive.startLon,
    dateStr,
    dateStr,
  );
  let nearest = weather ? nearestHour(weather, midpoint) : null;

  // Archive-API liefert für sehr junge Daten (~5 Tage Verzögerung) oft nur
  // Nullwerte — bei jungen Fahrten auf die Forecast-API zurückfallen, die
  // vergangene Tage über past_days mitliefert.
  if (nearest == null && isRecent) {
    weather = await fetchHourlyWeather(
      FORECAST_URL,
      drive.startLat,
      drive.startLon,
      undefined,
      undefined,
      FORECAST_PAST_DAYS,
    );
    nearest = weather ? nearestHour(weather, midpoint) : null;
  }

  await db
    .update(drives)
    .set({
      weatherTempC: nearest?.temperature_2m ?? null,
      weatherPrecipitationMm: nearest?.precipitation ?? null,
      weatherWindKmh: nearest?.wind_speed_10m ?? null,
      weatherCode: nearest?.weather_code ?? null,
      weatherSyncedAt: new Date(),
    })
    .where(eq(drives.id, drive.id));

  return nearest != null;
}

interface HourSample {
  temperature_2m: number | null;
  precipitation: number | null;
  wind_speed_10m: number | null;
  weather_code: number | null;
}

function nearestHour(weather: HourlyWeather, target: Date): HourSample | null {
  const times = weather.time;
  if (!Array.isArray(times) || times.length === 0) return null;

  let bestIdx = -1;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const t = new Date(`${times[i]}Z`).getTime();
    const diff = Math.abs(t - target.getTime());
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }
  if (bestIdx < 0) return null;

  const temp = weather.temperature_2m[bestIdx] ?? null;
  const precip = weather.precipitation[bestIdx] ?? null;
  const wind = weather.wind_speed_10m[bestIdx] ?? null;
  const code = weather.weather_code[bestIdx] ?? null;
  // Archive-API liefert für noch nicht verarbeitete Tage komplett NULL-Zeilen
  // zurück statt zu fehlen — als "keine Daten" behandeln, nicht als Treffer.
  if (temp == null && precip == null && wind == null && code == null) return null;

  return {
    temperature_2m: temp,
    precipitation: precip,
    wind_speed_10m: wind,
    weather_code: code,
  };
}

async function fetchHourlyWeather(
  baseUrl: string,
  lat: number,
  lon: number,
  startDate?: string,
  endDate?: string,
  pastDays?: number,
): Promise<HourlyWeather | null> {
  const url = new URL(baseUrl);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("hourly", HOURLY_PARAMS);
  url.searchParams.set("timezone", "UTC");
  if (startDate) url.searchParams.set("start_date", startDate);
  if (endDate) url.searchParams.set("end_date", endDate);
  if (pastDays != null) url.searchParams.set("past_days", String(pastDays));

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Open-Meteo API (${baseUrl}): HTTP ${res.status}`);
  }
  const body = (await res.json()) as OpenMeteoResponse;
  if (!body.hourly || !Array.isArray(body.hourly.time)) {
    return null;
  }
  return body.hourly;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
