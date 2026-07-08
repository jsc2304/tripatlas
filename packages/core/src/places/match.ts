export interface MatchablePlace {
  id: number;
  lat: number;
  lon: number;
  radiusM: number;
}

const EARTH_RADIUS_M = 6_371_000;

export function haversineDistanceM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/**
 * Findet den Place, in dessen Geofence-Radius die Koordinate liegt.
 * Bei Überlappung gewinnt die kleinste Distanz, bei gleicher Distanz der
 * kleinste Radius (der spezifischste Place).
 */
export function matchPlace(
  lat: number | null,
  lon: number | null,
  places: readonly MatchablePlace[],
): number | null {
  if (lat == null || lon == null) return null;

  let best: { id: number; distance: number; radiusM: number } | null = null;
  for (const place of places) {
    const distance = haversineDistanceM(lat, lon, place.lat, place.lon);
    if (distance > place.radiusM) continue;
    if (
      best === null ||
      distance < best.distance ||
      (distance === best.distance && place.radiusM < best.radiusM)
    ) {
      best = { id: place.id, distance, radiusM: place.radiusM };
    }
  }
  return best?.id ?? null;
}
