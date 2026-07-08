import { describe, expect, it } from "vitest";
import { assessTpms } from "./tpms.js";

describe("assessTpms", () => {
  it("keine Warnung bei vier gleichmäßigen Reifen", () => {
    const r = assessTpms({ fl: 2.9, fr: 2.9, rl: 2.9, rr: 2.9 });
    expect(r.anyWarn).toBe(false);
    expect(r.fl).toEqual({ value: 2.9, warn: false });
    expect(r.fr).toEqual({ value: 2.9, warn: false });
    expect(r.rl).toEqual({ value: 2.9, warn: false });
    expect(r.rr).toEqual({ value: 2.9, warn: false });
  });

  it("warnt bei einem Reifen unter dem Mindestdruck", () => {
    const r = assessTpms({ fl: 2.1, fr: 2.9, rl: 2.9, rr: 2.9 });
    expect(r.anyWarn).toBe(true);
    // fl: below minBar (absolute). fr: not below minBar, but the pair mean
    // (2.5) is pulled down by fl far enough that fr also deviates >0.3 from
    // it — both tires of the imbalanced pair are flagged, unaffected axle not.
    expect(r.fl).toEqual({ value: 2.1, warn: true });
    expect(r.fr.warn).toBe(true);
    expect(r.rl.warn).toBe(false);
    expect(r.rr.warn).toBe(false);
  });

  it("warnt bei Achs-Ungleichgewicht auch oberhalb des Mindestdrucks", () => {
    const r = assessTpms({ fl: 3.3, fr: 2.6, rl: 2.9, rr: 2.9 });
    expect(r.anyWarn).toBe(true);
    expect(r.fl.warn).toBe(true);
    expect(r.fr.warn).toBe(true);
    expect(r.fl.value).toBe(3.3);
    expect(r.fr.value).toBe(2.6);
    expect(r.rl.warn).toBe(false);
    expect(r.rr.warn).toBe(false);
  });

  it("keine Warnung an der Grenze (genau maxAxleDeltaBar)", () => {
    // mean 2.7, deviation exactly 0.3 on each side -> not > threshold
    const r = assessTpms({ fl: 3.0, fr: 2.4, rl: 2.9, rr: 2.9 });
    expect(r.fl.warn).toBe(false);
    expect(r.fr.warn).toBe(false);
  });

  it("ist null-safe: fehlende Reifen warnen nie", () => {
    const r = assessTpms({ fl: null, fr: null, rl: null, rr: null });
    expect(r.anyWarn).toBe(false);
    expect(r.fl).toEqual({ value: null, warn: false });
    expect(r.fr).toEqual({ value: null, warn: false });
    expect(r.rl).toEqual({ value: null, warn: false });
    expect(r.rr).toEqual({ value: null, warn: false });
  });

  it("bewertet vorhandenen Reifen auch wenn der Achs-Partner fehlt", () => {
    const r = assessTpms({ fl: 2.9, fr: null, rl: 2.9, rr: 2.9 });
    expect(r.fl).toEqual({ value: 2.9, warn: false });
    expect(r.fr).toEqual({ value: null, warn: false });

    const low = assessTpms({ fl: 2.1, fr: null, rl: 2.9, rr: 2.9 });
    expect(low.fl).toEqual({ value: 2.1, warn: true });
    expect(low.anyWarn).toBe(true);
  });

  it("respektiert benutzerdefinierte Schwellenwerte", () => {
    const r = assessTpms(
      { fl: 2.0, fr: 2.9, rl: 2.9, rr: 2.9 },
      { minBar: 1.8, maxAxleDeltaBar: 1 },
    );
    expect(r.fl.warn).toBe(false);
    expect(r.anyWarn).toBe(false);
  });
});
