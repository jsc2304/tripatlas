// Reine Anzeige-Helfer für Regeln — client- und serverseitig nutzbar (kein
// server-only, kein DB-Zugriff). Konvention siehe schema.ts §13.
//
// Wochentags-Kurzlabels und Bedingungs-Sätze sind user-sichtbarer Text und
// daher übersetzt: alle Funktionen nehmen `t` (useTranslations("rules")
// bzw. useTranslations("common") für den "—"-Fallback) entgegen statt fest
// verdrahteter deutscher Strings.

type Translate = (key: string, values?: Record<string, string>) => string;

/** ISO-Wochentag (1=Mo … 7=So) → übersetztes Kurzlabel; Index 0 bleibt leer. */
export function weekdayShortLabels(t: Translate): string[] {
  return [
    "",
    t("weekday.mon"),
    t("weekday.tue"),
    t("weekday.wed"),
    t("weekday.thu"),
    t("weekday.fri"),
    t("weekday.sat"),
    t("weekday.sun"),
  ];
}

export function weekdayOptions(t: Translate): { iso: number; label: string }[] {
  const labels = weekdayShortLabels(t);
  return [1, 2, 3, 4, 5, 6, 7].map((iso) => ({ iso, label: labels[iso]! }));
}

/**
 * Wochentage menschenlesbar: "Mo–Fr", "Mo, Mi, Fr", zusammenhängende Blöcke ab
 * Länge 3 als Bereich. null / [] / alle 7 Tage = keine Einschränkung → null.
 */
export function formatWeekdays(weekdays: number[] | null, t: Translate): string | null {
  if (!weekdays || weekdays.length === 0 || weekdays.length >= 7) return null;
  const sorted = [...new Set(weekdays)]
    .filter((d) => d >= 1 && d <= 7)
    .sort((a, b) => a - b);
  if (sorted.length === 0) return null;

  const weekdayShort = weekdayShortLabels(t);
  const runs: number[][] = [];
  for (const d of sorted) {
    const last = runs[runs.length - 1];
    if (last && d === last[last.length - 1] + 1) last.push(d);
    else runs.push([d]);
  }
  return runs
    .map((run) =>
      run.length >= 3
        ? `${weekdayShort[run[0]]}–${weekdayShort[run[run.length - 1]]}`
        : run.map((d) => weekdayShort[d]).join(", "),
    )
    .join(", ");
}

/**
 * Menschenlesbare Bedingung, z. B. "Zuhause → Büro, Mo–Fr". `t` ist an den
 * "rules"-Namespace gebunden, `tNone` liefert den generischen "—"-Fallback
 * (common.state.none).
 */
export function describeCondition(
  rule: {
    startPlaceId: number | null;
    startPlaceName: string | null;
    endPlaceId: number | null;
    endPlaceName: string | null;
    weekdays: number[] | null;
  },
  t: Translate,
  tNone: () => string,
): string {
  const start =
    rule.startPlaceId != null
      ? rule.startPlaceName ?? t("row.placeFallback", { id: String(rule.startPlaceId) })
      : null;
  const end =
    rule.endPlaceId != null
      ? rule.endPlaceName ?? t("row.placeFallback", { id: String(rule.endPlaceId) })
      : null;

  const parts: string[] = [];
  if (start && end) parts.push(t("row.route", { start, end }));
  else if (start) parts.push(t("row.startOnly", { start }));
  else if (end) parts.push(t("row.endOnly", { end }));

  const wd = formatWeekdays(rule.weekdays, t);
  if (wd) parts.push(wd);

  return parts.length > 0 ? parts.join(", ") : tNone();
}
