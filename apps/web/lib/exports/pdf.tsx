import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { getTranslations } from "next-intl/server";
import {
  formatKw,
  formatTime,
  type Classification,
  type DayReport,
  type DriveReport,
  type JourneyChargeReport,
  type JourneyReport,
  type JourneyType,
  type MonthReport,
} from "@tripatlas/core";
import { toIntlLocale, type IntlLocale } from "../i18nLocale";

type Translator = Awaited<ReturnType<typeof getTranslations>>;

export interface PdfLabels {
  intlLocale: IntlLocale;
  classification: Record<Classification, string>;
  journeyTypes: Record<JourneyType, string>;
  driveHeaders: {
    date: string;
    start: string;
    end: string;
    startPlace: string;
    endPlace: string;
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
    energy: string;
    soc: string;
    power: string;
    type: string;
    cost: string;
  };
  footer: (date: string) => string;
  footerEstimatedSuffix: string;
  drive: {
    title: (date: string) => string;
    kpisTitle: string;
    distance: string;
    duration: string;
    odometerRange: string;
  };
  day: {
    title: (date: string) => string;
    sumTitle: string;
    driveCount: string;
    distance: string;
    duration: string;
    consumedEnergy: string;
  };
  month: {
    title: (monthLabel: string) => string;
    sumByClassification: string;
    driveCountKm: (count: number, km: string) => string;
    total: string;
  };
  journey: {
    title: (name: string) => string;
    kpisTitle: string;
    totalKm: string;
    driveTime: string;
    chargeTime: string;
    chargeStops: string;
    avgConsumption: string;
    consumedEnergy: string;
    chargedEnergy: string;
    elevation: string;
    costLabel: string;
    costLabelWithPer100Km: (value: string) => string;
    costIncomplete: string;
    drivesSection: string;
    chargeStopsSection: string;
  };
}

/**
 * Baut die PDF-Label-Objekte aus den Übersetzungen ("exports" + "common"
 * Namespace). Muss innerhalb der Route (nach getTranslations) aufgerufen
 * werden, da die Texte request-scoped (Locale) sind.
 */
export function buildPdfLabels(t: Translator, tCommon: Translator, locale = "de"): PdfLabels {
  return {
    intlLocale: toIntlLocale(locale),
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
      date: t("pdf.driveHeaders.date"),
      start: t("pdf.driveHeaders.start"),
      end: t("pdf.driveHeaders.end"),
      startPlace: t("pdf.driveHeaders.startPlace"),
      endPlace: t("pdf.driveHeaders.endPlace"),
      distanceKm: t("pdf.driveHeaders.distanceKm"),
      duration: t("pdf.driveHeaders.duration"),
      classification: t("pdf.driveHeaders.classification"),
      purpose: t("pdf.driveHeaders.purpose"),
      customer: t("pdf.driveHeaders.customer"),
      project: t("pdf.driveHeaders.project"),
      notes: t("pdf.driveHeaders.notes"),
    },
    chargeHeaders: {
      date: t("pdf.chargeHeaders.date"),
      start: t("pdf.chargeHeaders.start"),
      end: t("pdf.chargeHeaders.end"),
      place: t("pdf.chargeHeaders.place"),
      duration: t("pdf.chargeHeaders.duration"),
      energy: t("pdf.chargeHeaders.energy"),
      soc: t("pdf.chargeHeaders.soc"),
      power: t("pdf.chargeHeaders.power"),
      type: t("pdf.chargeHeaders.type"),
      cost: t("pdf.chargeHeaders.cost"),
    },
    footer: (date: string) => t("pdf.footer", { date }),
    footerEstimatedSuffix: t("pdf.footerEstimatedSuffix"),
    drive: {
      title: (date: string) => t("pdf.drive.title", { date }),
      kpisTitle: t("pdf.drive.kpisTitle"),
      distance: t("pdf.drive.distance"),
      duration: t("pdf.drive.duration"),
      odometerRange: t("pdf.drive.odometerRange"),
    },
    day: {
      title: (date: string) => t("pdf.day.title", { date }),
      sumTitle: t("pdf.day.sumTitle"),
      driveCount: t("pdf.day.driveCount"),
      distance: t("pdf.day.distance"),
      duration: t("pdf.day.duration"),
      consumedEnergy: t("pdf.day.consumedEnergy"),
    },
    month: {
      title: (monthLabel: string) => t("pdf.month.title", { month: monthLabel }),
      sumByClassification: t("pdf.month.sumByClassification"),
      driveCountKm: (count: number, km: string) => t("pdf.month.driveCountKm", { count, km }),
      total: t("pdf.month.total"),
    },
    journey: {
      title: (name: string) => t("pdf.journey.title", { name }),
      kpisTitle: t("pdf.journey.kpisTitle"),
      totalKm: t("pdf.journey.totalKm"),
      driveTime: t("pdf.journey.driveTime"),
      chargeTime: t("pdf.journey.chargeTime"),
      chargeStops: t("pdf.journey.chargeStops"),
      avgConsumption: t("pdf.journey.avgConsumption"),
      consumedEnergy: t("pdf.journey.consumedEnergy"),
      chargedEnergy: t("pdf.journey.chargedEnergy"),
      elevation: t("pdf.journey.elevation"),
      costLabel: t("pdf.journey.costLabel"),
      costLabelWithPer100Km: (value: string) => t("pdf.journey.costLabelWithPer100Km", { value }),
      costIncomplete: t("pdf.journey.costIncomplete"),
      drivesSection: t("pdf.journey.drivesSection"),
      chargeStopsSection: t("pdf.journey.chargeStopsSection"),
    },
  };
}

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
  },
  header: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 4,
  },
  subHeader: {
    fontSize: 10,
    color: "#555555",
    marginBottom: 16,
  },
  table: {
    display: "flex",
    flexDirection: "column",
    borderTop: "1pt solid #cccccc",
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "0.5pt solid #e0e0e0",
    paddingVertical: 4,
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottom: "1pt solid #333333",
    paddingVertical: 4,
    backgroundColor: "#f2f2f2",
  },
  cell: {
    paddingHorizontal: 3,
  },
  headerCell: {
    paddingHorizontal: 3,
    fontWeight: 700,
  },
  totalsBox: {
    marginTop: 16,
    padding: 10,
    border: "1pt solid #333333",
    borderRadius: 4,
  },
  totalsTitle: {
    fontSize: 10,
    fontWeight: 700,
    marginBottom: 6,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 32,
    right: 32,
    fontSize: 7,
    color: "#888888",
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    marginTop: 16,
    marginBottom: 4,
  },
});

// Column widths (percent) shared by drive tables — must sum to 100.
const COLS = {
  date: "9%",
  start: "6%",
  end: "6%",
  from: "14%",
  to: "14%",
  distance: "8%",
  duration: "7%",
  classification: "10%",
  purpose: "12%",
  customer: "8%",
  project: "8%",
  notes: "8%",
} as const;

function formatDateCell(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

function formatKmCell(km: number | null): string {
  if (km == null) return "–";
  return km.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatDurationCell(seconds: number | null): string {
  if (seconds == null) return "–";
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} min`;
  return `${hours} h ${minutes} min`;
}

function formatGeneratedAt(date: Date, timeZone: string): string {
  const day = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone,
  }).format(date);
  return `${day}, ${formatTime(date, timeZone)}`;
}

function Footer({
  meta,
  labels,
  hasEstimated,
}: {
  meta: { generatedAt: Date; timeZone: string };
  labels: PdfLabels;
  hasEstimated?: boolean;
}) {
  return (
    <Text style={styles.footer} fixed>
      {labels.footer(formatGeneratedAt(meta.generatedAt, meta.timeZone))}
      {hasEstimated ? `  —  ${labels.footerEstimatedSuffix}` : ""}
    </Text>
  );
}

function DriveTableHeader({ labels }: { labels: PdfLabels }) {
  return (
    <View style={styles.tableHeaderRow}>
      <Text style={[styles.headerCell, { width: COLS.date }]}>{labels.driveHeaders.date}</Text>
      <Text style={[styles.headerCell, { width: COLS.start }]}>{labels.driveHeaders.start}</Text>
      <Text style={[styles.headerCell, { width: COLS.end }]}>{labels.driveHeaders.end}</Text>
      <Text style={[styles.headerCell, { width: COLS.from }]}>{labels.driveHeaders.startPlace}</Text>
      <Text style={[styles.headerCell, { width: COLS.to }]}>{labels.driveHeaders.endPlace}</Text>
      <Text style={[styles.headerCell, { width: COLS.distance }]}>{labels.driveHeaders.distanceKm}</Text>
      <Text style={[styles.headerCell, { width: COLS.duration }]}>{labels.driveHeaders.duration}</Text>
      <Text style={[styles.headerCell, { width: COLS.classification }]}>
        {labels.driveHeaders.classification}
      </Text>
      <Text style={[styles.headerCell, { width: COLS.purpose }]}>{labels.driveHeaders.purpose}</Text>
      <Text style={[styles.headerCell, { width: COLS.customer }]}>{labels.driveHeaders.customer}</Text>
      <Text style={[styles.headerCell, { width: COLS.project }]}>{labels.driveHeaders.project}</Text>
      <Text style={[styles.headerCell, { width: COLS.notes }]}>{labels.driveHeaders.notes}</Text>
    </View>
  );
}

function DriveTableRow({
  row,
  timeZone,
  labels,
}: {
  row: DriveReport;
  timeZone: string;
  labels: PdfLabels;
}) {
  return (
    <View style={styles.tableRow} wrap={false}>
      <Text style={[styles.cell, { width: COLS.date }]}>{formatDateCell(row.date)}</Text>
      <Text style={[styles.cell, { width: COLS.start }]}>{formatTime(row.startTime, timeZone)}</Text>
      <Text style={[styles.cell, { width: COLS.end }]}>
        {row.endTime ? formatTime(row.endTime, timeZone) : "–"}
      </Text>
      <Text style={[styles.cell, { width: COLS.from }]}>{row.startPlace}</Text>
      <Text style={[styles.cell, { width: COLS.to }]}>{row.endPlace}</Text>
      <Text style={[styles.cell, { width: COLS.distance }]}>{formatKmCell(row.distanceKm)}</Text>
      <Text style={[styles.cell, { width: COLS.duration }]}>{formatDurationCell(row.durationSeconds)}</Text>
      <Text style={[styles.cell, { width: COLS.classification }]}>
        {labels.classification[row.classification]}
      </Text>
      <Text style={[styles.cell, { width: COLS.purpose }]}>{row.purpose ?? "–"}</Text>
      <Text style={[styles.cell, { width: COLS.customer }]}>{row.customer ?? "–"}</Text>
      <Text style={[styles.cell, { width: COLS.project }]}>{row.project ?? "–"}</Text>
      <Text style={[styles.cell, { width: COLS.notes }]}>{row.notes ?? "–"}</Text>
    </View>
  );
}

// Column widths (percent) for the journey charge-stop table — must sum to 100.
const CHARGE_COLS = {
  date: "8%",
  start: "7%",
  end: "7%",
  place: "26%",
  duration: "9%",
  energy: "10%",
  soc: "10%",
  power: "9%",
  type: "6%",
  cost: "8%",
} as const;

function formatDateOnlyCell(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone,
  }).format(date);
}

function formatEurCell(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

function formatKwhCell(kwh: number): string {
  return `${kwh.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh`;
}

function formatSocRangeCell(startSoc: number | null, endSoc: number | null): string {
  if (startSoc == null && endSoc == null) return "–";
  return `${startSoc ?? "–"} -> ${endSoc ?? "–"} %`;
}

function ChargeTableHeader({ labels }: { labels: PdfLabels }) {
  return (
    <View style={styles.tableHeaderRow}>
      <Text style={[styles.headerCell, { width: CHARGE_COLS.date }]}>{labels.chargeHeaders.date}</Text>
      <Text style={[styles.headerCell, { width: CHARGE_COLS.start }]}>{labels.chargeHeaders.start}</Text>
      <Text style={[styles.headerCell, { width: CHARGE_COLS.end }]}>{labels.chargeHeaders.end}</Text>
      <Text style={[styles.headerCell, { width: CHARGE_COLS.place }]}>{labels.chargeHeaders.place}</Text>
      <Text style={[styles.headerCell, { width: CHARGE_COLS.duration }]}>{labels.chargeHeaders.duration}</Text>
      <Text style={[styles.headerCell, { width: CHARGE_COLS.energy }]}>{labels.chargeHeaders.energy}</Text>
      <Text style={[styles.headerCell, { width: CHARGE_COLS.soc }]}>{labels.chargeHeaders.soc}</Text>
      <Text style={[styles.headerCell, { width: CHARGE_COLS.power }]}>{labels.chargeHeaders.power}</Text>
      <Text style={[styles.headerCell, { width: CHARGE_COLS.type }]}>{labels.chargeHeaders.type}</Text>
      <Text style={[styles.headerCell, { width: CHARGE_COLS.cost }]}>{labels.chargeHeaders.cost}</Text>
    </View>
  );
}

function ChargeTableRow({ row, timeZone }: { row: JourneyChargeReport; timeZone: string }) {
  return (
    <View style={styles.tableRow} wrap={false}>
      <Text style={[styles.cell, { width: CHARGE_COLS.date }]}>
        {formatDateOnlyCell(row.startTime, timeZone)}
      </Text>
      <Text style={[styles.cell, { width: CHARGE_COLS.start }]}>{formatTime(row.startTime, timeZone)}</Text>
      <Text style={[styles.cell, { width: CHARGE_COLS.end }]}>
        {row.endTime ? formatTime(row.endTime, timeZone) : "–"}
      </Text>
      <Text style={[styles.cell, { width: CHARGE_COLS.place }]}>{row.place}</Text>
      <Text style={[styles.cell, { width: CHARGE_COLS.duration }]}>
        {formatDurationCell(row.durationSeconds)}
      </Text>
      <Text style={[styles.cell, { width: CHARGE_COLS.energy }]}>
        {row.energyAddedKwh != null ? formatKwhCell(row.energyAddedKwh) : "–"}
      </Text>
      <Text style={[styles.cell, { width: CHARGE_COLS.soc }]}>
        {formatSocRangeCell(row.startSoc, row.endSoc)}
      </Text>
      <Text style={[styles.cell, { width: CHARGE_COLS.power }]}>
        {row.maxPowerKw != null ? formatKw(row.maxPowerKw) : "–"}
      </Text>
      <Text style={[styles.cell, { width: CHARGE_COLS.type }]}>
        {row.chargerType ? row.chargerType.toUpperCase() : "–"}
      </Text>
      <Text style={[styles.cell, { width: CHARGE_COLS.cost }]}>
        {row.cost != null ? formatEurCell(row.cost) : "–"}
      </Text>
    </View>
  );
}

/** Single-drive PDF export (vision.md §20.1). */
export function DrivePdf({ report, labels }: { report: DriveReport; labels: PdfLabels }) {
  // Helvetica (react-pdf's built-in font) lacks a "→" glyph — use an ASCII-safe separator.
  const title = `${report.startPlace} -> ${report.endPlace}`;
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.header}>{labels.drive.title(formatDateCell(report.date))}</Text>
        <Text style={styles.subHeader}>{`${title} · ${report.meta.vehicleName}`}</Text>

        <View style={styles.table}>
          <DriveTableHeader labels={labels} />
          <DriveTableRow row={report} timeZone={report.meta.timeZone} labels={labels} />
        </View>

        <View style={styles.totalsBox}>
          <Text style={styles.totalsTitle}>{labels.drive.kpisTitle}</Text>
          <View style={styles.totalsRow}>
            <Text>{labels.drive.distance}</Text>
            <Text>{formatKmCell(report.distanceKm)} km</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>{labels.drive.duration}</Text>
            <Text>{formatDurationCell(report.durationSeconds)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>{labels.drive.odometerRange}</Text>
            <Text>
              {report.startOdometerKm != null ? formatKmCell(report.startOdometerKm) : "–"} /{" "}
              {report.endOdometerKm != null ? formatKmCell(report.endOdometerKm) : "–"}
            </Text>
          </View>
        </View>

        <Footer meta={report.meta} labels={labels} />
      </Page>
    </Document>
  );
}

/** Day PDF export (vision.md §20.2): all drives + totals box. */
export function DayPdf({ report, labels }: { report: DayReport; labels: PdfLabels }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.header}>{labels.day.title(formatDateCell(report.date))}</Text>
        <Text style={styles.subHeader}>{report.meta.vehicleName}</Text>

        <View style={styles.table}>
          <DriveTableHeader labels={labels} />
          {report.rows.map((row) => (
            <DriveTableRow key={row.id} row={row} timeZone={report.meta.timeZone} labels={labels} />
          ))}
        </View>

        <View style={styles.totalsBox}>
          <Text style={styles.totalsTitle}>{labels.day.sumTitle}</Text>
          <View style={styles.totalsRow}>
            <Text>{labels.day.driveCount}</Text>
            <Text>{report.totals.driveCount}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>{labels.day.distance}</Text>
            <Text>{formatKmCell(report.totals.distanceKm)} km</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>{labels.day.duration}</Text>
            <Text>{formatDurationCell(report.totals.durationSeconds)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>{labels.day.consumedEnergy}</Text>
            <Text>
              {report.totals.consumedEnergyKwh.toLocaleString("de-DE", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}{" "}
              kWh{report.totals.anyEstimated ? ` ~` : ""}
            </Text>
          </View>
        </View>

        <Footer meta={report.meta} labels={labels} hasEstimated={report.totals.anyEstimated} />
      </Page>
    </Document>
  );
}

/** Month PDF export (vision.md §20.3): Fahrtenbuch table + per-classification totals. */
export function MonthPdf({ report, labels }: { report: MonthReport; labels: PdfLabels }) {
  const monthLabel = formatMonthLabel(report.month, labels.intlLocale);
  const anyEstimated = false; // month report has no energy totals per §20.3

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.header}>{labels.month.title(monthLabel)}</Text>
        <Text style={styles.subHeader}>{report.meta.vehicleName}</Text>

        <View style={styles.table}>
          <DriveTableHeader labels={labels} />
          {report.rows.map((row) => (
            <DriveTableRow key={row.id} row={row} timeZone={report.meta.timeZone} labels={labels} />
          ))}
        </View>

        <View style={styles.totalsBox}>
          <Text style={styles.totalsTitle}>{labels.month.sumByClassification}</Text>
          {Object.values(report.byClassification)
            .filter((bucket) => bucket.driveCount > 0)
            .map((bucket) => (
              <View style={styles.totalsRow} key={bucket.classification}>
                <Text>{labels.classification[bucket.classification]}</Text>
                <Text>{labels.month.driveCountKm(bucket.driveCount, formatKmCell(bucket.distanceKm))}</Text>
              </View>
            ))}
          <View style={[styles.totalsRow, { marginTop: 6, borderTop: "0.5pt solid #cccccc", paddingTop: 4 }]}>
            <Text style={{ fontWeight: 700 }}>{labels.month.total}</Text>
            <Text style={{ fontWeight: 700 }}>
              {labels.month.driveCountKm(report.totals.driveCount, formatKmCell(report.totals.distanceKm))}
            </Text>
          </View>
        </View>

        <Footer meta={report.meta} labels={labels} hasEstimated={anyEstimated} />
      </Page>
    </Document>
  );
}

/** Journey PDF export (vision.md §20.4): KPI grid + Fahrten-Tabelle + Ladestopps-Tabelle. */
export function JourneyPdf({ report, labels }: { report: JourneyReport; labels: PdfLabels }) {
  const { journey, driveRows, chargeRows, kpis, meta } = report;
  const rangeLabel = `${formatDateOnlyCell(journey.startTime, meta.timeZone)} - ${formatDateOnlyCell(journey.endTime, meta.timeZone)}`;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.header}>{labels.journey.title(journey.name)}</Text>
        <Text style={styles.subHeader}>
          {`${rangeLabel} · ${labels.journeyTypes[journey.type]} · ${meta.vehicleName}`}
        </Text>

        <View style={styles.totalsBox}>
          <Text style={styles.totalsTitle}>{labels.journey.kpisTitle}</Text>
          <View style={styles.totalsRow}>
            <Text>{labels.journey.totalKm}</Text>
            <Text>{formatKmCell(kpis.totalDistanceKm)} km</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>{labels.journey.driveTime}</Text>
            <Text>{formatDurationCell(kpis.driveTimeSeconds)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>{labels.journey.chargeTime}</Text>
            <Text>{formatDurationCell(kpis.chargeTimeSeconds)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>{labels.journey.chargeStops}</Text>
            <Text>{kpis.chargeStopCount}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>{labels.journey.avgConsumption}</Text>
            <Text>
              {kpis.avgConsumptionWhKm != null
                ? `${Math.round(kpis.avgConsumptionWhKm)} Wh/km${kpis.anyEstimated ? ` ~` : ""}`
                : "–"}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>{labels.journey.consumedEnergy}</Text>
            <Text>
              {formatKwhCell(kpis.consumedEnergyKwh)}
              {kpis.anyEstimated ? ` ~` : ""}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>{labels.journey.chargedEnergy}</Text>
            <Text>{formatKwhCell(kpis.chargedEnergyKwh)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>{labels.journey.elevation}</Text>
            <Text>
              {kpis.ascentM} m / {kpis.descentM} m
            </Text>
          </View>
          {kpis.totalCost != null && (
            <View style={styles.totalsRow}>
              <Text>
                {kpis.costPer100Km != null
                  ? labels.journey.costLabelWithPer100Km(formatEurCell(kpis.costPer100Km))
                  : labels.journey.costLabel}
              </Text>
              <Text>
                {formatEurCell(kpis.totalCost)}
                {kpis.hasIncompleteCost ? ` ${labels.journey.costIncomplete}` : ""}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>{labels.journey.drivesSection}</Text>
        <View style={styles.table}>
          <DriveTableHeader labels={labels} />
          {driveRows.map((row) => (
            <DriveTableRow key={row.id} row={row} timeZone={meta.timeZone} labels={labels} />
          ))}
        </View>

        {chargeRows.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{labels.journey.chargeStopsSection}</Text>
            <View style={styles.table}>
              <ChargeTableHeader labels={labels} />
              {chargeRows.map((row) => (
                <ChargeTableRow key={row.id} row={row} timeZone={meta.timeZone} />
              ))}
            </View>
          </>
        )}

        <Footer meta={meta} labels={labels} hasEstimated={kpis.anyEstimated} />
      </Page>
    </Document>
  );
}

function formatMonthLabel(month: string, locale: IntlLocale): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, 1));
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export async function renderDrivePdf(report: DriveReport, labels: PdfLabels): Promise<Buffer> {
  return renderToBuffer(<DrivePdf report={report} labels={labels} />);
}

export async function renderDayPdf(report: DayReport, labels: PdfLabels): Promise<Buffer> {
  return renderToBuffer(<DayPdf report={report} labels={labels} />);
}

export async function renderMonthPdf(report: MonthReport, labels: PdfLabels): Promise<Buffer> {
  return renderToBuffer(<MonthPdf report={report} labels={labels} />);
}

export async function renderJourneyPdf(report: JourneyReport, labels: PdfLabels): Promise<Buffer> {
  return renderToBuffer(<JourneyPdf report={report} labels={labels} />);
}
