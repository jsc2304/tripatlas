import type { Classification, ReportDrive, ReportMeta } from "./types.js";

// Nachkommastellen, auf die Koordinaten im Ort-Fallback gerundet werden.
const COORD_FALLBACK_DECIMALS = 5;

/**
 * Löst den Anzeigenamen eines Orts auf: Place-Name → Adresse →
 * Koordinate (gerundet auf 5 Nachkommastellen) → "–", falls nichts bekannt ist.
 */
export function resolvePlaceLabel(
  placeName: string | null,
  address: string | null,
  lat: number | null,
  lon: number | null,
): string {
  if (placeName != null) return placeName;
  if (address != null) return address;
  if (lat != null && lon != null) {
    return `${lat.toFixed(COORD_FALLBACK_DECIMALS)}, ${lon.toFixed(COORD_FALLBACK_DECIMALS)}`;
  }
  return "–";
}

export interface DriveReport {
  id: number;
  date: string; // YYYY-MM-DD, gemäß meta.timeZone (hier: UTC-Kalenderdatum von startTime)
  startTime: Date;
  endTime: Date | null;
  startPlace: string;
  endPlace: string;
  startOdometerKm: number | null;
  endOdometerKm: number | null;
  distanceKm: number | null;
  durationSeconds: number | null;
  classification: Classification;
  purpose: string | null;
  customer: string | null;
  project: string | null;
  notes: string | null;
  tags: string[];
  consumedEnergyKwh: number | null;
  energyIsEstimated: boolean;
  avgConsumptionWhKm: number | null;
  meta: ReportMeta;
}

/**
 * Baut den Einzelfahrt-Report gemäß vision.md §20.1: alle Pflichtfelder als
 * typisierte Werte (Date/number/string), keine Vorformatierung — das
 * übernehmen CSV-/PDF-Renderer weiter unten in der Kette.
 */
export function buildDriveReport(drive: ReportDrive, meta: ReportMeta): DriveReport {
  return {
    id: drive.id,
    date: drive.startTime.toISOString().slice(0, 10),
    startTime: drive.startTime,
    endTime: drive.endTime,
    startPlace: resolvePlaceLabel(
      drive.startPlaceName,
      drive.startAddress,
      drive.startLat,
      drive.startLon,
    ),
    endPlace: resolvePlaceLabel(
      drive.endPlaceName,
      drive.endAddress,
      drive.endLat,
      drive.endLon,
    ),
    startOdometerKm: drive.startOdometerKm,
    endOdometerKm: drive.endOdometerKm,
    distanceKm: drive.distanceKm,
    durationSeconds: drive.durationSeconds,
    classification: drive.classification,
    purpose: drive.purpose,
    customer: drive.customer,
    project: drive.project,
    notes: drive.notes,
    tags: drive.tags,
    consumedEnergyKwh: drive.consumedEnergyKwh,
    energyIsEstimated: drive.energyIsEstimated,
    avgConsumptionWhKm: drive.avgConsumptionWhKm,
    meta,
  };
}
