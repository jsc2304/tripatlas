import "server-only";
import { asc, eq } from "drizzle-orm";
import { chargePoints } from "@tripatlas/db";
import { db } from "./db";

/** Ein Messpunkt der Ladekurve (M19) — Zeit, Leistung, SoC, Außentemperatur. */
export interface ChargeCurvePoint {
  ts: number; // unix ms
  powerKw: number | null;
  soc: number | null;
  outsideTemp: number | null;
}

// Unterhalb dieser Punktzahl gilt die Kurve als nicht aussagekräftig (z. B.
// laufende oder nicht nachbearbeitete Legacy-Sessions) — die Chart-Komponente
// zeigt dann den Hinweis statt eines Charts.
export const MIN_CHARGE_CURVE_POINTS = 3;

/** Ordered charge_points for a charge session (ts asc), roh — keine Filterung. */
export async function getChargeCurve(chargeSessionId: number): Promise<ChargeCurvePoint[]> {
  const rows = await db
    .select({
      ts: chargePoints.ts,
      powerKw: chargePoints.powerKw,
      soc: chargePoints.soc,
      outsideTemp: chargePoints.outsideTemp,
    })
    .from(chargePoints)
    .where(eq(chargePoints.chargeSessionId, chargeSessionId))
    .orderBy(asc(chargePoints.ts));

  return rows.map((r) => ({
    ts: r.ts.getTime(),
    powerKw: r.powerKw,
    soc: r.soc,
    outsideTemp: r.outsideTemp,
  }));
}
