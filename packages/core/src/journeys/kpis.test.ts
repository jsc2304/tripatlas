import { describe, expect, it } from "vitest";
import { buildJourneyKpis, type KpiCharge, type KpiDrive } from "./kpis.js";

function makeDrive(overrides: Partial<KpiDrive> = {}): KpiDrive {
  return {
    startTime: new Date("2026-06-13T07:00:00Z"),
    distanceKm: 60,
    durationSeconds: 2100,
    consumedEnergyKwh: 10,
    energyIsEstimated: false,
    startSoc: 80,
    endSoc: 60,
    ascentM: 100,
    descentM: 50,
    ...overrides,
  };
}

function makeCharge(overrides: Partial<KpiCharge> = {}): KpiCharge {
  return {
    startTime: new Date("2026-06-13T07:40:00Z"),
    durationSeconds: 780,
    energyAddedKwh: 20,
    cost: "16.50",
    ...overrides,
  };
}

describe("buildJourneyKpis", () => {
  it("computes sums and derived KPIs for a normal journey", () => {
    const drives = [
      makeDrive({
        startTime: new Date("2026-06-13T07:00:00Z"),
        distanceKm: 60,
        durationSeconds: 2100,
        consumedEnergyKwh: 10,
        startSoc: 80,
        endSoc: 60,
        ascentM: 100,
        descentM: 50,
      }),
      makeDrive({
        startTime: new Date("2026-06-14T14:00:00Z"),
        distanceKm: 120,
        durationSeconds: 4800,
        consumedEnergyKwh: 21,
        startSoc: 75,
        endSoc: 41,
        ascentM: 15,
        descentM: 17,
      }),
    ];
    const charges = [makeCharge({ energyAddedKwh: 19.55, cost: "16.50", durationSeconds: 780 })];

    const k = buildJourneyKpis(drives, charges);

    expect(k.totalDistanceKm).toBe(180);
    expect(k.driveTimeSeconds).toBe(6900);
    expect(k.chargeTimeSeconds).toBe(780);
    expect(k.chargeStopCount).toBe(1);
    expect(k.consumedEnergyKwh).toBe(31);
    expect(k.chargedEnergyKwh).toBeCloseTo(19.55);
    // 31 kWh / 180 km = 172.22 Wh/km
    expect(k.avgConsumptionWhKm).toBeCloseTo((31 * 1000) / 180);
    expect(k.anyEstimated).toBe(false);
    // Start = first drive start, End = last drive end (chronological)
    expect(k.startSoc).toBe(80);
    expect(k.endSoc).toBe(41);
    expect(k.minSoc).toBe(41);
    expect(k.maxSoc).toBe(80);
    expect(k.totalCost).toBeCloseTo(16.5);
    expect(k.hasIncompleteCost).toBe(false);
    // 16.5 / 180 * 100 = 9.1667
    expect(k.costPer100Km).toBeCloseTo((16.5 / 180) * 100);
    expect(k.ascentM).toBe(115);
    expect(k.descentM).toBe(67);
  });

  it("sorts by startTime so start/end SoC follow chronology regardless of input order", () => {
    const later = makeDrive({
      startTime: new Date("2026-06-14T14:00:00Z"),
      startSoc: 75,
      endSoc: 41,
    });
    const earlier = makeDrive({
      startTime: new Date("2026-06-13T07:00:00Z"),
      startSoc: 90,
      endSoc: 60,
    });
    const k = buildJourneyKpis([later, earlier], []);
    expect(k.startSoc).toBe(90);
    expect(k.endSoc).toBe(41);
  });

  it("returns zeroed KPIs and null derived values for an empty journey", () => {
    const k = buildJourneyKpis([], []);
    expect(k.totalDistanceKm).toBe(0);
    expect(k.driveTimeSeconds).toBe(0);
    expect(k.chargeTimeSeconds).toBe(0);
    expect(k.chargeStopCount).toBe(0);
    expect(k.consumedEnergyKwh).toBe(0);
    expect(k.chargedEnergyKwh).toBe(0);
    expect(k.avgConsumptionWhKm).toBeNull();
    expect(k.startSoc).toBeNull();
    expect(k.endSoc).toBeNull();
    expect(k.minSoc).toBeNull();
    expect(k.maxSoc).toBeNull();
    expect(k.totalCost).toBeNull();
    expect(k.hasIncompleteCost).toBe(false);
    expect(k.costPer100Km).toBeNull();
    expect(k.ascentM).toBe(0);
    expect(k.descentM).toBe(0);
  });

  it("is null-safe with partial data (missing distance/energy/soc/cost)", () => {
    const drives = [
      makeDrive({
        distanceKm: null,
        durationSeconds: null,
        consumedEnergyKwh: null,
        startSoc: null,
        endSoc: null,
        ascentM: null,
        descentM: null,
      }),
      makeDrive({
        startTime: new Date("2026-06-13T09:00:00Z"),
        distanceKm: 50,
        durationSeconds: 1800,
        consumedEnergyKwh: 8,
        energyIsEstimated: true,
        startSoc: 55,
        endSoc: 40,
        ascentM: 10,
        descentM: 5,
      }),
    ];
    const charges = [
      makeCharge({ cost: null, energyAddedKwh: 10 }),
      makeCharge({ cost: "5.00", energyAddedKwh: 5 }),
    ];

    const k = buildJourneyKpis(drives, charges);
    expect(k.totalDistanceKm).toBe(50);
    expect(k.consumedEnergyKwh).toBe(8);
    expect(k.anyEstimated).toBe(true);
    expect(k.avgConsumptionWhKm).toBeCloseTo((8 * 1000) / 50);
    expect(k.chargedEnergyKwh).toBe(15);
    // one charge missing cost → incomplete, total counts only the present one
    expect(k.totalCost).toBeCloseTo(5);
    expect(k.hasIncompleteCost).toBe(true);
    expect(k.minSoc).toBe(40);
    expect(k.maxSoc).toBe(55);
    // start SoC of first (chronological) drive is null; end of last is 40
    expect(k.startSoc).toBeNull();
    expect(k.endSoc).toBe(40);
  });

  it("gives null avgConsumption and costPer100Km when distance is zero", () => {
    const k = buildJourneyKpis(
      [makeDrive({ distanceKm: 0, consumedEnergyKwh: 5 })],
      [makeCharge({ cost: "10.00" })],
    );
    expect(k.avgConsumptionWhKm).toBeNull();
    expect(k.costPer100Km).toBeNull();
    expect(k.totalCost).toBeCloseTo(10);
  });
});
