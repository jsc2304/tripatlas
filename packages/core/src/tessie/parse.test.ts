import { describe, expect, it } from "vitest";
import { parseCsvLine } from "./parse.js";

describe("parseCsvLine", () => {
  it("parst quotierte Felder und entfernt die Quotes", () => {
    expect(parseCsvLine('"2023-01-07 20:07:44","49.056396","P","507.772"')).toEqual([
      "2023-01-07 20:07:44",
      "49.056396",
      "P",
      "507.772",
    ]);
  });

  it("liefert null für nacktes Leerfeld und für leeres Quote-Feld", () => {
    // Trailing bare-empty (driving_states: Speed leer) und "" (charging_states).
    expect(parseCsvLine('"49.05","9.24","P","507.772",')).toEqual([
      "49.05",
      "9.24",
      "P",
      "507.772",
      null,
    ]);
    expect(parseCsvLine('"56","","152.32"')).toEqual(["56", null, "152.32"]);
  });

  it("behandelt mehrere nackte Leerfelder in Folge", () => {
    expect(parseCsvLine("a,,,b")).toEqual(["a", null, null, "b"]);
  });

  it("respektiert Kommas innerhalb von Quotes (defensiv)", () => {
    expect(parseCsvLine('"a,b","c"')).toEqual(["a,b", "c"]);
  });

  it("entwertet verdoppelte Quotes zu einem literalen Quote", () => {
    expect(parseCsvLine('"say ""hi""","x"')).toEqual(['say "hi"', "x"]);
  });

  it("parst unquotierte Felder", () => {
    expect(parseCsvLine("2023-01-07,49.05,P")).toEqual(["2023-01-07", "49.05", "P"]);
  });
});
