/**
 * Auto-Klassifizierungs-Regeln — reine Matching-Engine (kein Drizzle, kein I/O).
 *
 * Semantik (siehe schema.ts / Vision §13):
 * - Bedingungen (startPlaceId, endPlaceId, weekdays) sind AND-verknüpft.
 * - null bzw. leeres weekdays-Array = beliebig (keine Einschränkung).
 * - Eine Regel ganz OHNE Bedingung matcht NIE (schützt davor, dass eine
 *   versehentlich leere Regel pauschal alle Fahrten klassifiziert).
 * - Anwendung: erste passende Regel nach priority ASC, id ASC gewinnt.
 *
 * Der Aufrufer reicht `weekdayIso` fertig berechnet herein (aus startTime +
 * Timezone), damit die Engine frei von Zeitzonen-/DB-Abhängigkeiten bleibt;
 * `isoWeekday` steht als reiner Helper dafür bereit.
 */

/** Nur die zum Matchen nötigen Regel-Felder — Aktionen ignoriert die Engine. */
export interface MatchableRule {
  id: number;
  priority: number;
  startPlaceId: number | null;
  endPlaceId: number | null;
  /** ISO-Wochentage 1=Mo … 7=So; null oder [] = alle Tage. */
  weekdays: number[] | null;
}

/** Fahrt-Merkmale, gegen die eine Regel prüft. */
export interface DriveLike {
  startPlaceId: number | null;
  endPlaceId: number | null;
  /** ISO-Wochentag der Startzeit (1..7) oder null, wenn unbekannt. */
  weekdayIso: number | null;
}

/** Hat die Regel überhaupt eine gesetzte Bedingung? */
function hasAnyCondition(rule: MatchableRule): boolean {
  return (
    rule.startPlaceId != null ||
    rule.endPlaceId != null ||
    (rule.weekdays != null && rule.weekdays.length > 0)
  );
}

/**
 * Prüft, ob `drive` alle gesetzten Bedingungen von `rule` erfüllt (AND).
 * Eine Regel ohne jede Bedingung matcht nie.
 */
export function matchRule(drive: DriveLike, rule: MatchableRule): boolean {
  if (!hasAnyCondition(rule)) return false;

  if (rule.startPlaceId != null && drive.startPlaceId !== rule.startPlaceId) {
    return false;
  }
  if (rule.endPlaceId != null && drive.endPlaceId !== rule.endPlaceId) {
    return false;
  }
  if (rule.weekdays != null && rule.weekdays.length > 0) {
    if (drive.weekdayIso == null || !rule.weekdays.includes(drive.weekdayIso)) {
      return false;
    }
  }
  return true;
}

/**
 * Findet die erste passende Regel nach priority ASC, id ASC. Sortiert intern
 * (robust gegen unsortierte Eingabe) und gibt das komplette Regel-Objekt
 * zurück, damit der Aufrufer dessen Aktionsfelder anwenden kann.
 */
export function findMatchingRule<R extends MatchableRule>(
  drive: DriveLike,
  rules: readonly R[],
): R | null {
  const ordered = [...rules].sort(
    (a, b) => a.priority - b.priority || a.id - b.id,
  );
  for (const rule of ordered) {
    if (matchRule(drive, rule)) return rule;
  }
  return null;
}

const ISO_WEEKDAY_BY_SHORT: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

/**
 * ISO-Wochentag (1=Mo … 7=So) eines Zeitpunkts in einer IANA-Zeitzone.
 * Nutzt Intl, damit DST/Zonenübergänge korrekt berücksichtigt werden.
 */
export function isoWeekday(date: Date, timeZone: string): number {
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);
  const iso = ISO_WEEKDAY_BY_SHORT[short];
  if (iso == null) {
    throw new Error(`Unerwarteter Wochentag "${short}" für Zone ${timeZone}`);
  }
  return iso;
}
