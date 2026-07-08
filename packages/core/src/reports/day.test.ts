import { describe, expect, it } from "vitest";
import { buildDayReport } from "./day.js";
import type { ReportDrive, ReportMeta } from "./types.js";

const meta: ReportMeta = {
  vehicleName: "Model 3",
  generatedAt: new Date("2026-02-02T20:00:00Z"),
  timeZone: "Europe/Berlin",
};

function makeDrive(overrides: Partial<ReportDrive> = {}): ReportDrive {
  return {
    id: 1,
    startTime: new Date("2026-02-02T08:14:00Z"),
    endTime: new Date("2026-02-02T08:47:00Z"),
    startPlaceName: "Zuhause",
    endPlaceName: "Kunde Müller",
    startAddress: null,
    endAddress: null,
    startLat: null,
    startLon: null,
    endLat: null,
    endLon: null,
    startOdometerKm: 12000,
    endOdometerKm: 12027.3,
    distanceKm: 27.3,
    durationSeconds: 1980,
    consumedEnergyKwh: 4.56,
    energyIsEstimated: true,
    avgConsumptionWhKm: 167.03,
    classification: "business",
    purpose: null,
    customer: null,
    project: null,
    notes: null,
    tags: [],
    ...overrides,
  };
}

describe("buildDayReport", () => {
  it("berechnet null-sichere Summen über alle Fahrten", () => {
    const drives = [
      makeDrive({ id: 1, distanceKm: 27.3, durationSeconds: 1980, consumedEnergyKwh: 4.56 }),
      makeDrive({ id: 2, distanceKm: 12.8, durationSeconds: 1020, consumedEnergyKwh: 2.1 }),
    ];

    const report = buildDayReport(drives, "2026-02-02", meta);

    expect(report.totals.driveCount).toBe(2);
    expect(report.totals.distanceKm).toBeCloseTo(40.1, 5);
    expect(report.totals.durationSeconds).toBe(3000);
    expect(report.totals.consumedEnergyKwh).toBeCloseTo(6.66, 5);
    expect(report.totals.anyEstimated).toBe(true);
    expect(report.hasIncompleteData).toBe(false);
  });

  it("markiert hasIncompleteData, falls eine Fahrt keine Distanz hat, und überspringt sie in der Summe", () => {
    const drives = [
      makeDrive({ id: 1, distanceKm: 27.3 }),
      makeDrive({ id: 2, distanceKm: null }),
    ];

    const report = buildDayReport(drives, "2026-02-02", meta);

    expect(report.totals.driveCount).toBe(2);
    expect(report.totals.distanceKm).toBeCloseTo(27.3, 5);
    expect(report.hasIncompleteData).toBe(true);
  });

  it("erzwingt chronologische Reihenfolge auch bei unsortierter Eingabe", () => {
    const early = makeDrive({ id: 1, startTime: new Date("2026-02-02T08:14:00Z") });
    const late = makeDrive({ id: 2, startTime: new Date("2026-02-02T17:04:00Z") });
    const mid = makeDrive({ id: 3, startTime: new Date("2026-02-02T10:22:00Z") });

    const report = buildDayReport([late, early, mid], "2026-02-02", meta);

    expect(report.rows.map((r) => r.id)).toEqual([1, 3, 2]);
  });
});
