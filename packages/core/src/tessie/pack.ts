export interface PackSample {
  usableLevel: number | null; // Usable Battery Level (%)
  energyRemainingKwh: number | null; // Energy Remaining (kWh)
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Schätzt die nutzbare Pack-Kapazität (kWh) aus gepaarten Batterie-Samples:
 * Median von energyRemainingKwh / (usableLevel/100). Nur Samples mit Level
 * 20–90 % zählen — an den Rändern ist die SoC-Anzeige nichtlinear und würde die
 * Schätzung verzerren. Basis für die SoC-Delta-Energie (Fahrten vor der
 * Batterie-Serie) und die geladene Energie je Ladevorgang.
 */
export function estimateUsablePackKwh(samples: PackSample[]): number | null {
  const values: number[] = [];
  for (const s of samples) {
    if (s.usableLevel == null || s.energyRemainingKwh == null) continue;
    if (s.usableLevel < 20 || s.usableLevel > 90) continue;
    values.push(s.energyRemainingKwh / (s.usableLevel / 100));
  }
  return median(values);
}
