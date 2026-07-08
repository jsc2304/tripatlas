/**
 * Berechnet automatische Ladekosten aus geladener Energie und dem Strompreis
 * pro kWh am Ort (auf 2 Nachkommastellen gerundet). Reine Formel — Herkunft
 * (cost_source) und Währung setzt der Aufrufer (Worker-Sync bzw.
 * Places-Action); core bleibt frei von DB-Zugriff.
 * Example: computeAutoChargeCost(30, 0.32) -> 9.6
 * Example: computeAutoChargeCost(12.345, 0.359) -> 4.43
 */
export function computeAutoChargeCost(
  energyAddedKwh: number,
  pricePerKwh: number,
): number {
  return Math.round(energyAddedKwh * pricePerKwh * 100) / 100;
}
