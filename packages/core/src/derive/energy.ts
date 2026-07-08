export interface DriveEnergyInput {
  startRatedRangeKm: number | null;
  endRatedRangeKm: number | null;
  efficiencyKwhPerKm: number | null;
  distanceKm: number | null;
}

export interface DriveEnergy {
  consumedEnergyKwh: number | null;
  avgConsumptionWhKm: number | null;
  /** TeslaMate liefert keinen Energiezähler pro Fahrt — immer Schätzung. */
  isEstimated: true;
}

// Mindestdistanz, unter der kein Durchschnittsverbrauch berechnet wird:
// Rangieren/Umparken erzeugt sonst absurde Wh/km-Werte.
const MIN_DISTANCE_FOR_AVG_KM = 0.5;

export function deriveDriveEnergy(input: DriveEnergyInput): DriveEnergy {
  const { startRatedRangeKm, endRatedRangeKm, efficiencyKwhPerKm, distanceKm } =
    input;

  let consumedEnergyKwh: number | null = null;
  if (
    startRatedRangeKm != null &&
    endRatedRangeKm != null &&
    efficiencyKwhPerKm != null
  ) {
    consumedEnergyKwh = (startRatedRangeKm - endRatedRangeKm) * efficiencyKwhPerKm;
  }

  let avgConsumptionWhKm: number | null = null;
  if (
    consumedEnergyKwh != null &&
    distanceKm != null &&
    distanceKm >= MIN_DISTANCE_FOR_AVG_KM &&
    // Rekuperations-Überschuss (negativer Verbrauch bergab) ist plausibel,
    // aber ein negativer Durchschnitt verwirrt mehr als er nützt → zulassen,
    // die UI kennzeichnet ihn. Nur NaN/Infinity abfangen.
    Number.isFinite(consumedEnergyKwh / distanceKm)
  ) {
    avgConsumptionWhKm = (consumedEnergyKwh * 1000) / distanceKm;
  }

  return { consumedEnergyKwh, avgConsumptionWhKm, isEstimated: true };
}
