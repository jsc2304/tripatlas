import { describe, expect, it } from "vitest";
import {
  AERO_SPEED_FRACTION,
  DEFAULT_REFERENCE_SPEED_KMH,
  DESCENT_REGEN_FRACTION,
  GRAVITY_WH_PER_M,
  SPEED_RATIO_MAX,
  SPEED_RATIO_MIN,
  predictConsumption,
} from "./consumption.js";

describe("planner constants", () => {
  it("keeps the documented model constants", () => {
    expect(AERO_SPEED_FRACTION).toBe(0.5);
    expect(SPEED_RATIO_MIN).toBe(0.6);
    expect(SPEED_RATIO_MAX).toBe(1.5);
    expect(DEFAULT_REFERENCE_SPEED_KMH).toBe(45);
    expect(GRAVITY_WH_PER_M).toBe(5.5);
    expect(DESCENT_REGEN_FRACTION).toBe(0.6);
  });
});

describe("predictConsumption", () => {
  it("returns pure base energy on flat road at the reference speed", () => {
    const r = predictConsumption({
      distanceKm: 100,
      avgSpeedKmh: 45, // == reference → speedFactor 1, no adjustment
      tempC: 20,
      ascentM: 0,
      descentM: 0,
      baseWhPerKm: 160,
      referenceSpeedKmh: 45,
    });
    // 160 Wh/km * 100 km = 16 kWh
    expect(r.breakdown.baseKwh).toBeCloseTo(16);
    expect(r.breakdown.speedAdjustmentKwh).toBeCloseTo(0);
    expect(r.breakdown.ascentKwh).toBe(0);
    expect(r.breakdown.descentCreditKwh).toBeCloseTo(0);
    expect(r.energyKwh).toBeCloseTo(16);
    expect(r.whPerKm).toBeCloseTo(160);
    expect(r.breakdown.speedFactor).toBeCloseTo(1);
  });

  it("adds a positive aerodynamic surcharge above the reference speed", () => {
    const r = predictConsumption({
      distanceKm: 100,
      avgSpeedKmh: 90, // ratio 2 → clamped to SPEED_RATIO_MAX (1.5)
      tempC: 20,
      ascentM: 0,
      descentM: 0,
      baseWhPerKm: 160,
      referenceSpeedKmh: 45,
    });
    // clamped ratio 1.5 → speedFactor = 0.5 + 0.5*2.25 = 1.625
    expect(r.breakdown.speedFactor).toBeCloseTo(1.625);
    // adjustment = (160*1.625 - 160) * 100 / 1000 = 10 kWh
    expect(r.breakdown.speedAdjustmentKwh).toBeCloseTo(10);
    expect(r.energyKwh).toBeCloseTo(26);
  });

  it("gives a discount below the reference speed", () => {
    const r = predictConsumption({
      distanceKm: 100,
      avgSpeedKmh: 22.5, // ratio 0.5 → clamped to SPEED_RATIO_MIN (0.6)
      tempC: 20,
      ascentM: 0,
      descentM: 0,
      baseWhPerKm: 160,
      referenceSpeedKmh: 45,
    });
    // clamped ratio 0.6 → speedFactor = 0.5 + 0.5*0.36 = 0.68
    expect(r.breakdown.speedFactor).toBeCloseTo(0.68);
    expect(r.breakdown.speedAdjustmentKwh).toBeLessThan(0);
    expect(r.energyKwh).toBeLessThan(16);
  });

  it("charges full energy for ascent and credits only the regen fraction downhill", () => {
    const ascentOnly = predictConsumption({
      distanceKm: 10,
      avgSpeedKmh: 45,
      tempC: 20,
      ascentM: 1000,
      descentM: 0,
      baseWhPerKm: 160,
      referenceSpeedKmh: 45,
    });
    // 1000 m * 5.5 Wh/m = 5500 Wh = 5.5 kWh
    expect(ascentOnly.breakdown.ascentKwh).toBeCloseTo(5.5);

    const descentOnly = predictConsumption({
      distanceKm: 10,
      avgSpeedKmh: 45,
      tempC: 20,
      ascentM: 0,
      descentM: 1000,
      baseWhPerKm: 160,
      referenceSpeedKmh: 45,
    });
    // -(1000 * 5.5 * 0.6) = -3300 Wh = -3.3 kWh
    expect(descentOnly.breakdown.descentCreditKwh).toBeCloseTo(-3.3);

    // Asymmetry: a there-and-back-shaped profile (equal up/down) still costs net.
    const net =
      ascentOnly.breakdown.ascentKwh + descentOnly.breakdown.descentCreditKwh;
    expect(net).toBeGreaterThan(0);
  });

  it("falls back to DEFAULT_REFERENCE_SPEED_KMH when reference is missing or invalid", () => {
    const r = predictConsumption({
      distanceKm: 50,
      avgSpeedKmh: DEFAULT_REFERENCE_SPEED_KMH,
      tempC: 10,
      ascentM: 0,
      descentM: 0,
      baseWhPerKm: 180,
      // referenceSpeedKmh omitted
    });
    expect(r.breakdown.referenceSpeedKmh).toBe(DEFAULT_REFERENCE_SPEED_KMH);
    expect(r.breakdown.speedFactor).toBeCloseTo(1);
  });

  it("returns zeros for a degenerate zero-distance route", () => {
    const r = predictConsumption({
      distanceKm: 0,
      avgSpeedKmh: 60,
      tempC: 5,
      ascentM: 100,
      descentM: 100,
      baseWhPerKm: 200,
    });
    expect(r.energyKwh).toBe(0);
    expect(r.whPerKm).toBe(0);
  });

  it("combines all terms additively", () => {
    const r = predictConsumption({
      distanceKm: 100,
      avgSpeedKmh: 90, // clamped ratio 1.5
      tempC: 0,
      ascentM: 500,
      descentM: 200,
      baseWhPerKm: 160,
      referenceSpeedKmh: 45,
    });
    const { baseKwh, speedAdjustmentKwh, ascentKwh, descentCreditKwh } =
      r.breakdown;
    expect(r.energyKwh).toBeCloseTo(
      baseKwh + speedAdjustmentKwh + ascentKwh + descentCreditKwh,
    );
    expect(r.whPerKm).toBeCloseTo((r.energyKwh * 1000) / 100);
  });
});
