import "server-only";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const CACHE_TTL_MS = 10 * 60 * 1000;

export interface WeatherResult {
  temperature: number;
  apparentTemperature: number;
  weatherCode: number;
  windSpeedKmh: number;
  todayMin: number;
  todayMax: number;
}

interface CacheEntry {
  fetchedAt: number;
  result: WeatherResult;
}

// Module-level cache, keyed by coordinates rounded to ~1km — survives across
// requests within the same server process (dev server / long-lived Node
// process), not across separate lambda invocations. Good enough for the MVP;
// avoids hammering Open-Meteo on every dashboard load.
const cache = new Map<string, CacheEntry>();

function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
  daily?: {
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    weather_code?: number[];
  };
}

/**
 * Fetches current weather + today's min/max for a coordinate via Open-Meteo.
 * Failure-soft: returns null on any error (network down, bad response,
 * unexpected shape) instead of throwing — the dashboard card degrades to a
 * muted "derzeit nicht verfügbar" message and the page never breaks.
 * In-memory cached for 10 minutes per rounded coordinate.
 */
export async function getCurrentWeather(
  lat: number,
  lon: number,
): Promise<WeatherResult | null> {
  const key = cacheKey(lat, lon);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.result;
  }

  try {
    const url = new URL(OPEN_METEO_URL);
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set(
      "current",
      "temperature_2m,apparent_temperature,weather_code,wind_speed_10m",
    );
    url.searchParams.set(
      "daily",
      "temperature_2m_max,temperature_2m_min,weather_code",
    );
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("forecast_days", "1");

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;

    const body = (await res.json()) as OpenMeteoResponse;
    const c = body.current;
    const daily = body.daily;
    if (
      c?.temperature_2m == null ||
      c.apparent_temperature == null ||
      c.weather_code == null ||
      c.wind_speed_10m == null ||
      daily?.temperature_2m_max?.[0] == null ||
      daily?.temperature_2m_min?.[0] == null
    ) {
      return null;
    }

    const result: WeatherResult = {
      temperature: c.temperature_2m,
      apparentTemperature: c.apparent_temperature,
      weatherCode: c.weather_code,
      windSpeedKmh: c.wind_speed_10m,
      todayMax: daily.temperature_2m_max[0],
      todayMin: daily.temperature_2m_min[0],
    };
    cache.set(key, { fetchedAt: Date.now(), result });
    return result;
  } catch {
    return null;
  }
}
