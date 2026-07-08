import type { Classification } from "./types.js";

/** Deutsche Anzeige-Labels für die Klassifizierung — von CSV/PDF-Renderern genutzt. */
export const CLASSIFICATION_LABELS: Record<Classification, string> = {
  unclassified: "Unklassifiziert",
  private: "Privat",
  business: "Geschäftlich",
  commute: "Arbeitsweg",
};
