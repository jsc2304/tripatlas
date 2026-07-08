import { describe, expect, it } from "vitest";
import { buildJourneyReport } from "./report.js";
import type { JourneyInfo, JourneyReportCharge, JourneyReportDrive } from "./types.js";
import type { ReportMeta } from "../reports/types.js";

const meta: ReportMeta = {
  vehicleName: "Model 3",
  generatedAt: new Date("2026-06-20T08:00:00Z"),
  timeZone: "Europe/Berlin",
};

const journey: JourneyInfo = {
  name: "Alpenrundfahrt",
  type: "roadtrip",
  startTime: new Date("2026-06-13T06:00:00Z"),
  endTime: new Date("2026-06-14T18:00:00Z"),
  description: null,
};

function makeDrive(overrides: Partial<JourneyReportDrive> = {}): JourneyReportDrive {
  return {
    id: 1,
    startTime: new Date("2026-06-13T07:00:00Z"),
    endTime: new Date("2026-06-13T07:35:00Z"),
    startPlaceName: "Zuhause",
    endPlaceName: "Alpenpass",
    startAddress: null,
    endAddress: null,
    startLat: null,
    startLon: null,
    endLat: null,
    endLon: null,
    startOdometerKm: 1000,
    endOdometerKm: 1060,
    distanceKm: 60,
    durationSeconds: 2100,
    consumedEnergyKwh: 10,
    energyIsEstimated: false,
    avgConsumptionWhKm: 166.7,
    classification: "private",
    purpose: null,
    customer: null,
    project: null,
    notes: null,
    tags: [],
    startSoc: 80,
    endSoc: 60,
    ascentM: 100,
    descentM: 50,
    ...overrides,
  };
}

function makeCharge(overrides: Partial<JourneyReportCharge> = {}): JourneyReportCharge {
  return {
    id: 1,
    startTime: new Date("2026-06-13T07:40:00Z"),
    endTime: new Date("2026-06-13T08:00:00Z"),
    durationSeconds: 1200,
    energyAddedKwh: 20,
    startSoc: 60,
    endSoc: 90,
    maxPowerKw: 150,
    chargerType: "dc",
    cost: "16.50",
    currency: "EUR",
    placeName: "Ladepark Süd",
    address: null,
    ...overrides,
  };
}

describe("buildJourneyReport", () => {
  it("baut Fahrt-Zeilen über denselben buildDriveReport wie Tages-/Monatsreport", () => {
    const report = buildJourneyReport(journey, [makeDrive({ id: 5 })], [], meta);

    expect(report.driveRows).toHaveLength(1);
    expect(report.driveRows[0]!.id).toBe(5);
    expect(report.driveRows[0]!.startPlace).toBe("Zuhause");
    expect(report.driveRows[0]!.endPlace).toBe("Alpenpass");
    expect(report.driveRows[0]!.meta).toBe(meta);
  });

  it("löst den Ladestopp-Ort auf und parst Kosten als Zahl", () => {
    const report = buildJourneyReport(journey, [], [makeCharge({ id: 9, cost: "16.50" })], meta);

    expect(report.chargeRows).toHaveLength(1);
    const row = report.chargeRows[0]!;
    expect(row.id).toBe(9);
    expect(row.place).toBe("Ladepark Süd");
    expect(row.cost).toBeCloseTo(16.5);
  });

  it("behandelt fehlende Ladestopp-Kosten als null", () => {
    const report = buildJourneyReport(journey, [], [makeCharge({ cost: null })], meta);
    expect(report.chargeRows[0]!.cost).toBeNull();
  });

  it("fällt beim Ladestopp-Ort auf Adresse zurück, wenn kein Place-Name vorliegt", () => {
    const report = buildJourneyReport(
      journey,
      [],
      [makeCharge({ placeName: null, address: "Hauptstr. 1" })],
      meta,
    );
    expect(report.chargeRows[0]!.place).toBe("Hauptstr. 1");
  });

  it("sortiert Fahrten und Ladestopps chronologisch, unabhängig von der Eingabereihenfolge", () => {
    const early = makeDrive({ id: 1, startTime: new Date("2026-06-13T07:00:00Z") });
    const late = makeDrive({ id: 2, startTime: new Date("2026-06-14T09:00:00Z") });
    const earlyCharge = makeCharge({ id: 1, startTime: new Date("2026-06-13T08:00:00Z") });
    const lateCharge = makeCharge({ id: 2, startTime: new Date("2026-06-14T10:00:00Z") });

    const report = buildJourneyReport(journey, [late, early], [lateCharge, earlyCharge], meta);

    expect(report.driveRows.map((r) => r.id)).toEqual([1, 2]);
    expect(report.chargeRows.map((r) => r.id)).toEqual([1, 2]);
  });

  it("berechnet die Kennzahlen konsistent mit buildJourneyKpis", () => {
    const drives = [
      makeDrive({ id: 1, distanceKm: 60, consumedEnergyKwh: 10 }),
      makeDrive({
        id: 2,
        startTime: new Date("2026-06-14T09:00:00Z"),
        distanceKm: 120,
        consumedEnergyKwh: 21,
      }),
    ];
    const charges = [makeCharge({ energyAddedKwh: 19.55, cost: "16.50" })];

    const report = buildJourneyReport(journey, drives, charges, meta);

    expect(report.kpis.totalDistanceKm).toBe(180);
    expect(report.kpis.consumedEnergyKwh).toBe(31);
    expect(report.kpis.chargedEnergyKwh).toBeCloseTo(19.55);
    expect(report.kpis.chargeStopCount).toBe(1);
    expect(report.kpis.totalCost).toBeCloseTo(16.5);
  });

  it("liefert leere Zeilen und genullte Kennzahlen für eine Reise ohne Fahrten/Ladestopps", () => {
    const report = buildJourneyReport(journey, [], [], meta);

    expect(report.driveRows).toEqual([]);
    expect(report.chargeRows).toEqual([]);
    expect(report.kpis.totalDistanceKm).toBe(0);
    expect(report.kpis.chargeStopCount).toBe(0);
    expect(report.journey).toBe(journey);
    expect(report.meta).toBe(meta);
  });
});
