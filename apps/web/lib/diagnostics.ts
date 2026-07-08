import "server-only";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { getSyncState, type SyncStateRow } from "./queries";

export type SyncHealth = "fresh" | "aging" | "stale" | "never";

/** Grün: letzter erfolgreicher Lauf < 5 min her. */
const FRESH_MS = 5 * 60 * 1000;
/** Gelb: < 1 h her. Älter (oder nie) ist rot — siehe classifyHealth. */
const AGING_MS = 60 * 60 * 1000;

const HEALTH_RANK: Record<SyncHealth, number> = {
  fresh: 0,
  aging: 1,
  stale: 2,
  never: 3,
};

function classifyHealth(lastSuccessAt: Date | null): SyncHealth {
  if (!lastSuccessAt) return "never";
  const ageMs = Date.now() - lastSuccessAt.getTime();
  if (ageMs < FRESH_MS) return "fresh";
  if (ageMs < AGING_MS) return "aging";
  return "stale";
}

export interface SyncEntityDiagnosis extends SyncStateRow {
  health: SyncHealth;
}

export interface DiagnosticsSummary {
  /** Trivialer Round-Trip gegen die eigene Tripatlas-DB. */
  tripatlasDbOk: boolean;
  tripatlasDbError: string | null;
  entities: SyncEntityDiagnosis[];
  /** Schlechtester Zustand über alle entities — bestimmt die Karten-Ampel. */
  overallHealth: SyncHealth;
  /** Ob TESLAMATE_DATABASE_URL im Web-Container gesetzt ist (Direkttest möglich). */
  teslamateEnvSet: boolean;
}

/**
 * Übersetzte Entity-Labels aus dem "settings"-Namespace (diagnostics.entities.*),
 * einmal pro Request vom aufrufenden Server Component gebaut und durchgereicht.
 */
export function buildEntityLabels(t: (key: string) => string): Record<string, string> {
  return {
    drives: t("diagnostics.entities.drives"),
    charges: t("diagnostics.entities.charges"),
    parks: t("diagnostics.entities.parks"),
    vehicles: t("diagnostics.entities.vehicles"),
  };
}

/** Menschenlesbares Label für eine sync_state-Zeile, z. B. "teslamate / Fahrten". */
export function entityLabel(
  source: string,
  entity: string,
  labels: Record<string, string>,
): string {
  const label = labels[entity] ?? entity;
  return `${source} / ${label}`;
}

/**
 * Baut die Diagnose-Zusammenfassung für die Settings-Seite: DB-Erreichbarkeit
 * plus je sync_state-Zeile eine Alters-Einstufung (grün/gelb/rot/nie).
 * Schluckt DB-Fehler statt die Seite crashen zu lassen — genau dafür ist die
 * Diagnose-Card da.
 */
export async function getDiagnostics(): Promise<DiagnosticsSummary> {
  let tripatlasDbOk = true;
  let tripatlasDbError: string | null = null;

  try {
    await db.execute(sql`select 1`);
  } catch (err) {
    tripatlasDbOk = false;
    tripatlasDbError =
      err instanceof Error ? err.message : "Unbekannter Datenbankfehler.";
  }

  let rows: SyncStateRow[] = [];
  if (tripatlasDbOk) {
    try {
      rows = await getSyncState();
    } catch (err) {
      tripatlasDbOk = false;
      tripatlasDbError =
        err instanceof Error ? err.message : "Unbekannter Datenbankfehler.";
    }
  }

  const entities: SyncEntityDiagnosis[] = rows.map((row) => ({
    ...row,
    health: classifyHealth(row.lastSuccessAt),
  }));

  const overallHealth: SyncHealth =
    entities.length === 0
      ? "never"
      : entities.reduce<SyncHealth>(
          (worst, e) => (HEALTH_RANK[e.health] > HEALTH_RANK[worst] ? e.health : worst),
          "fresh",
        );

  return {
    tripatlasDbOk,
    tripatlasDbError,
    entities,
    overallHealth,
    teslamateEnvSet: Boolean(process.env.TESLAMATE_DATABASE_URL),
  };
}

/**
 * Menschenlesbare Hinweise für typische Fehlerbilder, unter der Diagnose-Card.
 * `t` ist an den "settings"-Namespace gebunden (getTranslations("settings")
 * im aufrufenden Server Component).
 */
export function diagnosticsHints(
  summary: DiagnosticsSummary,
  t: (key: string) => string,
): string[] {
  const hints: string[] = [];

  if (!summary.tripatlasDbOk) {
    hints.push(t("diagnostics.hints.dbUnreachable"));
  }

  if (summary.entities.length === 0) {
    hints.push(t("diagnostics.hints.neverSynced"));
  } else if (summary.overallHealth === "never") {
    hints.push(t("diagnostics.hints.someNeverSynced"));
  } else if (summary.overallHealth === "stale") {
    hints.push(t("diagnostics.hints.stale"));
  }

  if (summary.entities.some((e) => e.lastStatus === "error" && e.lastError)) {
    hints.push(t("diagnostics.hints.runFailed"));
  }

  return hints;
}
