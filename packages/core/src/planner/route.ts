// Reine Routen-Hilfsfunktionen für den Routenplaner-MVP: gleichmäßiges
// Downsampling einer Geometrie (für den Elevation-Batch-Request und die
// leichte Karten-Polyline) sowie Auf-/Abstiegs-Summierung aus einem
// Höhenprofil. Framework-frei und unit-testbar.

/**
 * Unter dieser Schwelle (in m) gilt eine Höhendifferenz zwischen zwei
 * benachbarten Stützpunkten als Rauschen und wird ignoriert. Die Elevation-
 * Daten (SRTM ~90 m Raster) und das Downsampling auf ≤100 Punkte glätten das
 * Profil bereits; ohne Schwelle würde Mess-Jitter die Höhenmeter aufblähen.
 */
export const ELEVATION_NOISE_THRESHOLD_M = 1;

/**
 * Wählt aus `items` höchstens `max` gleichmäßig verteilte Elemente aus und
 * behält dabei immer das erste und letzte (Start/Ziel). Ergibt für
 * `items.length > max` exakt `max` Elemente. Für `items.length <= max` wird die
 * Liste unverändert (als Kopie) zurückgegeben.
 *
 * Verwendet für (a) den Open-Meteo-Elevation-Batch (≤100 Koordinaten pro
 * Request) und (b) das Ausdünnen der Karten-Polyline auf eine leichte Größe.
 */
export function downsample<T>(items: readonly T[], max: number): T[] {
  if (max < 2) {
    throw new Error("downsample: max must be >= 2");
  }
  if (items.length <= max) return [...items];

  const out: T[] = [];
  const step = (items.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) {
    out.push(items[Math.round(i * step)]!);
  }
  return out;
}

export interface ElevationSummary {
  /** Summe aller Anstiege (m). */
  ascentM: number;
  /** Summe aller Abstiege (m, positiver Wert). */
  descentM: number;
}

/**
 * Summiert Auf- und Abstiegsmeter entlang eines Höhenprofils. Punkte ohne Wert
 * (null/NaN) werden übersprungen, ohne die Kette zu unterbrechen (der nächste
 * gültige Punkt vergleicht gegen den letzten gültigen). Differenzen unterhalb
 * von ELEVATION_NOISE_THRESHOLD_M zählen als Rauschen und werden verworfen.
 */
export function summarizeElevation(
  elevations: readonly (number | null | undefined)[],
): ElevationSummary {
  let ascentM = 0;
  let descentM = 0;
  let prev: number | null = null;

  for (const e of elevations) {
    if (e == null || Number.isNaN(e)) continue;
    if (prev != null) {
      const delta = e - prev;
      if (delta > ELEVATION_NOISE_THRESHOLD_M) {
        ascentM += delta;
      } else if (delta < -ELEVATION_NOISE_THRESHOLD_M) {
        descentM += -delta;
      }
    }
    prev = e;
  }

  return { ascentM, descentM };
}
