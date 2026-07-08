import { stringify } from "csv-stringify/sync";
import type { getTranslations } from "next-intl/server";
import {
  formatTime,
  type Classification,
  type DayReport,
  type DriveReport,
  type JourneyChargeReport,
  type JourneyReport,
  type JourneyType,
  type MonthReport,
} from "@tripatlas/core";

// Excel (esp. on Windows/de-DE locale) needs a UTF-8 BOM to render Umlaute
// correctly and a ";" delimiter is the de-DE default list separator.
const BOM = "﻿";
const DELIMITER = ";";

type Translator = Awaited<ReturnType<typeof getTranslations>>;

export interface CsvLabels {
  classification: Record<Classification, string>;
  journeyTypes: Record<JourneyType, string>;
  driveHeaders: {
    date: string;
    startTime: string;
    endTime: string;
    startPlace: string;
    endPlace: string;
    odometerStart: string;
    odometerEnd: string;
    distanceKm: string;
    duration: string;
    classification: string;
    purpose: string;
    customer: string;
    project: string;
    notes: string;
  };
  chargeHeaders: {
    date: string;
    start: string;
    end: string;
    place: string;
    duration: string;
    chargedKwh: string;
    startSoc: string;
    endSoc: string;
    maxPowerKw: string;
    type: string;
    cost: string;
  };
  day: {
    sumTitle: string;
    driveCount: string;
    distanceKm: string;
    duration: string;
    consumedEnergyKwh: string;
    note: string;
    incompleteNote: string;
    estimatedMarker: string;
    estimatedValue: string;
  };
  month: {
    sumByClassification: string;
    classification: string;
    driveCount: string;
    distanceKm: string;
    total: string;
    note: string;
    incompleteNote: string;
  };
  journey: {
    journey: string;
    period: string;
    type: string;
    drivesSection: string;
    chargeStopsSection: string;
    kpisTitle: string;
    totalKm: string;
    driveTime: string;
    chargeTime: string;
    chargeStopCount: string;
    avgConsumption: string;
    consumedEnergyKwh: string;
    chargedEnergyKwh: string;
    ascentM: string;
    descentM: string;
    cost: string;
    costPer100Km: string;
    note: string;
    incompleteCostNote: string;
    costIncomplete: string;
    estimatedMarker: string;
    estimatedValue: string;
  };
}

/**
 * Baut die CSV-Label-Objekte aus den Übersetzungen ("exports" + "common"
 * Namespace). Muss innerhalb der Route (nach getTranslations) aufgerufen
 * werden, da die Texte request-scoped (Locale) sind.
 */
export function buildCsvLabels(t: Translator, tCommon: Translator): CsvLabels {
  return {
    classification: {
      unclassified: tCommon("classification.unclassified"),
      private: tCommon("classification.private"),
      business: tCommon("classification.business"),
      commute: tCommon("classification.commute"),
    },
    journeyTypes: {
      vacation: t("journeyTypes.vacation"),
      business_trip: t("journeyTypes.business_trip"),
      roadtrip: t("journeyTypes.roadtrip"),
      other: t("journeyTypes.other"),
    },
    driveHeaders: {
      date: t("csv.driveHeaders.date"),
      startTime: t("csv.driveHeaders.startTime"),
      endTime: t("csv.driveHeaders.endTime"),
      startPlace: t("csv.driveHeaders.startPlace"),
      endPlace: t("csv.driveHeaders.endPlace"),
      odometerStart: t("csv.driveHeaders.odometerStart"),
      odometerEnd: t("csv.driveHeaders.odometerEnd"),
      distanceKm: t("csv.driveHeaders.distanceKm"),
      duration: t("csv.driveHeaders.duration"),
      classification: t("csv.driveHeaders.classification"),
      purpose: t("csv.driveHeaders.purpose"),
      customer: t("csv.driveHeaders.customer"),
      project: t("csv.driveHeaders.project"),
      notes: t("csv.driveHeaders.notes"),
    },
    chargeHeaders: {
      date: t("csv.chargeHeaders.date"),
      start: t("csv.chargeHeaders.start"),
      end: t("csv.chargeHeaders.end"),
      place: t("csv.chargeHeaders.place"),
      duration: t("csv.chargeHeaders.duration"),
      chargedKwh: t("csv.chargeHeaders.chargedKwh"),
      startSoc: t("csv.chargeHeaders.startSoc"),
      endSoc: t("csv.chargeHeaders.endSoc"),
      maxPowerKw: t("csv.chargeHeaders.maxPowerKw"),
      type: t("csv.chargeHeaders.type"),
      cost: t("csv.chargeHeaders.cost"),
    },
    day: {
      sumTitle: t("csv.day.sumTitle"),
      driveCount: t("csv.day.driveCount"),
      distanceKm: t("csv.day.distanceKm"),
      duration: t("csv.day.duration"),
      consumedEnergyKwh: t("csv.day.consumedEnergyKwh"),
      note: t("csv.day.note"),
      incompleteNote: t("csv.day.incompleteNote"),
      estimatedMarker: t("csv.day.estimatedMarker"),
      estimatedValue: t("csv.day.estimatedValue"),
    },
    month: {
      sumByClassification: t("csv.month.sumByClassification"),
      classification: t("csv.month.classification"),
      driveCount: t("csv.month.driveCount"),
      distanceKm: t("csv.month.distanceKm"),
      total: t("csv.month.total"),
      note: t("csv.month.note"),
      incompleteNote: t("csv.month.incompleteNote"),
    },
    journey: {
      journey: t("csv.journey.journey"),
      period: t("csv.journey.period"),
      type: t("csv.journey.type"),
      drivesSection: t("csv.journey.drivesSection"),
      chargeStopsSection: t("csv.journey.chargeStopsSection"),
      kpisTitle: t("csv.journey.kpisTitle"),
      totalKm: t("csv.journey.totalKm"),
      driveTime: t("csv.journey.driveTime"),
      chargeTime: t("csv.journey.chargeTime"),
      chargeStopCount: t("csv.journey.chargeStopCount"),
      avgConsumption: t("csv.journey.avgConsumption"),
      consumedEnergyKwh: t("csv.journey.consumedEnergyKwh"),
      chargedEnergyKwh: t("csv.journey.chargedEnergyKwh"),
      ascentM: t("csv.journey.ascentM"),
      descentM: t("csv.journey.descentM"),
      cost: t("csv.journey.cost"),
      costPer100Km: t("csv.journey.costPer100Km"),
      note: t("csv.journey.note"),
      incompleteCostNote: t("csv.journey.incompleteCostNote"),
      costIncomplete: t("csv.journey.costIncomplete"),
      estimatedMarker: t("csv.journey.estimatedMarker"),
      estimatedValue: t("csv.journey.estimatedValue"),
    },
  };
}

function driveHeaderRow(labels: CsvLabels): string[] {
  return [
    labels.driveHeaders.date,
    labels.driveHeaders.startTime,
    labels.driveHeaders.endTime,
    labels.driveHeaders.startPlace,
    labels.driveHeaders.endPlace,
    labels.driveHeaders.odometerStart,
    labels.driveHeaders.odometerEnd,
    labels.driveHeaders.distanceKm,
    labels.driveHeaders.duration,
    labels.driveHeaders.classification,
    labels.driveHeaders.purpose,
    labels.driveHeaders.customer,
    labels.driveHeaders.project,
    labels.driveHeaders.notes,
  ];
}

/** German-locale decimal-comma formatting for a raw number (no unit, no rounding beyond `decimals`). */
function formatNumber(value: number, decimals: number): string {
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

function formatDurationCell(seconds: number | null): string {
  if (seconds == null) return "";
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

function driveRow(row: DriveReport, timeZone: string, labels: CsvLabels): string[] {
  return [
    formatDate(row.date),
    formatTime(row.startTime, timeZone),
    row.endTime ? formatTime(row.endTime, timeZone) : "",
    row.startPlace,
    row.endPlace,
    row.startOdometerKm != null ? formatNumber(row.startOdometerKm, 1) : "",
    row.endOdometerKm != null ? formatNumber(row.endOdometerKm, 1) : "",
    row.distanceKm != null ? formatNumber(row.distanceKm, 1) : "",
    formatDurationCell(row.durationSeconds),
    labels.classification[row.classification],
    row.purpose ?? "",
    row.customer ?? "",
    row.project ?? "",
    row.notes ?? "",
  ];
}

function toCsv(rows: string[][]): string {
  return BOM + stringify(rows, { delimiter: DELIMITER });
}

/** Renders a single-drive export (vision.md §20.1 Pflichtfelder) as CSV. */
export function renderDriveCsv(report: DriveReport, labels: CsvLabels): string {
  const rows: string[][] = [
    driveHeaderRow(labels),
    driveRow(report, report.meta.timeZone, labels),
  ];
  return toCsv(rows);
}

/** Renders a day export (vision.md §20.2): all drives + a totals section. */
export function renderDayCsv(report: DayReport, labels: CsvLabels): string {
  const rows: string[][] = [driveHeaderRow(labels)];
  for (const row of report.rows) {
    rows.push(driveRow(row, report.meta.timeZone, labels));
  }

  rows.push([]);
  rows.push([labels.day.sumTitle]);
  rows.push([labels.day.driveCount, String(report.totals.driveCount)]);
  rows.push([labels.day.distanceKm, formatNumber(report.totals.distanceKm, 1)]);
  rows.push([labels.day.duration, formatDurationCell(report.totals.durationSeconds)]);
  rows.push([
    labels.day.consumedEnergyKwh,
    `${formatNumber(report.totals.consumedEnergyKwh, 1)}${report.totals.anyEstimated ? ` ${labels.day.estimatedMarker}` : ""}`,
  ]);
  if (report.hasIncompleteData) {
    rows.push([labels.day.note, labels.day.incompleteNote]);
  }
  if (report.totals.anyEstimated) {
    rows.push([labels.day.estimatedMarker, labels.day.estimatedValue]);
  }

  return toCsv(rows);
}

/** Renders a month export (vision.md §20.3): drives + per-classification summary. */
export function renderMonthCsv(report: MonthReport, labels: CsvLabels): string {
  const rows: string[][] = [driveHeaderRow(labels)];
  for (const row of report.rows) {
    rows.push(driveRow(row, report.meta.timeZone, labels));
  }

  rows.push([]);
  rows.push([labels.month.sumByClassification]);
  rows.push([labels.month.classification, labels.month.driveCount, labels.month.distanceKm]);
  for (const bucket of Object.values(report.byClassification)) {
    if (bucket.driveCount === 0) continue;
    rows.push([
      labels.classification[bucket.classification],
      String(bucket.driveCount),
      formatNumber(bucket.distanceKm, 1),
    ]);
  }
  rows.push([]);
  rows.push([labels.month.total, String(report.totals.driveCount), formatNumber(report.totals.distanceKm, 1)]);
  if (report.hasIncompleteData) {
    rows.push([]);
    rows.push([labels.month.note, labels.month.incompleteNote]);
  }

  return toCsv(rows);
}

function chargeHeaderRow(labels: CsvLabels): string[] {
  return [
    labels.chargeHeaders.date,
    labels.chargeHeaders.start,
    labels.chargeHeaders.end,
    labels.chargeHeaders.place,
    labels.chargeHeaders.duration,
    labels.chargeHeaders.chargedKwh,
    labels.chargeHeaders.startSoc,
    labels.chargeHeaders.endSoc,
    labels.chargeHeaders.maxPowerKw,
    labels.chargeHeaders.type,
    labels.chargeHeaders.cost,
  ];
}

function formatDateOnly(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone,
  }).format(date);
}

function journeyChargeRow(row: JourneyChargeReport, timeZone: string): string[] {
  return [
    formatDateOnly(row.startTime, timeZone),
    formatTime(row.startTime, timeZone),
    row.endTime ? formatTime(row.endTime, timeZone) : "",
    row.place,
    formatDurationCell(row.durationSeconds),
    row.energyAddedKwh != null ? formatNumber(row.energyAddedKwh, 1) : "",
    row.startSoc != null ? String(row.startSoc) : "",
    row.endSoc != null ? String(row.endSoc) : "",
    row.maxPowerKw != null ? formatNumber(row.maxPowerKw, 1) : "",
    row.chargerType ? row.chargerType.toUpperCase() : "",
    row.cost != null ? formatNumber(row.cost, 2) : "",
  ];
}

/**
 * Renders a journey export (vision.md §20.4): journey header block, all
 * drives, all charge stops and the journey KPI summary (distance,
 * consumption, energy, cost, elevation).
 */
export function renderJourneyCsv(report: JourneyReport, labels: CsvLabels): string {
  const { journey, driveRows, chargeRows, kpis, meta } = report;
  const rows: string[][] = [];

  rows.push([labels.journey.journey, journey.name]);
  rows.push([
    labels.journey.period,
    `${formatDateOnly(journey.startTime, meta.timeZone)} – ${formatDateOnly(journey.endTime, meta.timeZone)}`,
  ]);
  rows.push([labels.journey.type, labels.journeyTypes[journey.type]]);

  rows.push([]);
  rows.push([labels.journey.drivesSection]);
  rows.push(driveHeaderRow(labels));
  for (const row of driveRows) {
    rows.push(driveRow(row, meta.timeZone, labels));
  }

  rows.push([]);
  rows.push([labels.journey.chargeStopsSection]);
  rows.push(chargeHeaderRow(labels));
  for (const row of chargeRows) {
    rows.push(journeyChargeRow(row, meta.timeZone));
  }

  rows.push([]);
  rows.push([labels.journey.kpisTitle]);
  rows.push([labels.journey.totalKm, formatNumber(kpis.totalDistanceKm, 1)]);
  rows.push([labels.journey.driveTime, formatDurationCell(kpis.driveTimeSeconds)]);
  rows.push([labels.journey.chargeTime, formatDurationCell(kpis.chargeTimeSeconds)]);
  rows.push([labels.journey.chargeStopCount, String(kpis.chargeStopCount)]);
  rows.push([
    labels.journey.avgConsumption,
    kpis.avgConsumptionWhKm != null
      ? `${formatNumber(kpis.avgConsumptionWhKm, 0)}${kpis.anyEstimated ? ` ${labels.journey.estimatedMarker}` : ""}`
      : "",
  ]);
  rows.push([
    labels.journey.consumedEnergyKwh,
    `${formatNumber(kpis.consumedEnergyKwh, 1)}${kpis.anyEstimated ? ` ${labels.journey.estimatedMarker}` : ""}`,
  ]);
  rows.push([labels.journey.chargedEnergyKwh, formatNumber(kpis.chargedEnergyKwh, 1)]);
  rows.push([labels.journey.ascentM, String(kpis.ascentM)]);
  rows.push([labels.journey.descentM, String(kpis.descentM)]);
  rows.push([
    labels.journey.cost,
    kpis.totalCost != null
      ? `${formatNumber(kpis.totalCost, 2)}${kpis.hasIncompleteCost ? ` ${labels.journey.costIncomplete}` : ""}`
      : "",
  ]);
  rows.push([
    labels.journey.costPer100Km,
    kpis.costPer100Km != null ? formatNumber(kpis.costPer100Km, 2) : "",
  ]);
  if (kpis.hasIncompleteCost) {
    rows.push([]);
    rows.push([labels.journey.note, labels.journey.incompleteCostNote]);
  }
  if (kpis.anyEstimated) {
    rows.push([labels.journey.estimatedMarker, labels.journey.estimatedValue]);
  }

  return toCsv(rows);
}
