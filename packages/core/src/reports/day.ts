import { buildDriveReport, type DriveReport } from "./drive.js";
import type { ReportDrive, ReportMeta } from "./types.js";

export interface DayReportTotals {
  driveCount: number;
  distanceKm: number;
  durationSeconds: number;
  consumedEnergyKwh: number;
  /** true, falls mindestens eine Fahrt eine Energie-Schätzung statt Messwert war. */
  anyEstimated: boolean;
}

export interface DayReport {
  date: string; // YYYY-MM-DD
  rows: DriveReport[];
  totals: DayReportTotals;
  /** true, falls mindestens einer Fahrt Distanz/Dauer/Energie fehlte (Summen unvollständig). */
  hasIncompleteData: boolean;
  meta: ReportMeta;
}

/**
 * Baut den Tagesexport gemäß vision.md §20.2: alle Fahrten eines Tages,
 * chronologisch sortiert, plus null-sichere Summen. Fahrten mit fehlenden
 * Werten fließen nicht als 0 in die Summe ein, sondern werden übersprungen —
 * `hasIncompleteData` markiert diesen Fall für die Anzeige.
 */
export function buildDayReport(
  drives: ReportDrive[],
  date: string,
  meta: ReportMeta,
): DayReport {
  const sorted = [...drives].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime(),
  );
  const rows = sorted.map((drive) => buildDriveReport(drive, meta));

  let distanceKm = 0;
  let durationSeconds = 0;
  let consumedEnergyKwh = 0;
  let anyEstimated = false;
  let hasIncompleteData = false;

  for (const drive of sorted) {
    if (drive.distanceKm != null) {
      distanceKm += drive.distanceKm;
    } else {
      hasIncompleteData = true;
    }

    if (drive.durationSeconds != null) {
      durationSeconds += drive.durationSeconds;
    } else {
      hasIncompleteData = true;
    }

    if (drive.consumedEnergyKwh != null) {
      consumedEnergyKwh += drive.consumedEnergyKwh;
      if (drive.energyIsEstimated) anyEstimated = true;
    } else {
      hasIncompleteData = true;
    }
  }

  return {
    date,
    rows,
    totals: {
      driveCount: sorted.length,
      distanceKm,
      durationSeconds,
      consumedEnergyKwh,
      anyEstimated,
    },
    hasIncompleteData,
    meta,
  };
}
