/**
 * Höhenmeter-Berechnung nach vision.md §12/§15.6:
 *
 *   1. GPS-Track glätten           (syncElevations liefert die Rohwerte)
 *   2. Trackpunkte reduzieren      (bereits beim Route-Sync per Downsampling)
 *   3. Höhenwerte ergänzen         (Open-Meteo Elevation API, apps/worker)
 *   4. Höhenprofil glätten         -> smoothElevations
 *   5. kleine Ausreißer ignorieren -> computeElevationGain (Schwellwert)
 *   6. positive Differenzen summieren
 *   7. negative Differenzen summieren
 *
 * Ziel: GPS-/API-Rauschen soll nicht als Höhenmeter gezählt werden. Die
 * Ergebnisse gelten als "berechnet" und werden in der UI entsprechend
 * gekennzeichnet (TeslaMate-Werte bleiben die primäre Anzeige, falls vorhanden).
 */

export interface ElevationGain {
  gainM: number;
  lossM: number;
}

/**
 * Zentrierter gleitender Mittelwert über die Höhenwerte, um kleine
 * Sprünge (GPS-/API-Rauschen) vor der Gain/Loss-Berechnung zu dämpfen.
 * windowSize muss ungerade sein, damit der Mittelwert wirklich zentriert ist
 * (gerade Werte werden auf den nächstkleineren ungeraden Wert abgerundet).
 */
export function smoothElevations(
  points: { elevationM: number }[],
  windowSize = 5,
): number[] {
  const n = points.length;
  if (n === 0) return [];

  const half = Math.max(0, Math.floor((windowSize - 1) / 2));

  const result: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const from = Math.max(0, i - half);
    const to = Math.min(n - 1, i + half);
    let sum = 0;
    for (let j = from; j <= to; j++) {
      sum += points[j]!.elevationM;
    }
    result[i] = sum / (to - from + 1);
  }
  return result;
}

/**
 * Summiert positive/negative Höhendifferenzen zwischen aufeinanderfolgenden
 * (bereits geglätteten) Höhenwerten, mit Hysterese: eine Richtungsänderung
 * zählt erst, wenn die kumulierte Abweichung vom letzten Referenzpunkt den
 * Schwellwert überschreitet. Das verhindert, dass GPS-/Elevation-Rauschen
 * (kleines Auf und Ab im Bereich weniger Meter) als Höhenmeter gezählt wird.
 */
export function computeElevationGain(
  elevations: number[],
  thresholdM = 2,
): ElevationGain {
  if (elevations.length < 2) return { gainM: 0, lossM: 0 };

  let gainM = 0;
  let lossM = 0;
  // Referenzpunkt, ab dem die kumulierte Differenz gemessen wird.
  let reference = elevations[0]!;

  for (let i = 1; i < elevations.length; i++) {
    const delta = elevations[i]! - reference;

    if (delta >= thresholdM) {
      gainM += delta;
      reference = elevations[i]!;
    } else if (delta <= -thresholdM) {
      lossM += -delta;
      reference = elevations[i]!;
    }
    // |delta| < thresholdM: Ausreißer/Rauschen ignorieren, Referenz bleibt stehen.
  }

  return { gainM, lossM };
}
