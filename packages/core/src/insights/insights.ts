// Reine, framework-freie Insights-Bausteine (M21). Wie `reports/` importiert
// dieses Modul KEINE Drizzle-Typen — die Web-App mappt DB-Rows auf einfache
// Getter (getX/getY) und ruft die Funktionen hier. So bleiben Binning,
// Wochentagsmuster und die Schwellwerte deterministisch und unit-testbar.

/**
 * Mindestanzahl auswertbarer Fahrten, ab der eine Insights-Karte überhaupt
 * eine Auswertung zeigt (darunter: freundlicher EmptyState). Die Seite selbst
 * ist immer erreichbar — die Schwelle gilt pro Karte.
 */
export const MIN_DRIVES_TOTAL = 30;

/** Mindestanzahl Datenpunkte je Bin, damit ein Bin-Mittel gezeigt wird. */
export const MIN_PER_BIN = 3;

export interface Bin {
  /** Mitte des Bins auf der X-Achse (z. B. 12.5 für den 10–15-°C-Bin bei 5er-Breite). */
  xCenter: number;
  /** Untere (inklusive) Bin-Grenze. */
  xStart: number;
  /** Mittelwert der Y-Werte im Bin. */
  meanY: number;
  /** Anzahl berücksichtigter Punkte im Bin. */
  count: number;
}

/**
 * Bündelt Items in gleich breite X-Bins und liefert je Bin die X-Mitte, das
 * Y-Mittel und die Anzahl. Punkte mit null/NaN in X oder Y werden übersprungen.
 * Nur Bins mit `count >= MIN_PER_BIN` erscheinen im Ergebnis; die Bins sind
 * nach xStart aufsteigend sortiert.
 *
 * Ein Bin `k` deckt das halboffene Intervall
 *   [k * binWidth, (k + 1) * binWidth)
 * ab (floor-basiert, funktioniert auch für negative Werte, z. B. Minusgrade).
 */
export function binByNumeric<T>(
  items: readonly T[],
  getX: (item: T) => number | null | undefined,
  getY: (item: T) => number | null | undefined,
  binWidth: number,
): Bin[] {
  if (!(binWidth > 0)) {
    throw new Error("binWidth must be a positive number");
  }

  const buckets = new Map<number, { sumY: number; count: number }>();

  for (const item of items) {
    const x = getX(item);
    const y = getY(item);
    if (x == null || y == null) continue;
    if (Number.isNaN(x) || Number.isNaN(y)) continue;

    const k = Math.floor(x / binWidth);
    const bucket = buckets.get(k) ?? { sumY: 0, count: 0 };
    bucket.sumY += y;
    bucket.count += 1;
    buckets.set(k, bucket);
  }

  const bins: Bin[] = [];
  for (const [k, { sumY, count }] of buckets) {
    if (count < MIN_PER_BIN) continue;
    const xStart = k * binWidth;
    bins.push({
      xStart,
      xCenter: xStart + binWidth / 2,
      meanY: sumY / count,
      count,
    });
  }

  bins.sort((a, b) => a.xStart - b.xStart);
  return bins;
}

export interface WeekdayBucket {
  /** Wochentag 0..6 als ISO-artiger Index (Konvention vom Aufrufer, s. getDow). */
  dow: number;
  /** Mittelwert der Y-Werte an diesem Wochentag. */
  meanY: number;
  /** Summe der Y-Werte an diesem Wochentag (für km-Summen praktisch). */
  sumY: number;
  /** Anzahl Fahrten an diesem Wochentag. */
  count: number;
}

/**
 * Aggregiert Items je Wochentag. `getDow` liefert den Wochentag-Index (der
 * Aufrufer bestimmt die Konvention — z. B. 0=Montag..6=Sonntag; die Funktion
 * bleibt timezone-agnostisch, weil sie nur mit den bereits berechneten Indizes
 * arbeitet). Es werden immer sieben Buckets (dow 0..6) zurückgegeben, auch
 * leere (count=0, meanY=0), damit die Anzeige eine feste Mo–So-Achse hat.
 * Punkte mit null/NaN in Y werden übersprungen; ein ungültiger dow (außerhalb
 * 0..6) wird ignoriert.
 */
export function weeklyPattern<T>(
  items: readonly T[],
  getDow: (item: T) => number,
  getY: (item: T) => number | null | undefined,
): WeekdayBucket[] {
  const buckets: WeekdayBucket[] = Array.from({ length: 7 }, (_, dow) => ({
    dow,
    meanY: 0,
    sumY: 0,
    count: 0,
  }));

  for (const item of items) {
    const dow = getDow(item);
    if (!Number.isInteger(dow) || dow < 0 || dow > 6) continue;
    const y = getY(item);
    if (y == null || Number.isNaN(y)) continue;
    const bucket = buckets[dow]!;
    bucket.sumY += y;
    bucket.count += 1;
  }

  for (const bucket of buckets) {
    bucket.meanY = bucket.count > 0 ? bucket.sumY / bucket.count : 0;
  }

  return buckets;
}

/**
 * Vergleicht das Verbrauchs-Mittel bei niedriger Temperatur mit dem bei ~20 °C
 * und liefert die relative Mehrverbrauchs-Angabe (Prozent), aus der die Karte
 * ihren dynamischen Untertitel baut. Sucht den Bin, dessen Mitte 20 °C am
 * nächsten liegt (Referenz), und den kältesten Bin mit xCenter < 10 °C. Gibt
 * null zurück, wenn eine der beiden Seiten fehlt (dann nutzt die UI einen
 * generischen Text).
 */
export interface ColdVsMildDelta {
  coldCenter: number;
  mildCenter: number;
  coldMeanY: number;
  mildMeanY: number;
  /** (cold - mild) / mild, z. B. 0.12 = +12 %. */
  relativeDelta: number;
}

export function coldVsMildDelta(bins: readonly Bin[]): ColdVsMildDelta | null {
  if (bins.length < 2) return null;

  const cold = bins.filter((b) => b.xCenter < 10);
  if (cold.length === 0) return null;
  // Kältester verfügbarer Bin.
  const coldBin = cold.reduce((a, b) => (b.xCenter < a.xCenter ? b : a));

  // Referenz: Bin mit Mitte am nächsten zu 20 °C, aber deutlich wärmer als der
  // Kälte-Bin (mind. 5 °C Abstand, damit der Vergleich aussagekräftig ist).
  const warm = bins.filter((b) => b.xCenter >= coldBin.xCenter + 5);
  if (warm.length === 0) return null;
  const mildBin = warm.reduce((a, b) =>
    Math.abs(b.xCenter - 20) < Math.abs(a.xCenter - 20) ? b : a,
  );

  if (mildBin.meanY === 0) return null;
  return {
    coldCenter: coldBin.xCenter,
    mildCenter: mildBin.xCenter,
    coldMeanY: coldBin.meanY,
    mildMeanY: mildBin.meanY,
    relativeDelta: (coldBin.meanY - mildBin.meanY) / mildBin.meanY,
  };
}

export interface ShortTripShare {
  /** Anzahl Kurzstrecken-Fahrten (< thresholdKm). */
  shortCount: number;
  /** Gesamtzahl ausgewerteter Fahrten. */
  totalCount: number;
  /** Anteil Kurzstrecken 0..1. */
  shortShare: number;
  /** Ø-Verbrauch der Kurzstrecken (Wh/km), null falls keine mit Verbrauch. */
  shortMeanConsumption: number | null;
  /** Ø-Verbrauch aller ausgewerteten Fahrten (Wh/km), null falls keiner. */
  overallMeanConsumption: number | null;
}

/**
 * Anteil der Kurzstrecken (< thresholdKm) und deren Ø-Verbrauch gegenüber dem
 * Gesamt-Ø. Kurzstrecke ist ein Verbrauchstreiber (kalter Antriebsstrang),
 * daher der direkte Vergleich. Items ohne distanceKm werden ignoriert; der
 * Verbrauchs-Ø berücksichtigt nur Items mit vorhandenem Verbrauch.
 */
export function shortTripShare<T>(
  items: readonly T[],
  getDistanceKm: (item: T) => number | null | undefined,
  getConsumption: (item: T) => number | null | undefined,
  thresholdKm: number,
): ShortTripShare {
  let shortCount = 0;
  let totalCount = 0;
  let shortSum = 0;
  let shortConsCount = 0;
  let overallSum = 0;
  let overallConsCount = 0;

  for (const item of items) {
    const dist = getDistanceKm(item);
    if (dist == null || Number.isNaN(dist)) continue;
    totalCount += 1;

    const cons = getConsumption(item);
    const hasCons = cons != null && !Number.isNaN(cons);
    if (hasCons) {
      overallSum += cons;
      overallConsCount += 1;
    }

    if (dist < thresholdKm) {
      shortCount += 1;
      if (hasCons) {
        shortSum += cons;
        shortConsCount += 1;
      }
    }
  }

  return {
    shortCount,
    totalCount,
    shortShare: totalCount > 0 ? shortCount / totalCount : 0,
    shortMeanConsumption: shortConsCount > 0 ? shortSum / shortConsCount : null,
    overallMeanConsumption:
      overallConsCount > 0 ? overallSum / overallConsCount : null,
  };
}
