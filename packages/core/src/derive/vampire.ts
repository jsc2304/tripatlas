export interface VampireLossInput {
  prevEndSoc: number | null;
  nextStartSoc: number | null;
  hadCharge: boolean;
}

/**
 * Vampir-Verlust einer Park-Session: endSoc der Fahrt davor minus startSoc
 * der Fahrt danach (beide source='teslamate', Nachbarn über Zeittoleranz
 * ±2 min gematcht — das übernimmt der Aufrufer/die Query).
 *
 * NULL wenn:
 * - während des Parks geladen wurde (hadCharge) — der SoC-Anstieg durchs
 *   Laden überlagert den Vampir-Verlust, er ist dann nicht bestimmbar,
 * - einer der beiden SoC-Werte fehlt (kein passender Nachbar-Drive gefunden,
 *   z.B. offener Park oder Datenlücke).
 *
 * Der Verlust wird bei negativen Werten (SoC-Messrauschen — TeslaMate rundet
 * ganzzahlig, ein "Gewinn" von 1 % über einen reinen Stand ist physikalisch
 * nicht plausibel) auf 0 geclamped statt den negativen Wert anzuzeigen.
 */
export function computeVampireLoss({
  prevEndSoc,
  nextStartSoc,
  hadCharge,
}: VampireLossInput): number | null {
  if (hadCharge) return null;
  if (prevEndSoc == null || nextStartSoc == null) return null;

  const loss = prevEndSoc - nextStartSoc;
  return Math.max(0, loss);
}
