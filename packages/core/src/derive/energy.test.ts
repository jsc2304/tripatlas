import { describe, expect, it } from "vitest";
import { deriveDriveEnergy } from "./energy.js";

describe("deriveDriveEnergy", () => {
  it("berechnet Verbrauch aus Rated-Range-Delta und Effizienz", () => {
    const r = deriveDriveEnergy({
      startRatedRangeKm: 300,
      endRatedRangeKm: 270,
      efficiencyKwhPerKm: 0.152,
      distanceKm: 27.3,
    });
    expect(r.consumedEnergyKwh).toBeCloseTo(4.56, 2);
    expect(r.avgConsumptionWhKm).toBeCloseTo(167.03, 1);
    expect(r.isEstimated).toBe(true);
  });

  it("liefert null bei fehlenden Eingaben", () => {
    const r = deriveDriveEnergy({
      startRatedRangeKm: null,
      endRatedRangeKm: 270,
      efficiencyKwhPerKm: 0.152,
      distanceKm: 10,
    });
    expect(r.consumedEnergyKwh).toBeNull();
    expect(r.avgConsumptionWhKm).toBeNull();
  });

  it("keinen Durchschnitt bei Kurzstrecke unter 0,5 km", () => {
    const r = deriveDriveEnergy({
      startRatedRangeKm: 300,
      endRatedRangeKm: 299.5,
      efficiencyKwhPerKm: 0.152,
      distanceKm: 0.3,
    });
    expect(r.consumedEnergyKwh).not.toBeNull();
    expect(r.avgConsumptionWhKm).toBeNull();
  });

  it("erlaubt negativen Verbrauch (Rekuperation bergab)", () => {
    const r = deriveDriveEnergy({
      startRatedRangeKm: 280,
      endRatedRangeKm: 285,
      efficiencyKwhPerKm: 0.152,
      distanceKm: 12,
    });
    expect(r.consumedEnergyKwh).toBeCloseTo(-0.76, 2);
    expect(r.avgConsumptionWhKm).toBeLessThan(0);
  });
});
