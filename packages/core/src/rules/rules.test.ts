import { describe, expect, it } from "vitest";
import {
  findMatchingRule,
  isoWeekday,
  matchRule,
  type MatchableRule,
} from "./rules.js";

// Fixture: Zuhause=1, Büro=2, Kunde=3
function rule(overrides: Partial<MatchableRule> = {}): MatchableRule {
  return {
    id: 1,
    priority: 0,
    startPlaceId: null,
    endPlaceId: null,
    weekdays: null,
    ...overrides,
  };
}

describe("matchRule", () => {
  it("Regel ohne jede Bedingung matcht nie", () => {
    const drive = { startPlaceId: 1, endPlaceId: 2, weekdayIso: 1 };
    expect(matchRule(drive, rule())).toBe(false);
    // auch nicht bei leerem weekdays-Array
    expect(matchRule(drive, rule({ weekdays: [] }))).toBe(false);
  });

  it("Start + Ziel gesetzt: matcht nur bei exakter Übereinstimmung (AND)", () => {
    const r = rule({ startPlaceId: 1, endPlaceId: 2 });
    expect(matchRule({ startPlaceId: 1, endPlaceId: 2, weekdayIso: 3 }, r)).toBe(true);
    expect(matchRule({ startPlaceId: 1, endPlaceId: 9, weekdayIso: 3 }, r)).toBe(false);
    expect(matchRule({ startPlaceId: 9, endPlaceId: 2, weekdayIso: 3 }, r)).toBe(false);
  });

  it("null-Bedingung = beliebig", () => {
    const r = rule({ endPlaceId: 2 }); // nur Ziel
    expect(matchRule({ startPlaceId: 1, endPlaceId: 2, weekdayIso: 6 }, r)).toBe(true);
    expect(matchRule({ startPlaceId: 42, endPlaceId: 2, weekdayIso: 6 }, r)).toBe(true);
    expect(matchRule({ startPlaceId: null, endPlaceId: 2, weekdayIso: 6 }, r)).toBe(true);
  });

  it("Drive-Ziel null matcht keine gesetzte Ziel-Bedingung", () => {
    const r = rule({ endPlaceId: 2 });
    expect(matchRule({ startPlaceId: 1, endPlaceId: null, weekdayIso: 1 }, r)).toBe(false);
  });

  it("weekdays: matcht nur an gelisteten Tagen", () => {
    const r = rule({ startPlaceId: 1, weekdays: [1, 2, 3, 4, 5] }); // Mo–Fr
    expect(matchRule({ startPlaceId: 1, endPlaceId: null, weekdayIso: 3 }, r)).toBe(true); // Mi
    expect(matchRule({ startPlaceId: 1, endPlaceId: null, weekdayIso: 6 }, r)).toBe(false); // Sa
  });

  it("weekday-Bedingung: unbekannter Wochentag (null) matcht nie", () => {
    const r = rule({ startPlaceId: 1, weekdays: [1, 2, 3, 4, 5] });
    expect(matchRule({ startPlaceId: 1, endPlaceId: null, weekdayIso: null }, r)).toBe(false);
  });

  it("weekdays=null lässt jeden Wochentag zu (auch unbekannten)", () => {
    const r = rule({ startPlaceId: 1, weekdays: null });
    expect(matchRule({ startPlaceId: 1, endPlaceId: null, weekdayIso: null }, r)).toBe(true);
    expect(matchRule({ startPlaceId: 1, endPlaceId: null, weekdayIso: 7 }, r)).toBe(true);
  });
});

describe("findMatchingRule", () => {
  const drive = { startPlaceId: 1, endPlaceId: 2, weekdayIso: 3 };

  it("gibt null zurück, wenn keine Regel passt", () => {
    const rules = [rule({ id: 1, startPlaceId: 9 })];
    expect(findMatchingRule(drive, rules)).toBeNull();
  });

  it("erste passende Regel nach priority ASC gewinnt", () => {
    const rules = [
      rule({ id: 10, priority: 5, startPlaceId: 1 }),
      rule({ id: 11, priority: 1, startPlaceId: 1 }),
    ];
    expect(findMatchingRule(drive, rules)?.id).toBe(11);
  });

  it("bei gleicher priority gewinnt die kleinere id", () => {
    const rules = [
      rule({ id: 20, priority: 0, startPlaceId: 1 }),
      rule({ id: 5, priority: 0, startPlaceId: 1 }),
    ];
    expect(findMatchingRule(drive, rules)?.id).toBe(5);
  });

  it("sortiert intern — Eingabereihenfolge egal", () => {
    const rules = [
      rule({ id: 3, priority: 10, startPlaceId: 1 }),
      rule({ id: 2, priority: 2, startPlaceId: 9 }), // passt nicht
      rule({ id: 1, priority: 3, startPlaceId: 1 }),
    ];
    // priority 3 (id 1) passt, priority 10 (id 3) käme später, priority 2 passt nicht
    expect(findMatchingRule(drive, rules)?.id).toBe(1);
  });

  it("gibt das komplette Regel-Objekt zurück (mit Aktionsfeldern)", () => {
    const rules = [
      { ...rule({ id: 1, startPlaceId: 1 }), classification: "commute", tagId: 7 },
    ];
    const match = findMatchingRule(drive, rules);
    expect(match?.classification).toBe("commute");
    expect(match?.tagId).toBe(7);
  });

  it("überspringt nicht-passende Regeln höherer Priorität", () => {
    const rules = [
      rule({ id: 1, priority: 0, startPlaceId: 99 }), // höchste Prio, passt nicht
      rule({ id: 2, priority: 1, endPlaceId: 2 }), // passt
    ];
    expect(findMatchingRule(drive, rules)?.id).toBe(2);
  });
});

describe("isoWeekday", () => {
  it("1. Jan 2024 (Montag) → 1 in UTC", () => {
    expect(isoWeekday(new Date("2024-01-01T12:00:00Z"), "UTC")).toBe(1);
  });

  it("7. Jan 2024 (Sonntag) → 7", () => {
    expect(isoWeekday(new Date("2024-01-07T12:00:00Z"), "UTC")).toBe(7);
  });

  it("berücksichtigt die Zeitzone (Tageswechsel)", () => {
    // 2024-01-01T23:30Z ist in Europe/Zurich bereits 2024-01-02 00:30 → Dienstag
    const instant = new Date("2024-01-01T23:30:00Z");
    expect(isoWeekday(instant, "UTC")).toBe(1); // Mo
    expect(isoWeekday(instant, "Europe/Zurich")).toBe(2); // Di
  });

  it("berücksichtigt negative UTC-Offsets", () => {
    // 2024-01-01T02:00Z ist in New York noch 2023-12-31 21:00 → Sonntag
    const instant = new Date("2024-01-01T02:00:00Z");
    expect(isoWeekday(instant, "America/New_York")).toBe(7); // So
  });
});
