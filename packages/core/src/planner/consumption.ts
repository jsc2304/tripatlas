// Reines, framework-freies Verbrauchsmodell für den Routenplaner-MVP
// („Reichweiten-Check"). Wie die übrigen core-Module importiert es KEINE
// Drizzle-/Framework-Typen — die Web-App lädt Basisverbrauch, Höhenprofil und
// OSRM-Kennzahlen und ruft `predictConsumption` mit einfachen Zahlen. So bleibt
// das Modell deterministisch und unit-testbar.
//
// Produktprinzip „Nachvollziehbarkeit statt Magie": jede Konstante ist benannt,
// kommentiert und im Ergebnis als Aufschlüsselung (`breakdown`) sichtbar, damit
// die UI offenlegen kann, wie sich der prognostizierte Verbrauch zusammensetzt.

/**
 * Anteil des Basisverbrauchs, der als aerodynamischer (geschwindigkeits-
 * abhängiger) Term modelliert wird. Der Luftwiderstand skaliert mit v², die
 * dafür nötige Energie *pro km* ebenfalls mit v². Rollwiderstand, Antriebs-
 * strang-Grundlast und Nebenverbraucher (Heizung/Klima) gelten hier als
 * geschwindigkeitsunabhängig. 0.5 = die Hälfte des Basisverbrauchs reagiert auf
 * Tempo — bewusst konservativ (reale Tesla-Aufschläge bei Autobahntempo liegen
 * grob in dieser Größenordnung), lieber unterschätzen als Reichweite vorgaukeln.
 */
export const AERO_SPEED_FRACTION = 0.5;

/**
 * Kappung des Tempo-Verhältnisses (geplantes Ø-Tempo / historisches Ø-Tempo),
 * damit ein Ausreißer in der OSRM-Fahrzeit (z. B. Stau-freie Ideal-Dauer) den
 * v²-Term nicht explodieren lässt. Bei 1.5 steigt der Aero-Term höchstens auf
 * das 2.25-fache, bei 0.6 sinkt er höchstens auf das 0.36-fache.
 */
export const SPEED_RATIO_MIN = 0.6;
export const SPEED_RATIO_MAX = 1.5;

/**
 * Referenz-Ø-Geschwindigkeit (km/h), gegen die die Tempo-Anpassung rechnet,
 * falls die persönliche Historie keine Ø-Geschwindigkeit liefert. ~45 km/h
 * entspricht typischem Misch-Fahrprofil (Stadt + Landstraße + etwas Autobahn).
 */
export const DEFAULT_REFERENCE_SPEED_KMH = 45;

/**
 * Netto-Energie aus der Batterie je Meter Anstieg (Wh/m). Herleitung: potenzielle
 * Energie E = m·g·h. Für ~2000 kg Fahrzeugmasse und 1 m Höhe:
 *   2000 kg · 9.81 m/s² · 1 m = 19 620 J = 5.45 Wh.
 * Bei ~90 % Antriebsstrang-Wirkungsgrad bergauf zieht die Batterie ~6 Wh/m.
 * Wir nutzen 5.5 Wh/m als gerundeten, leicht konservativen Netto-Wert (im vom
 * Auftrag genannten Korridor ~5–6 Wh/m).
 */
export const GRAVITY_WH_PER_M = 5.5;

/**
 * Anteil der bergab freiwerdenden potenziellen Energie, der per Rekuperation
 * zurück in die Batterie fließt. Konservativ 60 % — reale Rekup-Verluste
 * (Wandlung, Grenzen bei vollem Akku / hohem Tempo) fressen den Rest. Bergauf
 * kostet also voll (mit Verlusten), bergab gibt es nur einen Teil zurück:
 * gewollte Asymmetrie, damit welliges Profil nie „gratis" wird.
 */
export const DESCENT_REGEN_FRACTION = 0.6;

export interface PredictConsumptionInput {
  /** Streckenlänge in km (aus OSRM `distance`). */
  distanceKm: number;
  /** Geplantes Ø-Tempo in km/h (aus OSRM `distance`/`duration`). */
  avgSpeedKmh: number;
  /** Erwartete Außentemperatur in °C (fließt bereits über `baseWhPerKm` ein). */
  tempC: number;
  /** Summe der Anstiegsmeter entlang der Route. */
  ascentM: number;
  /** Summe der Abstiegsmeter entlang der Route (positiver Wert). */
  descentM: number;
  /**
   * Basisverbrauch in Wh/km bei ~Referenztempo und der gegebenen Temperatur —
   * kommt aus der persönlichen Historie (Temp-Bin), einem Gesamt-Ø oder der
   * Fahrzeug-Effizienz. Enthält Rollwiderstand, Grundlast und Klima bereits.
   */
  baseWhPerKm: number;
  /**
   * Historische Ø-Geschwindigkeit (km/h), gegen die die Tempo-Anpassung
   * relativiert wird. Fehlt sie, greift DEFAULT_REFERENCE_SPEED_KMH.
   */
  referenceSpeedKmh?: number;
}

export interface ConsumptionBreakdown {
  /** Basisenergie = baseWhPerKm · Distanz. */
  baseKwh: number;
  /** Auf-/Abschlag durch abweichendes Tempo (aerodynamischer Term), ± kWh. */
  speedAdjustmentKwh: number;
  /** Energie für die Anstiegsmeter (immer ≥ 0). */
  ascentKwh: number;
  /** Rekuperations-Gutschrift der Abstiegsmeter (immer ≤ 0). */
  descentCreditKwh: number;
  /** Verwendete (gekappte) Referenz-Geschwindigkeit. */
  referenceSpeedKmh: number;
  /** Multiplikator, mit dem der Basisverbrauch tempoabhängig skaliert wurde. */
  speedFactor: number;
}

export interface ConsumptionPrediction {
  /** Prognostizierter Gesamtverbrauch in kWh (kann bei starkem Gefälle < 0 sein). */
  energyKwh: number;
  /** Effektiver Prognose-Verbrauch in Wh/km über die Gesamtstrecke. */
  whPerKm: number;
  breakdown: ConsumptionBreakdown;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Prognostiziert den Fahrt-Energiebedarf aus Streckenlänge, geplantem Tempo,
 * Höhenprofil und persönlichem Basisverbrauch. Additives Modell mit vier
 * offengelegten Termen:
 *
 *   energie = basis + tempo-anpassung + anstieg − rekup-gutschrift
 *
 * - Basis: baseWhPerKm · Distanz (enthält Temperatur bereits, da baseWhPerKm
 *   aus dem passenden Temperatur-Bin der Historie stammt).
 * - Tempo: nur der aerodynamische Anteil (AERO_SPEED_FRACTION) skaliert mit
 *   (v/ref)²; das Verhältnis ist auf [SPEED_RATIO_MIN, SPEED_RATIO_MAX] gekappt.
 * - Anstieg: GRAVITY_WH_PER_M je Höhenmeter (voll, inkl. Antriebsverlusten).
 * - Abstieg: nur DESCENT_REGEN_FRACTION der potenziellen Energie zurück.
 *
 * Rein & deterministisch — keine I/O, keine Zufallswerte.
 */
export function predictConsumption(
  input: PredictConsumptionInput,
): ConsumptionPrediction {
  const { distanceKm, avgSpeedKmh, ascentM, descentM, baseWhPerKm } = input;

  const referenceSpeedKmh =
    input.referenceSpeedKmh != null && input.referenceSpeedKmh > 0
      ? input.referenceSpeedKmh
      : DEFAULT_REFERENCE_SPEED_KMH;

  // Entartete Eingaben (0 km) → alles 0, keine Division durch 0.
  if (!(distanceKm > 0)) {
    return {
      energyKwh: 0,
      whPerKm: 0,
      breakdown: {
        baseKwh: 0,
        speedAdjustmentKwh: 0,
        ascentKwh: 0,
        descentCreditKwh: 0,
        referenceSpeedKmh,
        speedFactor: 1,
      },
    };
  }

  const baseKwh = (baseWhPerKm * distanceKm) / 1000;

  // Aerodynamischer Tempo-Term: nur AERO_SPEED_FRACTION des Basisverbrauchs
  // reagiert mit v² auf das Tempo, der Rest bleibt konstant.
  const rawRatio = avgSpeedKmh > 0 ? avgSpeedKmh / referenceSpeedKmh : 1;
  const ratio = clamp(rawRatio, SPEED_RATIO_MIN, SPEED_RATIO_MAX);
  const speedFactor =
    1 - AERO_SPEED_FRACTION + AERO_SPEED_FRACTION * ratio * ratio;
  const speedAdjustedWhPerKm = baseWhPerKm * speedFactor;
  const speedAdjustmentKwh =
    ((speedAdjustedWhPerKm - baseWhPerKm) * distanceKm) / 1000;

  // Höhenterm: bergauf voll, bergab nur der rekuperierte Anteil (als Gutschrift).
  const ascentKwh = (Math.max(0, ascentM) * GRAVITY_WH_PER_M) / 1000;
  const descentCreditKwh =
    -(Math.max(0, descentM) * GRAVITY_WH_PER_M * DESCENT_REGEN_FRACTION) / 1000;

  const energyKwh = baseKwh + speedAdjustmentKwh + ascentKwh + descentCreditKwh;
  const whPerKm = (energyKwh * 1000) / distanceKm;

  return {
    energyKwh,
    whPerKm,
    breakdown: {
      baseKwh,
      speedAdjustmentKwh,
      ascentKwh,
      descentCreditKwh,
      referenceSpeedKmh,
      speedFactor,
    },
  };
}
