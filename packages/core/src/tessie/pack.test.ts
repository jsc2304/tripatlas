import { describe, expect, it } from "vitest";
import { estimateUsablePackKwh, type PackSample } from "./pack.js";

describe("estimateUsablePackKwh", () => {
  it("bildet den Median von energyRemaining/(level/100) im 20–90 %-Fenster", () => {
    const samples: PackSample[] = [
      { usableLevel: 50, energyRemainingKwh: 37.5 }, // 75.0
      { usableLevel: 40, energyRemainingKwh: 30.4 }, // 76.0
      { usableLevel: 80, energyRemainingKwh: 59.2 }, // 74.0
    ];
    // Sortiert: 74, 75, 76 → Median 75.
    expect(estimateUsablePackKwh(samples)).toBeCloseTo(75, 5);
  });

  it("mittelt bei gerader Anzahl die beiden mittleren Werte", () => {
    const samples: PackSample[] = [
      { usableLevel: 50, energyRemainingKwh: 37 }, // 74
      { usableLevel: 50, energyRemainingKwh: 38 }, // 76
    ];
    expect(estimateUsablePackKwh(samples)).toBeCloseTo(75, 5);
  });

  it("ignoriert Samples außerhalb 20–90 % und mit Nulls", () => {
    const samples: PackSample[] = [
      { usableLevel: 10, energyRemainingKwh: 8 }, // Rand, ignoriert
      { usableLevel: 95, energyRemainingKwh: 76 }, // Rand, ignoriert
      { usableLevel: null, energyRemainingKwh: 40 }, // null, ignoriert
      { usableLevel: 50, energyRemainingKwh: null }, // null, ignoriert
      { usableLevel: 50, energyRemainingKwh: 37.5 }, // 75.0 → einziger gültiger
    ];
    expect(estimateUsablePackKwh(samples)).toBeCloseTo(75, 5);
  });

  it("liefert null, wenn kein Sample im Fenster liegt", () => {
    expect(estimateUsablePackKwh([{ usableLevel: 5, energyRemainingKwh: 4 }])).toBeNull();
    expect(estimateUsablePackKwh([])).toBeNull();
  });
});
