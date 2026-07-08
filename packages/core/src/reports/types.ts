// Reine Eingabetypen für Reports — KEINE Drizzle-Importe. `core` bleibt
// framework-frei; die Web-App mappt DB-Rows (drives-Tabelle) auf diese
// Interfaces, bevor sie an die build*Report-Funktionen übergeben werden.

export type Classification = "unclassified" | "private" | "business" | "commute";

export interface ReportDrive {
  id: number;
  startTime: Date;
  endTime: Date | null;
  startPlaceName: string | null;
  endPlaceName: string | null;
  startAddress: string | null;
  endAddress: string | null;
  startLat: number | null;
  startLon: number | null;
  endLat: number | null;
  endLon: number | null;
  startOdometerKm: number | null;
  endOdometerKm: number | null;
  distanceKm: number | null;
  durationSeconds: number | null;
  consumedEnergyKwh: number | null;
  energyIsEstimated: boolean;
  avgConsumptionWhKm: number | null;
  classification: Classification;
  purpose: string | null;
  customer: string | null;
  project: string | null;
  notes: string | null;
  tags: string[];
}

export interface ReportMeta {
  vehicleName: string;
  generatedAt: Date;
  timeZone: string;
}
