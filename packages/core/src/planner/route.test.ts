import { describe, expect, it } from "vitest";
import {
  ELEVATION_NOISE_THRESHOLD_M,
  downsample,
  summarizeElevation,
} from "./route.js";

describe("downsample", () => {
  it("returns a copy unchanged when already within max", () => {
    const items = [1, 2, 3];
    const out = downsample(items, 10);
    expect(out).toEqual([1, 2, 3]);
    expect(out).not.toBe(items); // copy, not the same reference
  });

  it("thins to exactly max, keeping first and last", () => {
    const items = Array.from({ length: 1000 }, (_, i) => i);
    const out = downsample(items, 100);
    expect(out).toHaveLength(100);
    expect(out[0]).toBe(0);
    expect(out[out.length - 1]).toBe(999);
  });

  it("spreads picks roughly evenly", () => {
    const items = Array.from({ length: 9 }, (_, i) => i); // 0..8
    const out = downsample(items, 5);
    expect(out).toEqual([0, 2, 4, 6, 8]);
  });

  it("throws for max < 2 (need at least first and last)", () => {
    expect(() => downsample([1, 2, 3], 1)).toThrow();
  });
});

describe("summarizeElevation", () => {
  it("sums ascents and descents separately", () => {
    const { ascentM, descentM } = summarizeElevation([100, 150, 120, 200]);
    // +50, -30, +80
    expect(ascentM).toBeCloseTo(130);
    expect(descentM).toBeCloseTo(30);
  });

  it("skips null/NaN points without breaking the chain", () => {
    const { ascentM, descentM } = summarizeElevation([
      100,
      null,
      150,
      NaN,
      120,
    ]);
    // 100 -> 150 (+50), 150 -> 120 (-30)
    expect(ascentM).toBeCloseTo(50);
    expect(descentM).toBeCloseTo(30);
  });

  it("ignores sub-threshold jitter", () => {
    const tiny = ELEVATION_NOISE_THRESHOLD_M / 2;
    const { ascentM, descentM } = summarizeElevation([
      100,
      100 + tiny,
      100 - tiny,
      100,
    ]);
    expect(ascentM).toBe(0);
    expect(descentM).toBe(0);
  });

  it("returns zeros for empty or single-point input", () => {
    expect(summarizeElevation([])).toEqual({ ascentM: 0, descentM: 0 });
    expect(summarizeElevation([500])).toEqual({ ascentM: 0, descentM: 0 });
  });
});
