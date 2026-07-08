import { describe, expect, it } from "vitest";
import { deriveParkSessions, type ParkInput } from "./parks.js";

function drive(partial: Partial<ParkInput> & Pick<ParkInput, "sourceId" | "startTime">): ParkInput {
  return {
    endTime: null,
    endLat: null,
    endLon: null,
    endAddress: null,
    endOdometerKm: null,
    startOdometerKm: null,
    ...partial,
  };
}

describe("deriveParkSessions", () => {
  it("leitet Parks zwischen aufeinanderfolgenden abgeschlossenen Fahrten ab, plus trailing offenen Park", () => {
    const drives: ParkInput[] = [
      drive({
        sourceId: "1",
        startTime: new Date("2024-01-01T08:00:00Z"),
        endTime: new Date("2024-01-01T08:30:00Z"),
        endLat: 48.1,
        endLon: 11.5,
        endAddress: "Büro",
      }),
      drive({
        sourceId: "2",
        startTime: new Date("2024-01-01T12:00:00Z"),
        endTime: new Date("2024-01-01T12:20:00Z"),
        endLat: 48.2,
        endLon: 11.6,
        endAddress: "Zuhause",
      }),
    ];

    const parks = deriveParkSessions(drives);
    expect(parks).toHaveLength(2);

    expect(parks[0]).toEqual({
      sourceId: "tm-drive:1",
      startTime: new Date("2024-01-01T08:30:00Z"),
      endTime: new Date("2024-01-01T12:00:00Z"),
      lat: 48.1,
      lon: 11.5,
      address: "Büro",
      durationSeconds: 3.5 * 60 * 60,
    });

    // Trailing: letzte Fahrt abgeschlossen, kein weiterer Drive -> offener Park.
    expect(parks[1]).toEqual({
      sourceId: "tm-drive:2",
      startTime: new Date("2024-01-01T12:20:00Z"),
      endTime: null,
      lat: 48.2,
      lon: 11.6,
      address: "Zuhause",
      durationSeconds: null,
    });
  });

  it("erzeugt keinen trailing Park, wenn eine Fahrt gerade läuft", () => {
    const drives: ParkInput[] = [
      drive({
        sourceId: "1",
        startTime: new Date("2024-01-01T08:00:00Z"),
        endTime: new Date("2024-01-01T08:30:00Z"),
        endLat: 48.1,
        endLon: 11.5,
        endAddress: "Büro",
      }),
      drive({
        sourceId: "2",
        startTime: new Date("2024-01-01T12:00:00Z"),
        endTime: null, // läuft noch
      }),
    ];

    const parks = deriveParkSessions(drives);
    expect(parks).toHaveLength(1);
    expect(parks[0]!.sourceId).toBe("tm-drive:1");
    expect(parks[0]!.endTime).toEqual(new Date("2024-01-01T12:00:00Z"));
  });

  it("überspringt Park bei Overlap (nächste Fahrt startet vor/gleich Ende der vorherigen)", () => {
    const drives: ParkInput[] = [
      drive({
        sourceId: "1",
        startTime: new Date("2024-01-01T08:00:00Z"),
        endTime: new Date("2024-01-01T09:00:00Z"),
        endLat: 48.1,
        endLon: 11.5,
        endAddress: "Büro",
      }),
      drive({
        sourceId: "2",
        startTime: new Date("2024-01-01T08:30:00Z"), // vor Ende von Fahrt 1
        endTime: new Date("2024-01-01T10:00:00Z"),
        endLat: 48.2,
        endLon: 11.6,
        endAddress: "Zuhause",
      }),
    ];

    const parks = deriveParkSessions(drives);
    // Kein Park zwischen 1 und 2 (Overlap), aber trailing Park nach Fahrt 2.
    expect(parks).toHaveLength(1);
    expect(parks[0]!.sourceId).toBe("tm-drive:2");
    expect(parks[0]!.endTime).toBeNull();
  });

  it("normaler Park bleibt bei kleinem/keinem Odometer-Delta unangetastet", () => {
    const drives: ParkInput[] = [
      drive({
        sourceId: "1",
        startTime: new Date("2024-01-01T08:00:00Z"),
        endTime: new Date("2024-01-01T08:30:00Z"),
        endLat: 48.1,
        endLon: 11.5,
        endOdometerKm: 1000,
      }),
      drive({
        sourceId: "2",
        startTime: new Date("2024-01-01T12:00:00Z"),
        endTime: new Date("2024-01-01T12:20:00Z"),
        startOdometerKm: 1000, // gleiche Position, kein Sprung
      }),
    ];
    const parks = deriveParkSessions(drives);
    expect(parks).toHaveLength(2);
    expect(parks[0]!.sourceId).toBe("tm-drive:1");
    expect(parks[0]!.endTime).toEqual(new Date("2024-01-01T12:00:00Z"));
  });

  it("überspringt Park bei Odometer-Sprung > 5 km (ungeloggte Fahrstrecke)", () => {
    const drives: ParkInput[] = [
      drive({
        sourceId: "1",
        startTime: new Date("2026-03-03T08:00:00Z"),
        endTime: new Date("2026-03-03T08:30:00Z"),
        endLat: 48.1,
        endLon: 11.5,
        endOdometerKm: 50000,
      }),
      drive({
        sourceId: "2",
        // 4 Monate später, 4.600 km weiter → Tessie→TeslaMate-Lücke.
        startTime: new Date("2026-07-04T08:00:00Z"),
        endTime: new Date("2026-07-04T08:20:00Z"),
        startOdometerKm: 54600,
      }),
    ];
    const parks = deriveParkSessions(drives);
    // Kein Park über die Lücke, aber ein trailing Park nach Fahrt 2.
    expect(parks).toHaveLength(1);
    expect(parks[0]!.sourceId).toBe("tm-drive:2");
    expect(parks[0]!.endTime).toBeNull();
  });

  it("überspringt Park auch bei rückwärtigem Odometer-Sprung (Quellenwechsel-Basis)", () => {
    // Beim Tessie→TeslaMate-Wechsel kann die Odometer-Basis auch nach unten
    // springen (unterschiedliche Zählerstände) — auch das ist kein echter Park.
    const drives: ParkInput[] = [
      drive({
        sourceId: "1",
        startTime: new Date("2026-03-03T08:00:00Z"),
        endTime: new Date("2026-03-03T08:30:00Z"),
        endOdometerKm: 60339,
      }),
      drive({
        sourceId: "2",
        startTime: new Date("2026-05-25T05:50:00Z"),
        endTime: new Date("2026-05-25T06:15:00Z"),
        startOdometerKm: 24500, // niedrigere Basis → großer Rückwärts-Sprung
      }),
    ];
    const parks = deriveParkSessions(drives);
    expect(parks).toHaveLength(1);
    expect(parks[0]!.sourceId).toBe("tm-drive:2");
    expect(parks[0]!.endTime).toBeNull();
  });

  it("liefert leeres Array bei leerer Eingabe", () => {
    expect(deriveParkSessions([])).toEqual([]);
  });

  it("liefert einen trailing offenen Park bei einer einzelnen abgeschlossenen Fahrt", () => {
    const drives: ParkInput[] = [
      drive({
        sourceId: "1",
        startTime: new Date("2024-01-01T08:00:00Z"),
        endTime: new Date("2024-01-01T08:30:00Z"),
        endLat: 48.1,
        endLon: 11.5,
        endAddress: "Büro",
      }),
    ];

    const parks = deriveParkSessions(drives);
    expect(parks).toHaveLength(1);
    expect(parks[0]!.endTime).toBeNull();
    expect(parks[0]!.durationSeconds).toBeNull();
  });

  it("liefert leeres Array bei einer einzelnen laufenden Fahrt", () => {
    const drives: ParkInput[] = [
      drive({
        sourceId: "1",
        startTime: new Date("2024-01-01T08:00:00Z"),
        endTime: null,
      }),
    ];

    expect(deriveParkSessions(drives)).toEqual([]);
  });
});
