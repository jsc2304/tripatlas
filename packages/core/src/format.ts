const kmFormatter = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * Formats a distance in kilometers using de-DE conventions with one decimal.
 * Example: formatKm(27.3) -> "27,3 km"
 */
export function formatKm(km: number): string {
  return `${kmFormatter.format(km)} km`;
}

/**
 * Formats a duration in seconds as a compact human-readable string.
 * Example: formatDuration(1980) -> "33 min"
 * Example: formatDuration(5700) -> "1 h 35 min"
 */
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes} min`;
  }

  return `${hours} h ${minutes} min`;
}

/**
 * Formats a single instant as a 24h "HH:mm" clock time in the given IANA
 * timezone (de-DE). Core stays pure: the timezone is always passed in.
 * Example: formatTime(new Date("2026-07-02T05:50:00Z"), "Europe/Zurich") -> "07:50"
 */
export function formatTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(date);
}

/**
 * Formats a start/end instant pair as a "HH:mm – HH:mm" range (24h, de-DE) in
 * the given timezone. If `end` is null the session is still running and the
 * result is "seit HH:mm".
 * Example: formatTimeRange(start, end, "Europe/Zurich") -> "07:58 – 08:14"
 * Example: formatTimeRange(start, null, "Europe/Zurich") -> "seit 17:36"
 */
export function formatTimeRange(
  start: Date,
  end: Date | null,
  timeZone: string,
): string {
  const startStr = formatTime(start, timeZone);
  if (end === null) {
    return `seit ${startStr}`;
  }
  return `${startStr} – ${formatTime(end, timeZone)}`;
}

const kwhFormatter = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * Formats an energy amount in kWh (de-DE, one decimal).
 * Example: formatKwh(30.2) -> "30,2 kWh"
 * With a sign prefix (for charge sessions that add energy):
 * Example: formatKwh(30.2, { sign: true }) -> "+30,2 kWh"
 */
export function formatKwh(
  kwh: number,
  opts: { sign?: boolean } = {},
): string {
  const prefix = opts.sign && kwh > 0 ? "+" : "";
  return `${prefix}${kwhFormatter.format(kwh)} kWh`;
}

/**
 * Formats a state-of-charge percentage (integer, no decimals).
 * Example: formatSoc(45) -> "45 %"
 */
export function formatSoc(soc: number): string {
  return `${Math.round(soc)} %`;
}

/**
 * Formats an average consumption in Wh/km (de-DE, no decimals).
 * The `estimated` flag appends a tilde marker per vision (energy is a
 * Rated-Range estimate, must be flagged as such).
 * Example: formatConsumption(162) -> "162 Wh/km"
 * Example: formatConsumption(162, true) -> "162 Wh/km ~"
 */
export function formatConsumption(whPerKm: number, estimated = false): string {
  const base = `${Math.round(whPerKm)} Wh/km`;
  return estimated ? `${base} ~` : base;
}

const odometerFormatter = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  useGrouping: true,
});

/**
 * Formats an odometer reading in km at full precision (one decimal, as
 * stored) with de-DE thousands grouping — meant for monospace display where
 * exact figures matter (audit/proof use cases), unlike the rounded
 * `formatKm` used for distances.
 * Example: formatOdometer(48213.7) -> "48.213,7 km"
 */
export function formatOdometer(km: number): string {
  return `${odometerFormatter.format(km)} km`;
}

const tempFormatter = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * Formats a temperature in °C (de-DE, one decimal with comma separator).
 * Example: formatTemp(18.5) -> "18,5 °C"
 * Example: formatTemp(-3) -> "-3,0 °C"
 */
export function formatTemp(celsius: number): string {
  return `${tempFormatter.format(celsius)} °C`;
}

/**
 * Formats an electrical power in kW (de-DE, no decimals, absolute value).
 * Recuperation is stored as a negative power but shown positive, so callers
 * pass Math.abs — this formatter never emits a sign.
 * Example: formatKw(245) -> "245 kW"
 * Example: formatKw(-62) -> "62 kW"
 */
export function formatKw(kw: number): string {
  return `${Math.round(Math.abs(kw))} kW`;
}

/**
 * Formats a speed in km/h (de-DE, no decimals).
 * Example: formatSpeed(132) -> "132 km/h"
 * Example: formatSpeed(88.6) -> "89 km/h"
 */
export function formatSpeed(kmh: number): string {
  return `${Math.round(kmh)} km/h`;
}

const coordFormatter = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

/**
 * Produces a human-readable label for a start/end location, degrading
 * gracefully: a named place wins, else the street address, else rounded
 * coordinates, else a generic fallback.
 * Example: formatPlaceLabel("Zuhause", null, 47, 8) -> "Zuhause"
 * Example: formatPlaceLabel(null, "Bahnhofstr. 1", 47, 8) -> "Bahnhofstr. 1"
 * Example: formatPlaceLabel(null, null, 47.3769, 8.5417) -> "47,3769, 8,5417"
 */
export function formatPlaceLabel(
  placeName: string | null | undefined,
  address: string | null | undefined,
  lat: number | null | undefined,
  lon: number | null | undefined,
): string {
  if (placeName && placeName.trim() !== "") {
    return placeName;
  }
  if (address && address.trim() !== "") {
    return address;
  }
  if (typeof lat === "number" && typeof lon === "number") {
    return `${coordFormatter.format(lat)}, ${coordFormatter.format(lon)}`;
  }
  return "Unbekannter Ort";
}
