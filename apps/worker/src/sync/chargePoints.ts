import { and, eq, isNotNull, notExists, sql } from "drizzle-orm";
import { chargePoints, chargeSessions, type Db } from "@tripatlas/db";
import type { TeslamateSql } from "../teslamate/client.js";
import { fetchChargesForProcess, type TmCharge } from "../teslamate/queries.js";
import type { UpsertedChargeRef } from "./charges.js";

const CHUNK_SIZE = 500;
// Downsampling: erster und letzter Punkt immer behalten, dazwischen nur Punkte
// mit mindestens 30s Abstand zum zuletzt behaltenen Punkt.
const MIN_INTERVAL_MS = 30 * 1000;
// Backfill für Bestandsdaten: Sessions, die vor Einführung der Ladekurve
// gesynct wurden, liegen außerhalb des Watermark-Fensters und bekämen sonst
// nie Punkte (Codex-Review-Finding). Pro Zyklus ein kleines Kontingent.
const BACKFILL_SESSIONS_PER_CYCLE = 10;

export interface ChargePointsSyncResult {
  sessionsProcessed: number;
  pointsInserted: number;
}

/**
 * Lädt die Leistungsverlauf-Messpunkte (TeslaMate `charges`) für die in
 * diesem Zyklus upgeserteten Charge-Sessions und schreibt sie downgesampelt
 * als Ladekurve (charge_points). Idempotent pro Session: alte Punkte werden
 * vor dem Insert gelöscht. Kein eigener sync_state-Eintrag — hängt am
 * Charge-Sync huckepack (analog route_points am Drive-Sync).
 */
export async function syncChargePoints(
  db: Db,
  tm: TeslamateSql,
  refs: UpsertedChargeRef[],
): Promise<ChargePointsSyncResult> {
  let sessionsProcessed = 0;
  let pointsInserted = 0;

  const backfill = await findSessionsWithoutPoints(db, refs);

  for (const ref of [...refs, ...backfill]) {
    const charges = await fetchChargesForProcess(tm, ref.tmChargingProcessId);
    const sampled = downsample(charges);

    await db
      .delete(chargePoints)
      .where(eq(chargePoints.chargeSessionId, ref.tripatlasChargeSessionId));

    if (sampled.length > 0) {
      const values = sampled.map((c) => ({
        chargeSessionId: ref.tripatlasChargeSessionId,
        ts: c.date,
        powerKw: c.charger_power,
        soc: c.soc,
        outsideTemp: c.outside_temp,
      }));

      for (let i = 0; i < values.length; i += CHUNK_SIZE) {
        const chunk = values.slice(i, i + CHUNK_SIZE);
        await db.insert(chargePoints).values(chunk);
      }
      pointsInserted += values.length;
    }
    sessionsProcessed++;
  }

  return { sessionsProcessed, pointsInserted };
}

/**
 * Abgeschlossene TeslaMate-Sessions ohne einen einzigen Ladekurven-Punkt —
 * Bestandsdaten aus der Zeit vor diesem Feature. Leere Kurven (Session ohne
 * charges-Rows drüben) würden hier zwar erneut anstehen, das Kontingent
 * verpufft dann wirkungslos; real hat jede TeslaMate-Session charges-Rows.
 */
async function findSessionsWithoutPoints(
  db: Db,
  refs: UpsertedChargeRef[],
): Promise<UpsertedChargeRef[]> {
  const alreadyHandled = new Set(refs.map((r) => r.tripatlasChargeSessionId));
  const rows = await db
    .select({ id: chargeSessions.id, sourceId: chargeSessions.sourceId })
    .from(chargeSessions)
    .where(
      and(
        eq(chargeSessions.source, "teslamate"),
        isNotNull(chargeSessions.endTime),
        notExists(
          db
            .select({ one: sql`1` })
            .from(chargePoints)
            .where(eq(chargePoints.chargeSessionId, chargeSessions.id)),
        ),
      ),
    )
    .orderBy(chargeSessions.startTime)
    .limit(BACKFILL_SESSIONS_PER_CYCLE + refs.length);

  return rows
    .filter((r) => !alreadyHandled.has(r.id))
    .slice(0, BACKFILL_SESSIONS_PER_CYCLE)
    .map((r) => ({
      tripatlasChargeSessionId: r.id,
      tmChargingProcessId: Number(r.sourceId),
    }));
}

function downsample(charges: TmCharge[]): TmCharge[] {
  if (charges.length === 0) return [];

  const result: TmCharge[] = [charges[0]!];
  let lastKept = charges[0]!;

  for (let i = 1; i < charges.length - 1; i++) {
    const c = charges[i]!;
    if (c.date.getTime() - lastKept.date.getTime() >= MIN_INTERVAL_MS) {
      result.push(c);
      lastKept = c;
    }
  }

  const last = charges[charges.length - 1]!;
  if (last !== result[result.length - 1]) {
    result.push(last);
  }

  return result;
}
