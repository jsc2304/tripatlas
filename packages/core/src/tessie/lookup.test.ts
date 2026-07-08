import { describe, expect, it } from "vitest";
import { lookupNearest } from "./lookup.js";

describe("lookupNearest", () => {
  const ts = [0, 1000, 2000, 5000, 10000];

  it("findet den exakten Treffer", () => {
    expect(lookupNearest(ts, 2000, 100)).toBe(2);
  });

  it("wählt den näheren der beiden Nachbarn", () => {
    expect(lookupNearest(ts, 1600, 1000)).toBe(2); // näher an 2000 als an 1000
    expect(lookupNearest(ts, 1400, 1000)).toBe(1); // näher an 1000 als an 2000
  });

  it("liefert -1, wenn der nächste Nachbar außerhalb der Toleranz liegt", () => {
    expect(lookupNearest(ts, 7000, 1000)).toBe(-1); // 2000 weg vom nächsten (5000)
  });

  it("respektiert die Toleranz exakt (Grenze inklusiv)", () => {
    expect(lookupNearest(ts, 3000, 1000)).toBe(2); // nächster ist 2000 (Abstand 1000)
    expect(lookupNearest(ts, 3000, 999)).toBe(-1); // knapp außerhalb
  });

  it("behandelt Ränder", () => {
    expect(lookupNearest(ts, -500, 1000)).toBe(0);
    expect(lookupNearest(ts, 12000, 3000)).toBe(4);
    expect(lookupNearest(ts, 12000, 1000)).toBe(-1);
  });

  it("liefert -1 bei leerer Serie", () => {
    expect(lookupNearest([], 100, 1000)).toBe(-1);
  });
});
