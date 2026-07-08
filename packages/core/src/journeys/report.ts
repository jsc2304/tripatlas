import { buildDriveReport, resolvePlaceLabel, type DriveReport } from "../reports/drive.js";
import type { ReportMeta } from "../reports/types.js";
import { buildJourneyKpis, type JourneyKpis, type KpiCharge, type KpiDrive } from "./kpis.js";
import type { JourneyInfo, JourneyReportCharge, JourneyReportDrive } from "./types.js";

/**
 * Eine Ladestopp-Zeile im Journey-Report — aufbereitet für CSV/PDF (Ort
 * bereits über `resolvePlaceLabel` aufgelöst, Kosten als Zahl statt
 * DB-numeric-String).
 */
export interface JourneyChargeReport {
  id: number;
  startTime: Date;
  endTime: Date | null;
  durationSeconds: number | null;
  energyAddedKwh: number | null;
  startSoc: number | null;
  endSoc: number | null;
  maxPowerKw: number | null;
  chargerType: "ac" | "dc" | null;
  cost: number | null;
  currency: string | null;
  place: string;
}

export interface JourneyReport {
  journey: JourneyInfo;
  driveRows: DriveReport[];
  chargeRows: JourneyChargeReport[];
  kpis: JourneyKpis;
  meta: ReportMeta;
}

/**
 * Baut den Journey-Report gemäß vision.md §20.4: alle (aktiven) Fahrten und
 * Ladevorgänge der Reise, chronologisch sortiert, plus die
 * Journey-Kennzahlen (`buildJourneyKpis`). Fahrt-Zeilen laufen durch
 * denselben `buildDriveReport` wie Tages-/Monatsreport, damit CSV/PDF
 * dieselben Spalten und Formatierer wiederverwenden können.
 */
export function buildJourneyReport(
  journey: JourneyInfo,
  drives: JourneyReportDrive[],
  charges: JourneyReportCharge[],
  meta: ReportMeta,
): JourneyReport {
  const sortedDrives = [...drives].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime(),
  );
  const sortedCharges = [...charges].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime(),
  );

  const driveRows = sortedDrives.map((d) => buildDriveReport(d, meta));

  const chargeRows: JourneyChargeReport[] = sortedCharges.map((c) => ({
    id: c.id,
    startTime: c.startTime,
    endTime: c.endTime,
    durationSeconds: c.durationSeconds,
    energyAddedKwh: c.energyAddedKwh,
    startSoc: c.startSoc,
    endSoc: c.endSoc,
    maxPowerKw: c.maxPowerKw,
    chargerType: c.chargerType,
    cost: c.cost != null ? Number(c.cost) : null,
    currency: c.currency,
    place: resolvePlaceLabel(c.placeName, c.address, null, null),
  }));

  const kpiDrives: KpiDrive[] = sortedDrives.map((d) => ({
    startTime: d.startTime,
    distanceKm: d.distanceKm,
    durationSeconds: d.durationSeconds,
    consumedEnergyKwh: d.consumedEnergyKwh,
    energyIsEstimated: d.energyIsEstimated,
    startSoc: d.startSoc,
    endSoc: d.endSoc,
    ascentM: d.ascentM,
    descentM: d.descentM,
  }));
  const kpiCharges: KpiCharge[] = sortedCharges.map((c) => ({
    startTime: c.startTime,
    durationSeconds: c.durationSeconds,
    energyAddedKwh: c.energyAddedKwh,
    cost: c.cost,
  }));

  const kpis = buildJourneyKpis(kpiDrives, kpiCharges);

  return { journey, driveRows, chargeRows, kpis, meta };
}
