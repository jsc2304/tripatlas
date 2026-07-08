// Reine Eingabetypen für Journey-Kennzahlen — KEINE Drizzle-Importe. `core`
// bleibt framework-frei; die Web-App mappt DB-Rows auf diese Interfaces, bevor
// sie an buildJourneyKpis übergeben werden. Alle Felder null-tolerant, da
// abgeleitete Werte (Energie, SoC, Höhenmeter, Kosten) je nach Quelle fehlen
// können.

/** Eine Fahrt, reduziert auf die für Reise-Kennzahlen nötigen Felder. */
export interface KpiDrive {
  startTime: Date;
  distanceKm: number | null;
  durationSeconds: number | null;
  consumedEnergyKwh: number | null;
  /** true, wenn consumedEnergyKwh eine Rated-Range-Schätzung ist. */
  energyIsEstimated: boolean;
  startSoc: number | null;
  endSoc: number | null;
  ascentM: number | null;
  descentM: number | null;
}

/** Ein Ladevorgang, reduziert auf die für Reise-Kennzahlen nötigen Felder. */
export interface KpiCharge {
  startTime: Date;
  durationSeconds: number | null;
  energyAddedKwh: number | null;
  /** Kosten als String (numeric aus der DB) oder null, wenn nicht erfasst. */
  cost: string | null;
}

export interface JourneyKpis {
  /** Summe der Fahrtdistanzen (km). */
  totalDistanceKm: number;
  /** Summe der Fahrzeiten (s). */
  driveTimeSeconds: number;
  /** Summe der Ladezeiten (s). */
  chargeTimeSeconds: number;
  /** Anzahl der Ladestopps in der Reise. */
  chargeStopCount: number;
  /**
   * Durchschnittsverbrauch (Wh/km) = Summe verbrauchter Energie / Summe Distanz.
   * null, wenn keine Distanz > 0 vorliegt.
   */
  avgConsumptionWhKm: number | null;
  /** Summe verbrauchter Energie (kWh). */
  consumedEnergyKwh: number;
  /** true, wenn mindestens eine verbrauchte Energie geschätzt ist. */
  anyEstimated: boolean;
  /** Summe geladener Energie (kWh). */
  chargedEnergyKwh: number;
  /** SoC am Anfang der Reise (Start-SoC der ersten Fahrt). null, wenn unbekannt. */
  startSoc: number | null;
  /** SoC am Ende der Reise (End-SoC der letzten Fahrt). null, wenn unbekannt. */
  endSoc: number | null;
  /** Minimaler SoC über alle Fahrt-Endpunkte (Start- und End-SoC). null, wenn keine SoC-Daten. */
  minSoc: number | null;
  /** Maximaler SoC über alle Fahrt-Endpunkte (Start- und End-SoC). null, wenn keine SoC-Daten. */
  maxSoc: number | null;
  /** Summe der Ladekosten. null, wenn keine Kosten erfasst sind. */
  totalCost: number | null;
  /** true, wenn mindestens ein Ladevorgang keine Kosten hinterlegt hat. */
  hasIncompleteCost: boolean;
  /** Kosten pro 100 km. null, wenn keine Kosten oder keine Distanz > 0. */
  costPer100Km: number | null;
  /** Summe Höhenmeter bergauf (m). */
  ascentM: number;
  /** Summe Höhenmeter bergab (m). */
  descentM: number;
}

/**
 * Berechnet die Reise-Kennzahlen (vision.md §11) aus den zugeordneten Fahrten
 * und Ladevorgängen einer Journey. Reine Funktion, null-sicher: fehlende
 * Einzelwerte tragen 0 zur jeweiligen Summe bei und setzen wo relevant ein
 * Flag (anyEstimated, hasIncompleteCost). Start-/End-SoC folgen der
 * chronologischen Reihenfolge (erste/letzte Fahrt nach startTime).
 */
export function buildJourneyKpis(
  drives: KpiDrive[],
  charges: KpiCharge[],
): JourneyKpis {
  const sortedDrives = [...drives].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime(),
  );

  let totalDistanceKm = 0;
  let driveTimeSeconds = 0;
  let consumedEnergyKwh = 0;
  let anyEstimated = false;
  let ascentM = 0;
  let descentM = 0;

  const socValues: number[] = [];

  for (const d of sortedDrives) {
    if (d.distanceKm != null) totalDistanceKm += d.distanceKm;
    if (d.durationSeconds != null) driveTimeSeconds += d.durationSeconds;
    if (d.consumedEnergyKwh != null) {
      consumedEnergyKwh += d.consumedEnergyKwh;
      if (d.energyIsEstimated) anyEstimated = true;
    }
    if (d.ascentM != null) ascentM += d.ascentM;
    if (d.descentM != null) descentM += d.descentM;
    if (d.startSoc != null) socValues.push(d.startSoc);
    if (d.endSoc != null) socValues.push(d.endSoc);
  }

  const firstDrive = sortedDrives[0];
  const lastDrive = sortedDrives[sortedDrives.length - 1];
  const startSoc = firstDrive?.startSoc ?? null;
  const endSoc = lastDrive?.endSoc ?? null;
  const minSoc = socValues.length > 0 ? Math.min(...socValues) : null;
  const maxSoc = socValues.length > 0 ? Math.max(...socValues) : null;

  // avgConsumption über Gesamt-Energie / Gesamt-Distanz (kWh → Wh: * 1000).
  const avgConsumptionWhKm =
    totalDistanceKm > 0 ? (consumedEnergyKwh * 1000) / totalDistanceKm : null;

  let chargeTimeSeconds = 0;
  let chargedEnergyKwh = 0;
  let costSum = 0;
  let anyCost = false;
  let hasIncompleteCost = false;

  for (const c of charges) {
    if (c.durationSeconds != null) chargeTimeSeconds += c.durationSeconds;
    if (c.energyAddedKwh != null) chargedEnergyKwh += c.energyAddedKwh;
    const costNum = c.cost != null ? Number(c.cost) : null;
    if (costNum != null && Number.isFinite(costNum)) {
      costSum += costNum;
      anyCost = true;
    } else {
      hasIncompleteCost = true;
    }
  }

  const totalCost = anyCost ? costSum : null;
  const costPer100Km =
    totalCost != null && totalDistanceKm > 0
      ? (totalCost / totalDistanceKm) * 100
      : null;

  return {
    totalDistanceKm,
    driveTimeSeconds,
    chargeTimeSeconds,
    chargeStopCount: charges.length,
    avgConsumptionWhKm,
    consumedEnergyKwh,
    anyEstimated,
    chargedEnergyKwh,
    startSoc,
    endSoc,
    minSoc,
    maxSoc,
    totalCost,
    hasIncompleteCost,
    costPer100Km,
    ascentM,
    descentM,
  };
}
