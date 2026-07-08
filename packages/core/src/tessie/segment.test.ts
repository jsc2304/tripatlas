import { describe, expect, it } from "vitest";
import {
  segmentCharges,
  segmentDrives,
  type ChargeSample,
  type DriveSample,
} from "./segment.js";

const MIN = 60 * 1000;
const SEC = 1000;

function drive(
  ts: number,
  odometerKm: number,
  partial: Partial<DriveSample> = {},
): DriveSample {
  return {
    ts,
    lat: 48,
    lon: 11,
    shift: "D",
    speedKmh: 50,
    odometerKm,
    ...partial,
  };
}

describe("segmentDrives", () => {
  it("Happy Path: eine zusammenhängende Fahrt", () => {
    const samples = [
      drive(0, 100),
      drive(1 * MIN, 101),
      drive(2 * MIN, 102.5),
      drive(3 * MIN, 104),
    ];
    const eps = segmentDrives(samples);
    expect(eps).toHaveLength(1);
    expect(eps[0]!.startTs).toBe(0);
    expect(eps[0]!.endTs).toBe(3 * MIN);
    expect(eps[0]!.startOdoKm).toBe(100);
    expect(eps[0]!.endOdoKm).toBe(104);
    expect(eps[0]!.samples).toHaveLength(4);
  });

  it("splittet bei Lücke > 10 min", () => {
    const samples = [
      drive(0, 100),
      drive(2 * MIN, 102),
      // 11 min Lücke → neue Fahrt
      drive(13 * MIN, 102),
      drive(15 * MIN, 105),
    ];
    const eps = segmentDrives(samples);
    expect(eps).toHaveLength(2);
    expect(eps[0]!.endOdoKm).toBe(102);
    expect(eps[1]!.startOdoKm).toBe(102);
    expect(eps[1]!.endOdoKm).toBe(105);
  });

  it("splittet bei anhaltendem Parken ≥ 5 min und trimmt nachlaufendes P", () => {
    const samples = [
      drive(0, 100),
      drive(2 * MIN, 103),
      // ab hier P am selben Ort, Odometer unverändert, > 5 min
      drive(3 * MIN, 103, { shift: "P", speedKmh: 0 }),
      drive(9 * MIN, 103, { shift: "P", speedKmh: 0 }),
      // wieder losgefahren → zweite Fahrt
      drive(10 * MIN, 103, { shift: "D", speedKmh: 40 }),
      drive(12 * MIN, 106, { shift: "D", speedKmh: 40 }),
    ];
    const eps = segmentDrives(samples);
    expect(eps).toHaveLength(2);
    // Erste Fahrt endet am letzten bewegten Sample (2 min / odo 103), nicht im Parken.
    expect(eps[0]!.endTs).toBe(2 * MIN);
    expect(eps[0]!.endOdoKm).toBe(103);
    expect(eps[1]!.startTs).toBe(10 * MIN);
    expect(eps[1]!.endOdoKm).toBe(106);
  });

  it("kurzer Zwischenstopp (< 5 min P) splittet nicht", () => {
    const samples = [
      drive(0, 100),
      drive(2 * MIN, 103, { shift: "P", speedKmh: 0 }),
      drive(4 * MIN, 103, { shift: "P", speedKmh: 0 }),
      drive(5 * MIN, 105, { shift: "D", speedKmh: 40 }),
    ];
    const eps = segmentDrives(samples);
    expect(eps).toHaveLength(1);
    expect(eps[0]!.endOdoKm).toBe(105);
  });

  it("verwirft Rangier-Rauschen (Strecke < 0.2 km UND Dauer < 2 min)", () => {
    const samples = [
      drive(0, 100, { shift: "R", speedKmh: 3 }),
      drive(30 * SEC, 100.1, { shift: "R", speedKmh: 3 }),
      // > 10 min Lücke beendet die Mini-Episode
      drive(15 * MIN, 100.1, { shift: "D", speedKmh: 50 }),
      drive(17 * MIN, 105, { shift: "D", speedKmh: 50 }),
    ];
    const eps = segmentDrives(samples);
    expect(eps).toHaveLength(1); // Rangier-Episode verworfen, echte Fahrt bleibt
    expect(eps[0]!.startOdoKm).toBe(100.1);
    expect(eps[0]!.endOdoKm).toBe(105);
  });

  it("behält lange Episode trotz kleiner Strecke (nur eine Bedingung erfüllt)", () => {
    // Stau: > 2 min Dauer, aber kaum Strecke → NICHT verwerfen.
    const samples = [
      drive(0, 100, { shift: "D", speedKmh: 2 }),
      drive(3 * MIN, 100.15, { shift: "D", speedKmh: 2 }),
    ];
    const eps = segmentDrives(samples);
    expect(eps).toHaveLength(1);
  });

  it("Same-Second-Doubletten: letztes Sample gewinnt", () => {
    const samples = [
      drive(0, 100),
      drive(1 * MIN, 101),
      drive(1 * MIN, 101.5), // gleicher Zeitstempel wie zuvor → ersetzt
      drive(2 * MIN, 103),
    ];
    const eps = segmentDrives(samples);
    expect(eps).toHaveLength(1);
    expect(eps[0]!.samples).toHaveLength(3); // Doublette zusammengefasst
    expect(eps[0]!.samples[1]!.odometerKm).toBe(101.5);
  });

  it("klammert Odometer-Rückwärts-Blip auf den vorherigen Wert", () => {
    const samples = [
      drive(0, 100),
      drive(1 * MIN, 101),
      drive(2 * MIN, 100.99), // Blip rückwärts (≤ 0.02) → auf 101 geklammert
      drive(3 * MIN, 103),
    ];
    const eps = segmentDrives(samples);
    expect(eps).toHaveLength(1);
    expect(eps[0]!.samples[2]!.odometerKm).toBe(101);
    expect(eps[0]!.endOdoKm).toBe(103);
  });
});

function charge(
  ts: number,
  partial: Partial<ChargeSample> = {},
): ChargeSample {
  return {
    ts,
    state: "Charging",
    soc: 50,
    powerKw: 10,
    phases: 3,
    voltage: 230,
    ...partial,
  };
}

describe("segmentCharges", () => {
  it("erkennt einen zusammenhängenden Charging-Lauf", () => {
    const samples = [
      charge(0, { soc: 40 }),
      charge(1 * MIN, { soc: 45 }),
      charge(2 * MIN, { soc: 50 }),
      charge(3 * MIN, { state: "Complete", soc: 55 }),
    ];
    const eps = segmentCharges(samples);
    expect(eps).toHaveLength(1);
    expect(eps[0]!.startSoc).toBe(40);
    expect(eps[0]!.endSoc).toBe(50); // Complete-Sample gehört nicht mehr dazu
    expect(eps[0]!.samples).toHaveLength(3);
  });

  it("splittet bei Zustandswechsel zwischen zwei Charging-Läufen", () => {
    const samples = [
      charge(0, { soc: 40 }),
      charge(1 * MIN, { soc: 45 }),
      charge(2 * MIN, { state: "Stopped", soc: 45 }),
      charge(3 * MIN, { soc: 46 }),
      charge(4 * MIN, { soc: 50 }),
    ];
    const eps = segmentCharges(samples);
    expect(eps).toHaveLength(2);
    expect(eps[0]!.endSoc).toBe(45);
    expect(eps[1]!.startSoc).toBe(46);
  });

  it("splittet bei Lücke > 15 min zwischen Charging-Samples", () => {
    const samples = [
      charge(0, { soc: 40 }),
      charge(1 * MIN, { soc: 45 }),
      charge(20 * MIN, { soc: 60 }),
    ];
    const eps = segmentCharges(samples);
    expect(eps).toHaveLength(2);
  });

  it("AC-Erkennung: Phasen bekannt und Spannung 150–260 V", () => {
    const samples = [
      charge(0, { powerKw: 11, phases: 3, voltage: 230 }),
      charge(1 * MIN, { powerKw: 11, phases: 3, voltage: 232 }),
    ];
    const eps = segmentCharges(samples);
    expect(eps[0]!.chargerType).toBe("ac");
    expect(eps[0]!.maxPowerKw).toBe(11);
  });

  it("DC-Erkennung: keine Phasen, Hochspannung, Spitzenleistung > 11 kW", () => {
    const samples = [
      charge(0, { powerKw: 50, phases: null, voltage: 380 }),
      charge(1 * MIN, { powerKw: 120, phases: null, voltage: 400 }),
    ];
    const eps = segmentCharges(samples);
    expect(eps[0]!.chargerType).toBe("dc");
    expect(eps[0]!.maxPowerKw).toBe(120);
  });

  it("Fallback AC: keine Phasen, niedrige Leistung", () => {
    const samples = [charge(0, { powerKw: 3, phases: null, voltage: null })];
    const eps = segmentCharges(samples);
    expect(eps[0]!.chargerType).toBe("ac");
  });

  it("avgPowerKw mittelt nur Samples mit Leistung > 0", () => {
    const samples = [
      charge(0, { powerKw: 0 }),
      charge(1 * MIN, { powerKw: 10 }),
      charge(2 * MIN, { powerKw: 20 }),
    ];
    const eps = segmentCharges(samples);
    expect(eps[0]!.avgPowerKw).toBe(15);
    expect(eps[0]!.maxPowerKw).toBe(20);
  });
});
