/**
 * Hand-rolled GPX 1.1 renderer — no dependency, the schema is small and
 * stable (a `<gpx>` root, one `<trk>` per drive, `<trkpt>` per route point).
 * Data loading lives in data.ts (single drive) / journey.ts (journey);
 * this module only turns already-loaded points into XML.
 */

export interface GpxPoint {
  lat: number;
  lon: number;
  ele: number | null;
  time: Date;
}

export interface GpxTrack {
  /** Track name — "Start → Ziel" for a drive. */
  name: string;
  points: GpxPoint[];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderTrkpt(point: GpxPoint): string {
  const ele = point.ele != null ? `<ele>${point.ele}</ele>` : "";
  return `<trkpt lat="${point.lat}" lon="${point.lon}">${ele}<time>${point.time.toISOString()}</time></trkpt>`;
}

function renderTrk(track: GpxTrack): string {
  const points = track.points.map(renderTrkpt).join("");
  return `<trk><name>${escapeXml(track.name)}</name><trkseg>${points}</trkseg></trk>`;
}

function renderGpxDocument(name: string, tracks: GpxTrack[]): string {
  const nonEmpty = tracks.filter((t) => t.points.length > 0);
  const body = nonEmpty.map(renderTrk).join("");
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<gpx version="1.1" creator="Tripatlas" xmlns="http://www.topografix.com/GPX/1/1">' +
    `<metadata><name>${escapeXml(name)}</name></metadata>` +
    body +
    "</gpx>\n"
  );
}

/** Single-drive GPX export (vision.md §20.1 "auch Einzelfahrt-GPX"). */
export function renderDriveGpx(track: GpxTrack): string {
  return renderGpxDocument(track.name, [track]);
}

/**
 * Journey GPX export (vision.md §20.4 "Route optional als GPX"): one
 * `<trk>` per drive, in journey order, so multi-drive journeys stay
 * navigable (per-leg) in GPX viewers instead of one giant merged track.
 */
export function renderJourneyGpx(journeyName: string, tracks: GpxTrack[]): string {
  return renderGpxDocument(journeyName, tracks);
}
