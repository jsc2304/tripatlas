import "server-only";
import { eq } from "drizzle-orm";
import { places, vehicleStatus, vehicles } from "@tripatlas/db";
import { DEFAULT_REFERENCE_SPEED_KMH, binByNumeric } from "@tripatlas/core";
import { db } from "./db";
import { getInsightsData } from "./insights";

/**
 * Datenzugriffs-Schicht für den Routenplaner-MVP („Reichweiten-Check"). Lädt
 * den persönlichen Basisverbrauch aus der Fahrten-Historie (Muster wie
 * lib/insights.ts), schätzt die nutzbare Batteriekapazität aus dem
 * vehicle_status und bündelt den Vorbelegungs-Kontext für die Formularseite.
 * Die reine Rechenlogik liegt in @tripatlas/core (planner/*), hier passiert nur
 * das Laden/Aufbereiten der DB-Daten.
 */

/** Bin-Breite der Temperatur-Bins für den Basisverbrauch (°C) — wie Insights. */
export const BASE_TEMP_BIN_WIDTH_C = 5;

/**
 * Absoluter Notnagel-Basisverbrauch (Wh/km), falls weder Historie noch
 * Fahrzeug-Effizienz einen Wert liefern (z. B. frische Installation). Bewusst
 * eher hoch angesetzt, damit die Prognose im Zweifel nicht zu optimistisch ist.
 */
export const LAST_RESORT_BASE_WH_PER_KM = 170;

/**
 * Default-Batteriekapazität (kWh), wenn sie sich nicht aus rated range + SoC +
 * Effizienz herleiten lässt. 75 kWh ≈ mittleres Tesla-Paket.
 */
export const DEFAULT_BATTERY_CAPACITY_KWH = 75;

// Plausibilitätsfenster für die hergeleitete Kapazität. Liegt der Schätzwert
// außerhalb (z. B. weil der SoC gerade sehr niedrig ist und rated range grob
// gerundet), verwerfen wir ihn zugunsten des Defaults.
const MIN_PLAUSIBLE_CAPACITY_KWH = 30;
const MAX_PLAUSIBLE_CAPACITY_KWH = 200;

export type BaseConsumptionSource =
  | "temp-bin"
  | "history-avg"
  | "vehicle-efficiency"
  | "default";

export interface BaseConsumptionResult {
  /** Basisverbrauch in Wh/km bei der angefragten Temperatur. */
  baseWhPerKm: number;
  /** Woher der Wert stammt — wird in der UI unter „Annahmen" ausgewiesen. */
  source: BaseConsumptionSource;
  /** Historische Ø-Geschwindigkeit (km/h) als Referenz für die Tempo-Anpassung. */
  referenceSpeedKmh: number;
  /** Mitte des getroffenen Temperatur-Bins (°C), null falls kein Bin griff. */
  tempBinCenterC: number | null;
  /** Anzahl auswertbarer Fahrten in der Historie. */
  historyDriveCount: number;
}

/** Fahrzeug-Effizienz in Wh/km (efficiency mit Override-Fallback), oder null. */
async function loadVehicleEfficiencyWhPerKm(
  vehicleId: number,
): Promise<number | null> {
  const rows = await db
    .select({
      efficiencyKwhPerKm: vehicles.efficiencyKwhPerKm,
      efficiencyOverrideKwhPerKm: vehicles.efficiencyOverrideKwhPerKm,
    })
    .from(vehicles)
    .where(eq(vehicles.id, vehicleId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  // Gelernte Effizienz hat Vorrang; der user-owned Override greift nur, solange
  // TeslaMate noch keine Effizienz aus Ladevorgängen gelernt hat (Schema-Kommentar).
  const eff = row.efficiencyKwhPerKm ?? row.efficiencyOverrideKwhPerKm;
  return eff != null ? eff * 1000 : null;
}

/**
 * Ermittelt den Basisverbrauch (Wh/km) für die gegebene Temperatur über die
 * Fallback-Kette:
 *   1. Temperatur-Bin-Ø der Historie (bester, weil temperaturangepasst),
 *   2. Gesamt-Ø der Historie,
 *   3. Fahrzeug-Effizienz · 1000,
 *   4. absoluter Notnagel-Konstante.
 * Liefert zusätzlich die historische Ø-Geschwindigkeit als Referenz für die
 * Tempo-Anpassung im core-Modell.
 */
export async function resolveBaseConsumption(
  vehicleId: number,
  tempC: number,
): Promise<BaseConsumptionResult> {
  const { drives } = await getInsightsData(vehicleId);

  // Gesamt-Durchschnitte über alle auswertbaren Fahrten.
  let consSum = 0;
  let consCount = 0;
  let speedSum = 0;
  let speedCount = 0;
  for (const d of drives) {
    consSum += d.avgConsumptionWhKm;
    consCount += 1;
    if (d.avgSpeedKmh != null) {
      speedSum += d.avgSpeedKmh;
      speedCount += 1;
    }
  }
  const overallAvgWhPerKm = consCount > 0 ? consSum / consCount : null;
  const referenceSpeedKmh =
    speedCount > 0 ? speedSum / speedCount : DEFAULT_REFERENCE_SPEED_KMH;

  // Temperatur-Bins (mit denselben Schwellwerten wie die Insights-Seite).
  const tempBins = binByNumeric(
    drives,
    (d) => d.tempC,
    (d) => d.avgConsumptionWhKm,
    BASE_TEMP_BIN_WIDTH_C,
  );
  const matchedBin = tempBins.find(
    (b) => tempC >= b.xStart && tempC < b.xStart + BASE_TEMP_BIN_WIDTH_C,
  );

  if (matchedBin) {
    return {
      baseWhPerKm: matchedBin.meanY,
      source: "temp-bin",
      referenceSpeedKmh,
      tempBinCenterC: matchedBin.xCenter,
      historyDriveCount: drives.length,
    };
  }
  if (overallAvgWhPerKm != null) {
    return {
      baseWhPerKm: overallAvgWhPerKm,
      source: "history-avg",
      referenceSpeedKmh,
      tempBinCenterC: null,
      historyDriveCount: drives.length,
    };
  }

  const vehicleEff = await loadVehicleEfficiencyWhPerKm(vehicleId);
  if (vehicleEff != null) {
    return {
      baseWhPerKm: vehicleEff,
      source: "vehicle-efficiency",
      referenceSpeedKmh,
      tempBinCenterC: null,
      historyDriveCount: drives.length,
    };
  }

  return {
    baseWhPerKm: LAST_RESORT_BASE_WH_PER_KM,
    source: "default",
    referenceSpeedKmh,
    tempBinCenterC: null,
    historyDriveCount: drives.length,
  };
}

export interface BatteryCapacityResult {
  capacityKwh: number;
  source: "derived" | "default";
}

/**
 * Schätzt die nutzbare Batteriekapazität. Wenn rated range, aktueller SoC und
 * Fahrzeug-Effizienz vorliegen:
 *   Kapazität ≈ (ratedRange / (SoC/100)) · Effizienz[kWh/km].
 * (rated range hochgerechnet auf 100 % SoC · kWh je km.) Liegt der Wert außer-
 * halb des Plausibilitätsfensters oder fehlen Daten, greift der Default (75 kWh).
 */
export async function estimateBatteryCapacity(
  vehicleId: number,
): Promise<BatteryCapacityResult> {
  const rows = await db
    .select({ soc: vehicleStatus.soc, ratedRangeKm: vehicleStatus.ratedRangeKm })
    .from(vehicleStatus)
    .where(eq(vehicleStatus.vehicleId, vehicleId))
    .limit(1);
  const status = rows[0];
  const effKwhPerKm = await loadVehicleEfficiencyKwhPerKm(vehicleId);

  if (
    status?.soc != null &&
    status.soc > 0 &&
    status.ratedRangeKm != null &&
    effKwhPerKm != null
  ) {
    const ratedRangeAtFull = status.ratedRangeKm / (status.soc / 100);
    const capacityKwh = ratedRangeAtFull * effKwhPerKm;
    if (
      capacityKwh >= MIN_PLAUSIBLE_CAPACITY_KWH &&
      capacityKwh <= MAX_PLAUSIBLE_CAPACITY_KWH
    ) {
      return { capacityKwh, source: "derived" };
    }
  }

  return { capacityKwh: DEFAULT_BATTERY_CAPACITY_KWH, source: "default" };
}

/** Fahrzeug-Effizienz in kWh/km (efficiency mit Override-Fallback), oder null. */
async function loadVehicleEfficiencyKwhPerKm(
  vehicleId: number,
): Promise<number | null> {
  const whPerKm = await loadVehicleEfficiencyWhPerKm(vehicleId);
  return whPerKm != null ? whPerKm / 1000 : null;
}

export interface PlannerPlace {
  id: number;
  name: string;
  type: "home" | "work" | "customer" | "charger" | "other";
  lat: number;
  lon: number;
}

/** Alle Orte mit Koordinaten — für die Start-/Ziel-Dropdowns des Planers. */
export async function getPlannerPlaces(): Promise<PlannerPlace[]> {
  const rows = await db
    .select({
      id: places.id,
      name: places.name,
      type: places.type,
      lat: places.lat,
      lon: places.lon,
    })
    .from(places)
    .orderBy(places.name);
  return rows;
}

export interface PlannerStatus {
  soc: number | null;
  lat: number | null;
  lon: number | null;
  ratedRangeKm: number | null;
  hasPosition: boolean;
}

export interface PlannerContext {
  status: PlannerStatus | null;
  /** Vorschlagswert für das Kapazitätsfeld (hergeleitet oder Default). */
  suggestedCapacityKwh: number;
  capacityIsDerived: boolean;
  /** Anzahl auswertbarer Fahrten — steuert den Hinweis, wie belastbar der Basiswert ist. */
  historyDriveCount: number;
}

/**
 * Bündelt den Kontext, den die Formularseite zum Vorbelegen braucht: aktueller
 * Fahrzeugstatus (Position/SoC), Kapazitätsvorschlag und Historie-Umfang.
 */
export async function getPlannerContext(
  vehicleId: number,
): Promise<PlannerContext> {
  const [statusRows, capacity, insights] = await Promise.all([
    db
      .select({
        soc: vehicleStatus.soc,
        lat: vehicleStatus.lat,
        lon: vehicleStatus.lon,
        ratedRangeKm: vehicleStatus.ratedRangeKm,
      })
      .from(vehicleStatus)
      .where(eq(vehicleStatus.vehicleId, vehicleId))
      .limit(1),
    estimateBatteryCapacity(vehicleId),
    getInsightsData(vehicleId),
  ]);

  const s = statusRows[0];
  const status: PlannerStatus | null = s
    ? {
        soc: s.soc,
        lat: s.lat,
        lon: s.lon,
        ratedRangeKm: s.ratedRangeKm,
        hasPosition: s.lat != null && s.lon != null,
      }
    : null;

  return {
    status,
    suggestedCapacityKwh: capacity.capacityKwh,
    capacityIsDerived: capacity.source === "derived",
    historyDriveCount: insights.drives.length,
  };
}
