import { describe, expect, it } from "vitest";
import { haversineDistanceM, matchPlace } from "./match.js";

// Fixture-Koordinaten (Zürich): Zuhause und Büro liegen ~2,3 km auseinander
const zuhause = { id: 1, lat: 47.3769, lon: 8.5417, radiusM: 100 };
const buero = { id: 2, lat: 47.3902, lon: 8.5158, radiusM: 120 };
const places = [zuhause, buero];

describe("haversineDistanceM", () => {
  it("berechnet bekannte Distanz Zürich HB → Bern HB (~95 km)", () => {
    const d = haversineDistanceM(47.3779, 8.5403, 46.949, 7.4386);
    expect(d).toBeGreaterThan(93_000);
    expect(d).toBeLessThan(97_000);
  });

  it("Distanz zu sich selbst ist 0", () => {
    expect(haversineDistanceM(47.3769, 8.5417, 47.3769, 8.5417)).toBe(0);
  });
});

describe("matchPlace", () => {
  it("matcht Punkt innerhalb des Radius", () => {
    // ~50 m nördlich von Zuhause
    expect(matchPlace(47.37735, 8.5417, places)).toBe(1);
  });

  it("kein Match außerhalb aller Radien", () => {
    expect(matchPlace(47.3833, 8.5288, places)).toBeNull(); // zwischen beiden
  });

  it("null-Koordinaten ergeben kein Match", () => {
    expect(matchPlace(null, 8.5417, places)).toBeNull();
    expect(matchPlace(47.3769, null, places)).toBeNull();
  });

  it("bei Überlappung gewinnt die kleinere Distanz", () => {
    const grob = { id: 10, lat: 47.3769, lon: 8.5417, radiusM: 500 };
    const punkt = { id: 11, lat: 47.378, lon: 8.5417, radiusM: 200 };
    // Punkt liegt in beiden Geofences, aber näher an `punkt`
    expect(matchPlace(47.3781, 8.5417, [grob, punkt])).toBe(11);
  });

  it("bei gleicher Distanz gewinnt der kleinere Radius", () => {
    const weit = { id: 20, lat: 47.3769, lon: 8.5417, radiusM: 300 };
    const eng = { id: 21, lat: 47.3769, lon: 8.5417, radiusM: 100 };
    expect(matchPlace(47.3769, 8.5417, [weit, eng])).toBe(21);
  });
});
