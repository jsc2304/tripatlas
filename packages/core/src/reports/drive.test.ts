import { describe, expect, it } from "vitest";
import { buildDriveReport, resolvePlaceLabel } from "./drive.js";
import type { ReportDrive, ReportMeta } from "./types.js";

const meta: ReportMeta = {
  vehicleName: "Model 3",
  generatedAt: new Date("2026-02-02T12:00:00Z"),
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
    startLat: 48.137154,
    startLon: 11.576124,
    endLat: 48.148221,
    endLon: 11.558882,
    startOdometerKm: 12000,
    endOdometerKm: 12027.3,
    distanceKm: 27.3,
    durationSeconds: 1980,
    consumedEnergyKwh: 4.56,
    energyIsEstimated: true,
    avgConsumptionWhKm: 167.03,
    classification: "business",
    purpose: "Kundentermin",
    customer: "Müller",
    project: null,
    notes: null,
    tags: ["kunde-müller"],
    ...overrides,
  };
}

describe("resolvePlaceLabel", () => {
  it("bevorzugt den Place-Namen", () => {
    expect(resolvePlaceLabel("Zuhause", "Musterstr. 1", 1, 2)).toBe("Zuhause");
  });

  it("fällt auf die Adresse zurück, falls kein Place bekannt ist", () => {
    expect(resolvePlaceLabel(null, "Musterstr. 1", 1, 2)).toBe("Musterstr. 1");
  });

  it("fällt auf Koordinaten (5 Nachkommastellen) zurück, falls keine Adresse bekannt ist", () => {
    expect(resolvePlaceLabel(null, null, 48.137154321, 11.576124321)).toBe(
      "48.13715, 11.57612",
    );
  });

  it("liefert '–', falls gar nichts bekannt ist", () => {
    expect(resolvePlaceLabel(null, null, null, null)).toBe("–");
  });
});

describe("buildDriveReport", () => {
  it("mappt alle Pflichtfelder aus vision.md §20.1 typisiert", () => {
    const report = buildDriveReport(makeDrive(), meta);

    expect(report.date).toBe("2026-02-02");
    expect(report.startTime).toEqual(new Date("2026-02-02T08:14:00Z"));
    expect(report.endTime).toEqual(new Date("2026-02-02T08:47:00Z"));
    expect(report.startPlace).toBe("Zuhause");
    expect(report.endPlace).toBe("Kunde Müller");
    expect(report.startOdometerKm).toBe(12000);
    expect(report.endOdometerKm).toBe(12027.3);
    expect(report.distanceKm).toBe(27.3);
    expect(report.durationSeconds).toBe(1980);
    expect(report.classification).toBe("business");
    expect(report.purpose).toBe("Kundentermin");
    expect(report.customer).toBe("Müller");
    expect(report.project).toBeNull();
    expect(report.notes).toBeNull();
    expect(report.meta).toBe(meta);
  });

  it("nutzt die Ort-Fallback-Kette: Place → Adresse → Koordinaten → '–'", () => {
    const withAddress = buildDriveReport(
      makeDrive({ startPlaceName: null, startAddress: "Musterstr. 1" }),
      meta,
    );
    expect(withAddress.startPlace).toBe("Musterstr. 1");

    const withCoords = buildDriveReport(
      makeDrive({ startPlaceName: null, startAddress: null }),
      meta,
    );
    expect(withCoords.startPlace).toBe("48.13715, 11.57612");

    const withNothing = buildDriveReport(
      makeDrive({
        startPlaceName: null,
        startAddress: null,
        startLat: null,
        startLon: null,
      }),
      meta,
    );
    expect(withNothing.startPlace).toBe("–");
  });
});
