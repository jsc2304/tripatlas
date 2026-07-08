import { buildDriveReport, type DriveReport } from "./drive.js";
import type { Classification, ReportDrive, ReportMeta } from "./types.js";

const ALL_CLASSIFICATIONS: Classification[] = [
  "unclassified",
  "private",
  "business",
  "commute",
];

export interface ClassificationTotals {
  classification: Classification;
  driveCount: number;
  distanceKm: number;
}

export interface MonthReportTotals {
  driveCount: number;
  distanceKm: number;
}

export interface MonthReport {
  month: string; // YYYY-MM
  rows: DriveReport[];
  /** Summen pro Klassifizierung, gemäß vision.md §20.3. */
  byClassification: Record<Classification, ClassificationTotals>;
  /** Gesamtsumme über alle (gefilterten) Fahrten. */
  totals: MonthReportTotals;
  /** true, falls mindestens einer Fahrt die Distanz fehlte (geht mit 0 km in die Summe ein). */
  hasIncompleteData: boolean;
  meta: ReportMeta;
}

/**
 * Baut den Monatsreport gemäß vision.md §20.3 (Business-Nachweis über einen
 * Monat, gruppiert nach Klassifizierung). `filter` schränkt optional auf
 * bestimmte Klassifizierungen ein (Default: alle). Fahrten ohne Distanz
 * zählen weiterhin in driveCount, tragen aber 0 km zur Summe bei und setzen
 * `hasIncompleteData`.
 */
export function buildMonthReport(
  drives: ReportDrive[],
  month: string,
  meta: ReportMeta,
  filter?: Classification[],
): MonthReport {
  const allowed = filter != null ? new Set(filter) : null;
  const filtered = drives.filter(
    (drive) => allowed === null || allowed.has(drive.classification),
  );
  const sorted = [...filtered].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime(),
  );
  const rows = sorted.map((drive) => buildDriveReport(drive, meta));

  const byClassification: Record<Classification, ClassificationTotals> =
    Object.fromEntries(
      ALL_CLASSIFICATIONS.map((classification) => [
        classification,
        { classification, driveCount: 0, distanceKm: 0 },
      ]),
    ) as Record<Classification, ClassificationTotals>;

  let hasIncompleteData = false;

  for (const drive of sorted) {
    const bucket = byClassification[drive.classification];
    bucket.driveCount += 1;
    if (drive.distanceKm != null) {
      bucket.distanceKm += drive.distanceKm;
    } else {
      hasIncompleteData = true;
    }
  }

  const totals: MonthReportTotals = {
    driveCount: sorted.length,
    distanceKm: ALL_CLASSIFICATIONS.reduce(
      (sum, classification) => sum + byClassification[classification].distanceKm,
      0,
    ),
  };

  return {
    month,
    rows,
    byClassification,
    totals,
    hasIncompleteData,
    meta,
  };
}
