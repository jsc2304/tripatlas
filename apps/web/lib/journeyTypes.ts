/**
 * Client-sichere Journey-Typ-Konstanten (Labels, Optionen, Typ). Plain module —
 * importierbar aus Client- und Server-Komponenten, im Gegensatz zu lib/journeys.ts
 * (dort steckt "server-only" für die DB-Queries).
 */

export type JourneyType = "vacation" | "business_trip" | "roadtrip" | "other";

/**
 * Deutsche Labels der Journey-Typen (vision.md §6.6). Bleibt bewusst
 * unübersetzt: Plain-Module ohne Request-Kontext (kein getTranslations
 * möglich). UI-Code im journeys-Chunk nutzt stattdessen t("type.<wert>")
 * aus messages/*\/journeys.json; Export-Renderer nutzen messages/*\/exports.json.
 * Hier bleibt der Export nur als Fallback für Nicht-i18n-Konsumenten bestehen.
 */
export const JOURNEY_TYPE_LABELS: Record<JourneyType, string> = {
  vacation: "Urlaub",
  business_trip: "Geschäftsreise",
  roadtrip: "Roadtrip",
  other: "Sonstiges",
};

export const JOURNEY_TYPE_OPTIONS: JourneyType[] = [
  "vacation",
  "business_trip",
  "roadtrip",
  "other",
];
