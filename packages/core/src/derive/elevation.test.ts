import { describe, expect, it } from "vitest";
import { computeElevationGain, smoothElevations } from "./elevation.js";

describe("smoothElevations", () => {
  it("liefert leeres Array bei leerer Eingabe", () => {
    expect(smoothElevations([])).toEqual([]);
  });

  it("glättet eine flache Ausreißer-Spitze", () => {
    const points = [400, 400, 410, 400, 400].map((elevationM) => ({ elevationM }));
    const smoothed = smoothElevations(points, 5);
    // Zentrierter Mittelwert über alle 5 Punkte an der Spitze:
    // (400+400+410+400+400)/5 = 402 -> deutlich gedämpft gegenüber dem Rohwert 410.
    expect(smoothed[2]).toBeCloseTo(402, 5);
  });

  it("lässt eine konstante Höhe unverändert", () => {
    const points = Array.from({ length: 10 }, () => ({ elevationM: 500 }));
    expect(smoothElevations(points)).toEqual(points.map(() => 500));
  });
});

describe("computeElevationGain", () => {
  it("flacher Track -> 0/0", () => {
    const elevations = [400, 400, 400, 400, 400];
    expect(computeElevationGain(elevations)).toEqual({ gainM: 0, lossM: 0 });
  });

  it("einzelner Anstieg wird korrekt aufsummiert", () => {
    const elevations = [400, 410, 420, 430, 440];
    const r = computeElevationGain(elevations);
    expect(r.gainM).toBeCloseTo(40, 5);
    expect(r.lossM).toBe(0);
  });

  it("verrauschter Flachtrack (±1m Jitter) -> 0/0 dank Schwellwert", () => {
    const elevations = [400, 401, 400, 399, 400, 401, 400, 399, 400];
    expect(computeElevationGain(elevations, 2)).toEqual({ gainM: 0, lossM: 0 });
  });

  it("Bergprofil: Anstieg gefolgt von Abstieg", () => {
    const elevations = [400, 450, 500, 600, 550, 480, 420];
    const r = computeElevationGain(elevations, 2);
    expect(r.gainM).toBeCloseTo(200, 5); // 400 -> 600
    expect(r.lossM).toBeCloseTo(180, 5); // 600 -> 420
  });

  it("leere Eingabe -> 0/0", () => {
    expect(computeElevationGain([])).toEqual({ gainM: 0, lossM: 0 });
  });

  it("einzelner Punkt -> 0/0", () => {
    expect(computeElevationGain([500])).toEqual({ gainM: 0, lossM: 0 });
  });

  it("ignoriert kleine Ausreißer unterhalb des Schwellwerts", () => {
    // Kurzer Spike von 1.5m mitten in einem flachen Abschnitt bleibt unter
    // der Standard-Schwelle von 2m und darf nicht als Höhenmeter zählen.
    const elevations = [300, 300.5, 301.5, 300.2, 300];
    expect(computeElevationGain(elevations)).toEqual({ gainM: 0, lossM: 0 });
  });
});
