// Reine Eingabetypen für den Journey-Report (CSV/PDF/GPX) — KEINE
// Drizzle-Importe. Ergänzt journeys/kpis.ts (dort: reine Kennzahlen) um die
// Anzeigefelder (Ortsnamen, Klassifizierung, Tags etc.), die die
// Export-Renderer zusätzlich brauchen.

import type { ReportDrive } from "../reports/types.js";

/**
 * Deckt sich mit apps/web/lib/journeyTypes.ts. `core` bleibt frameworkfrei
 * und dupliziert die Literal-Union bewusst — dasselbe Muster wie
 * `Classification` (reports/types.ts) vs. apps/web/lib/classification.ts.
 */
export type JourneyType = "vacation" | "business_trip" | "roadtrip" | "other";

export interface JourneyInfo {
  name: string;
  type: JourneyType;
  startTime: Date;
  endTime: Date;
  description: string | null;
}

/**
 * `ReportDrive` plus die Felder, die `buildJourneyKpis` zusätzlich braucht
 * (SoC, Höhenmeter) — eine Fahrt-Zeile im Journey-Report deckt beides ab,
 * statt Anzeige- und Kennzahl-Eingabe getrennt zu modellieren.
 */
export interface JourneyReportDrive extends ReportDrive {
  startSoc: number | null;
  endSoc: number | null;
  ascentM: number | null;
  descentM: number | null;
}

/**
 * Ein Ladevorgang, reduziert auf die für den Journey-Report nötigen Felder
 * (Anzeige-Spalten der Ladestopp-Tabelle + `buildJourneyKpis`-Eingabe).
 */
export interface JourneyReportCharge {
  id: number;
  startTime: Date;
  endTime: Date | null;
  durationSeconds: number | null;
  energyAddedKwh: number | null;
  startSoc: number | null;
  endSoc: number | null;
  maxPowerKw: number | null;
  chargerType: "ac" | "dc" | null;
  /** Kosten als String (numeric aus der DB) oder null, wenn nicht erfasst. */
  cost: string | null;
  currency: string | null;
  placeName: string | null;
  address: string | null;
}
