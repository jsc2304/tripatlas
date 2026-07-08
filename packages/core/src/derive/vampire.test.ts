import { describe, expect, it } from "vitest";
import { computeVampireLoss } from "./vampire.js";

describe("computeVampireLoss", () => {
  it("berechnet Verlust aus SoC-Differenz", () => {
    const r = computeVampireLoss({
      prevEndSoc: 75,
      nextStartSoc: 74,
      hadCharge: false,
    });
    expect(r).toBe(1);
  });

  it("liefert 0 statt negativ bei SoC-Messrauschen", () => {
    const r = computeVampireLoss({
      prevEndSoc: 73,
      nextStartSoc: 74,
      hadCharge: false,
    });
    expect(r).toBe(0);
  });

  it("liefert 0 bei unverändertem SoC", () => {
    const r = computeVampireLoss({
      prevEndSoc: 72,
      nextStartSoc: 72,
      hadCharge: false,
    });
    expect(r).toBe(0);
  });

  it("liefert null wenn während des Parks geladen wurde", () => {
    const r = computeVampireLoss({
      prevEndSoc: 55,
      nextStartSoc: 78,
      hadCharge: true,
    });
    expect(r).toBeNull();
  });

  it("liefert null bei fehlendem prevEndSoc", () => {
    const r = computeVampireLoss({
      prevEndSoc: null,
      nextStartSoc: 74,
      hadCharge: false,
    });
    expect(r).toBeNull();
  });

  it("liefert null bei fehlendem nextStartSoc", () => {
    const r = computeVampireLoss({
      prevEndSoc: 75,
      nextStartSoc: null,
      hadCharge: false,
    });
    expect(r).toBeNull();
  });

  it("liefert null wenn beide SoC-Werte fehlen, auch ohne Charge", () => {
    const r = computeVampireLoss({
      prevEndSoc: null,
      nextStartSoc: null,
      hadCharge: false,
    });
    expect(r).toBeNull();
  });
});
