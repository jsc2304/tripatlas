import { describe, expect, it } from "vitest";
import {
  MIN_DRIVES_TOTAL,
  MIN_PER_BIN,
  binByNumeric,
  coldVsMildDelta,
  shortTripShare,
  weeklyPattern,
} from "./insights.js";

interface Pt {
  x: number | null;
  y: number | null;
  dow?: number;
  dist?: number | null;
  cons?: number | null;
}

describe("thresholds", () => {
  it("keeps the documented constant values", () => {
    expect(MIN_DRIVES_TOTAL).toBe(30);
    expect(MIN_PER_BIN).toBe(3);
  });
});

describe("binByNumeric", () => {
  it("groups into fixed-width bins with x-center, mean y and count", () => {
    // Two 5-wide bins: [10,15) with 3 points, [20,25) with 3 points.
    const items: Pt[] = [
      { x: 10, y: 180 },
      { x: 12, y: 200 },
      { x: 14, y: 220 }, // bin [10,15) mean = 200
      { x: 20, y: 150 },
      { x: 22, y: 160 },
      { x: 24, y: 170 }, // bin [20,25) mean = 160
    ];
    const bins = binByNumeric(items, (p) => p.x, (p) => p.y, 5);
    expect(bins).toHaveLength(2);
    expect(bins[0]).toMatchObject({ xStart: 10, xCenter: 12.5, count: 3 });
    expect(bins[0]!.meanY).toBeCloseTo(200);
    expect(bins[1]).toMatchObject({ xStart: 20, xCenter: 22.5, count: 3 });
    expect(bins[1]!.meanY).toBeCloseTo(160);
  });

  it("drops bins below MIN_PER_BIN", () => {
    const items: Pt[] = [
      { x: 10, y: 1 },
      { x: 11, y: 2 }, // bin [10,15) only 2 points -> dropped
      { x: 30, y: 5 },
      { x: 31, y: 6 },
      { x: 32, y: 7 }, // bin [30,35) 3 points -> kept
    ];
    const bins = binByNumeric(items, (p) => p.x, (p) => p.y, 5);
    expect(bins).toHaveLength(1);
    expect(bins[0]!.xStart).toBe(30);
  });

  it("skips null/undefined/NaN in x or y", () => {
    const items: Pt[] = [
      { x: 10, y: 100 },
      { x: null, y: 100 },
      { x: 10, y: null },
      { x: 11, y: 120 },
      { x: 12, y: 140 }, // three valid points in [10,15)
    ];
    const bins = binByNumeric(items, (p) => p.x, (p) => p.y, 5);
    expect(bins).toHaveLength(1);
    expect(bins[0]!.count).toBe(3);
    expect(bins[0]!.meanY).toBeCloseTo(120);
  });

  it("handles negative x (below-zero temperatures) via floor binning", () => {
    const items: Pt[] = [
      { x: -4, y: 300 },
      { x: -2, y: 320 },
      { x: -1, y: 340 }, // bin floor(x/5)=-1 -> [-5,0), center -2.5
    ];
    const bins = binByNumeric(items, (p) => p.x, (p) => p.y, 5);
    expect(bins).toHaveLength(1);
    expect(bins[0]!.xStart).toBe(-5);
    expect(bins[0]!.xCenter).toBe(-2.5);
  });

  it("returns bins sorted by xStart ascending", () => {
    const items: Pt[] = [
      { x: 40, y: 1 }, { x: 41, y: 1 }, { x: 42, y: 1 },
      { x: 10, y: 1 }, { x: 11, y: 1 }, { x: 12, y: 1 },
      { x: 25, y: 1 }, { x: 26, y: 1 }, { x: 27, y: 1 },
    ];
    const bins = binByNumeric(items, (p) => p.x, (p) => p.y, 5);
    expect(bins.map((b) => b.xStart)).toEqual([10, 25, 40]);
  });

  it("throws on non-positive binWidth", () => {
    expect(() => binByNumeric([], (p) => 0, (p) => 0, 0)).toThrow();
    expect(() => binByNumeric([], (p) => 0, (p) => 0, -5)).toThrow();
  });
});

describe("weeklyPattern", () => {
  it("returns seven buckets Mon..Sun even when some days are empty", () => {
    const items: Pt[] = [
      { x: 0, y: 20, dow: 0 }, // Mon
      { x: 0, y: 30, dow: 0 }, // Mon
      { x: 0, y: 50, dow: 4 }, // Fri
    ];
    const buckets = weeklyPattern(items, (p) => p.dow!, (p) => p.y);
    expect(buckets).toHaveLength(7);
    expect(buckets[0]).toMatchObject({ dow: 0, count: 2, sumY: 50 });
    expect(buckets[0]!.meanY).toBeCloseTo(25);
    expect(buckets[4]).toMatchObject({ dow: 4, count: 1, sumY: 50, meanY: 50 });
    // Empty days: count 0, mean 0.
    expect(buckets[1]).toMatchObject({ dow: 1, count: 0, sumY: 0, meanY: 0 });
    expect(buckets[6]).toMatchObject({ dow: 6, count: 0 });
  });

  it("ignores out-of-range dow and null y", () => {
    const items: Pt[] = [
      { x: 0, y: 10, dow: 0 },
      { x: 0, y: null, dow: 0 },
      { x: 0, y: 10, dow: 7 }, // invalid dow
      { x: 0, y: 10, dow: -1 }, // invalid dow
    ];
    const buckets = weeklyPattern(items, (p) => p.dow!, (p) => p.y);
    expect(buckets[0]).toMatchObject({ count: 1, sumY: 10 });
    const total = buckets.reduce((s, b) => s + b.count, 0);
    expect(total).toBe(1);
  });

  it("commute fixture pattern: weekday-heavy, weekend-light", () => {
    // 5 commute drives Mon-Fri (dow 0-4), 1 weekend trip (dow 5).
    const items: Pt[] = [
      { x: 0, y: 30, dow: 0 },
      { x: 0, y: 30, dow: 1 },
      { x: 0, y: 30, dow: 2 },
      { x: 0, y: 30, dow: 3 },
      { x: 0, y: 30, dow: 4 },
      { x: 0, y: 120, dow: 5 },
    ];
    const buckets = weeklyPattern(items, (p) => p.dow!, (p) => p.y);
    const weekdayCount = buckets.slice(0, 5).reduce((s, b) => s + b.count, 0);
    expect(weekdayCount).toBe(5);
    expect(buckets[5]!.sumY).toBe(120);
    expect(buckets[6]!.count).toBe(0);
  });
});

describe("coldVsMildDelta", () => {
  it("computes relative surplus of cold vs ~20 °C bin", () => {
    const bins = binByNumeric(
      [
        { x: 2, y: 220 }, { x: 3, y: 240 }, { x: 4, y: 230 }, // [0,5) center 2.5, mean ~230
        { x: 20, y: 180 }, { x: 21, y: 200 }, { x: 22, y: 190 }, // [20,25) center 22.5, mean ~190
      ] as Pt[],
      (p) => p.x,
      (p) => p.y,
      5,
    );
    const delta = coldVsMildDelta(bins);
    expect(delta).not.toBeNull();
    expect(delta!.coldCenter).toBe(2.5);
    expect(delta!.mildCenter).toBe(22.5);
    // (230 - 190) / 190 ≈ 0.21
    expect(delta!.relativeDelta).toBeCloseTo((230 - 190) / 190, 5);
  });

  it("returns null when no cold bin (<10 °C) exists", () => {
    const bins = binByNumeric(
      [
        { x: 12, y: 1 }, { x: 13, y: 1 }, { x: 14, y: 1 },
        { x: 20, y: 1 }, { x: 21, y: 1 }, { x: 22, y: 1 },
      ] as Pt[],
      (p) => p.x,
      (p) => p.y,
      5,
    );
    expect(coldVsMildDelta(bins)).toBeNull();
  });

  it("returns null with fewer than two bins", () => {
    expect(coldVsMildDelta([])).toBeNull();
    expect(
      coldVsMildDelta([{ xStart: 0, xCenter: 2.5, meanY: 100, count: 5 }]),
    ).toBeNull();
  });
});

describe("shortTripShare", () => {
  it("computes share and consumption of short trips vs overall", () => {
    const items: Pt[] = [
      { x: 0, y: 0, dist: 2, cons: 250 }, // short
      { x: 0, y: 0, dist: 3, cons: 230 }, // short
      { x: 0, y: 0, dist: 50, cons: 150 },
      { x: 0, y: 0, dist: 60, cons: 160 },
    ];
    const s = shortTripShare(items, (p) => p.dist, (p) => p.cons, 5);
    expect(s.totalCount).toBe(4);
    expect(s.shortCount).toBe(2);
    expect(s.shortShare).toBeCloseTo(0.5);
    expect(s.shortMeanConsumption).toBeCloseTo(240);
    expect(s.overallMeanConsumption).toBeCloseTo((250 + 230 + 150 + 160) / 4);
  });

  it("ignores items without distance and consumption gaps", () => {
    const items: Pt[] = [
      { x: 0, y: 0, dist: null, cons: 250 }, // no distance -> ignored entirely
      { x: 0, y: 0, dist: 2, cons: null }, // short, counts but no cons
      { x: 0, y: 0, dist: 3, cons: 200 }, // short with cons
    ];
    const s = shortTripShare(items, (p) => p.dist, (p) => p.cons, 5);
    expect(s.totalCount).toBe(2);
    expect(s.shortCount).toBe(2);
    expect(s.shortMeanConsumption).toBeCloseTo(200);
    expect(s.overallMeanConsumption).toBeCloseTo(200);
  });

  it("handles empty input", () => {
    const s = shortTripShare([] as Pt[], (p) => p.dist, (p) => p.cons, 5);
    expect(s.totalCount).toBe(0);
    expect(s.shortShare).toBe(0);
    expect(s.shortMeanConsumption).toBeNull();
    expect(s.overallMeanConsumption).toBeNull();
  });
});
