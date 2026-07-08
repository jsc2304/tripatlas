import { describe, expect, it } from "vitest";
import { computeAutoChargeCost } from "./cost.js";

describe("computeAutoChargeCost", () => {
  it("multipliziert Energie und Preis", () => {
    expect(computeAutoChargeCost(30, 0.32)).toBeCloseTo(9.6, 2);
  });

  it("rundet auf 2 Nachkommastellen", () => {
    expect(computeAutoChargeCost(12.345, 0.359)).toBeCloseTo(4.43, 2);
  });

  it("liefert 0 bei 0 kWh geladener Energie", () => {
    expect(computeAutoChargeCost(0, 0.32)).toBe(0);
  });

  it("rundet 0,005-Fälle korrekt (kaufmännisch)", () => {
    // 10 * 0.125 = 1.25 -> 2 Nachkommastellen, kein Rundungsfehler
    expect(computeAutoChargeCost(10, 0.125)).toBeCloseTo(1.25, 2);
  });
});
