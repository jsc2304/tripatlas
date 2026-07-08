import "server-only";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, eq, isNull, isNotNull, notInArray, sql } from "drizzle-orm";
import { classificationRules, drives, places, tags } from "@tripatlas/db";
import { db } from "./db";
import type { Classification } from "./classification";

export interface ClassificationRuleRow {
  id: number;
  name: string;
  enabled: boolean;
  priority: number;
  startPlaceId: number | null;
  startPlaceName: string | null;
  endPlaceId: number | null;
  endPlaceName: string | null;
  weekdays: number[] | null;
  classification: Classification | null;
  tagId: number | null;
  tagName: string | null;
  purpose: string | null;
  customer: string | null;
  project: string | null;
}

function ruleSelect() {
  const startPlace = alias(places, "rule_start_place");
  const endPlace = alias(places, "rule_end_place");
  return db
    .select({
      id: classificationRules.id,
      name: classificationRules.name,
      enabled: classificationRules.enabled,
      priority: classificationRules.priority,
      startPlaceId: classificationRules.startPlaceId,
      startPlaceName: startPlace.name,
      endPlaceId: classificationRules.endPlaceId,
      endPlaceName: endPlace.name,
      weekdays: classificationRules.weekdays,
      classification: classificationRules.classification,
      tagId: classificationRules.tagId,
      tagName: tags.name,
      purpose: classificationRules.purpose,
      customer: classificationRules.customer,
      project: classificationRules.project,
    })
    .from(classificationRules)
    .leftJoin(startPlace, eq(classificationRules.startPlaceId, startPlace.id))
    .leftJoin(endPlace, eq(classificationRules.endPlaceId, endPlace.id))
    .leftJoin(tags, eq(classificationRules.tagId, tags.id));
}

/**
 * Alle Klassifizierungs-Regeln mit aufgelösten Start-/Ziel-Ort- und Tag-Namen,
 * sortiert wie die Anwendung sie auswertet (priority ASC, id ASC).
 */
export async function getClassificationRules(): Promise<ClassificationRuleRow[]> {
  return ruleSelect().orderBy(
    asc(classificationRules.priority),
    asc(classificationRules.id),
  );
}

/** Eine einzelne Regel für das Bearbeiten-Formular. */
export async function getRuleById(
  id: number,
): Promise<ClassificationRuleRow | null> {
  const rows = await ruleSelect()
    .where(eq(classificationRules.id, id))
    .limit(1);
  return rows[0] ?? null;
}

// Historische Importquellen zählen nicht als laufender Klassifizierungsbedarf
// (deckungsgleich mit lib/dashboard.ts).
const IMPORTED_SOURCES = ["tessie"];

/**
 * Anzahl unklassifizierter Live-Fahrten, die Regeln noch anfassen würden:
 * abgeschlossen (endTime gesetzt), classification='unclassified', ohne
 * Regel-Provenance, keine Importquelle.
 */
export async function getUnclassifiedLiveCount(): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(drives)
    .where(
      and(
        eq(drives.classification, "unclassified"),
        isNull(drives.classifiedByRuleId),
        isNotNull(drives.endTime),
        notInArray(drives.source, IMPORTED_SOURCES),
      ),
    );
  return rows[0]?.count ?? 0;
}
