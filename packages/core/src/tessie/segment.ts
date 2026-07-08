// Segmentierung der Tessie-Rohsignale in Fahrt- und Lade-Episoden.
// Reine Funktionen ohne I/O — der Importer (apps/worker) füttert bereits
// einheitenkonvertierte Samples (km, km/h) hinein.

export interface DriveSample {
  ts: number; // epoch ms
  lat: number | null;
  lon: number | null;
  shift: string | null; // D | R | N | P | null
  odometerKm: number; // nie leer in den Rohdaten
  speedKmh: number | null;
}

export interface DriveEpisode {
  startTs: number;
  endTs: number;
  startOdoKm: number;
  endOdoKm: number;
  samples: DriveSample[];
}

// Fahrt endet nach dieser Lücke zwischen zwei Samples (Tessie schläft/pausiert).
const DRIVE_GAP_MS = 10 * 60 * 1000;
// … oder wenn das Auto so lange ununterbrochen in P steht (Zwischenstopp vs.
// echtes Parken).
const SUSTAINED_PARK_MS = 5 * 60 * 1000;
// Rangier-Rauschen (Umparken auf dem Hof) verwerfen: nur wenn BEIDE Kriterien
// zutreffen (winzige Strecke UND kurze Dauer), sonst bleibt die Episode.
const MIN_DISTANCE_KM = 0.2;
const MIN_DURATION_MS = 2 * 60 * 1000;

function isMoving(s: DriveSample, prevOdo: number | null): boolean {
  if (s.shift === "D" || s.shift === "R" || s.shift === "N") return true;
  if (s.speedKmh != null && s.speedKmh > 0) return true;
  if (prevOdo != null && s.odometerKm > prevOdo) return true;
  return false;
}

/**
 * Bereinigt die Rohsamples vor der Segmentierung:
 * 1. Same-Second-Doubletten (identischer Zeitstempel): das letzte Sample gewinnt.
 * 2. Odometer-Rückwärts-Blips (Tessie-Artefakt, ≤0.02 mi): auf den vorherigen
 *    Wert klammern, damit die Strecke monoton bleibt.
 */
function cleanDriveSamples(raw: DriveSample[]): DriveSample[] {
  const out: DriveSample[] = [];
  for (const s of raw) {
    if (out.length > 0 && out[out.length - 1]!.ts === s.ts) {
      out[out.length - 1] = s; // keep last
    } else {
      out.push(s);
    }
  }

  let prevOdo: number | null = null;
  for (let i = 0; i < out.length; i++) {
    if (prevOdo != null && out[i]!.odometerKm < prevOdo) {
      out[i] = { ...out[i]!, odometerKm: prevOdo };
    }
    prevOdo = out[i]!.odometerKm;
  }

  return out;
}

function emitDrive(
  samples: DriveSample[],
  startI: number,
  endI: number,
  episodes: DriveEpisode[],
): void {
  if (endI < startI) return;
  const first = samples[startI]!;
  const last = samples[endI]!;
  const distanceKm = last.odometerKm - first.odometerKm;
  const durationMs = last.ts - first.ts;
  // Rangier-Rauschen verwerfen (winzige Strecke UND kurze Dauer).
  if (distanceKm < MIN_DISTANCE_KM && durationMs < MIN_DURATION_MS) return;
  episodes.push({
    startTs: first.ts,
    endTs: last.ts,
    startOdoKm: first.odometerKm,
    endOdoKm: last.odometerKm,
    samples: samples.slice(startI, endI + 1),
  });
}

/**
 * Zerlegt die (nach Zeit sortierte) Fahr-Signalserie in Fahrt-Episoden.
 * „Bewegt" = Gang D/R/N, Geschwindigkeit > 0 oder steigender Odometer. Eine
 * Episode endet bei einer Lücke > 10 min oder anhaltendem Parken (P) ≥ 5 min;
 * das Episodenende wird auf das letzte bewegte Sample getrimmt (nachlaufendes
 * Parken zählt nicht zur Fahrt). Winzige Rangier-Episoden werden verworfen.
 */
export function segmentDrives(raw: DriveSample[]): DriveEpisode[] {
  const samples = cleanDriveSamples(raw);
  const episodes: DriveEpisode[] = [];

  let startI = -1; // Startindex der laufenden Episode, -1 = keine
  let lastMoveI = -1; // letztes bewegtes Sample der laufenden Episode
  let parkStartTs: number | null = null; // Beginn des aktuellen P-Laufs

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!;
    const prevOdo = i > 0 ? samples[i - 1]!.odometerKm : null;
    const moving = isMoving(s, prevOdo);

    if (startI === -1) {
      if (moving) {
        startI = i;
        lastMoveI = i;
        parkStartTs = null;
      }
      continue;
    }

    const gap = s.ts - samples[i - 1]!.ts;
    if (gap > DRIVE_GAP_MS) {
      emitDrive(samples, startI, lastMoveI, episodes);
      if (moving) {
        startI = i;
        lastMoveI = i;
        parkStartTs = null;
      } else {
        startI = -1;
        lastMoveI = -1;
        parkStartTs = null;
      }
      continue;
    }

    if (moving) {
      lastMoveI = i;
      parkStartTs = null;
    } else {
      if (parkStartTs === null) {
        parkStartTs = s.ts;
      } else if (s.ts - parkStartTs >= SUSTAINED_PARK_MS) {
        emitDrive(samples, startI, lastMoveI, episodes);
        startI = -1;
        lastMoveI = -1;
        parkStartTs = null;
      }
    }
  }

  if (startI !== -1) emitDrive(samples, startI, lastMoveI, episodes);

  return episodes;
}

export interface ChargeSample {
  ts: number; // epoch ms
  state: string | null; // Charging | Stopped | Complete | Disconnected | …
  soc: number | null; // Usable Battery Level (%)
  powerKw: number | null;
  phases: number | null;
  voltage: number | null;
}

export interface ChargeEpisode {
  startTs: number;
  endTs: number;
  startSoc: number | null;
  endSoc: number | null;
  maxPowerKw: number | null;
  avgPowerKw: number | null;
  chargerType: "ac" | "dc";
  samples: ChargeSample[];
}

// Ladevorgang endet nach dieser Lücke zwischen zwei Charging-Samples.
const CHARGE_GAP_MS = 15 * 60 * 1000;

function classifyCharger(
  ref: ChargeSample,
  maxPowerKw: number | null,
): "ac" | "dc" {
  // AC: Phasen bekannt UND Netzspannung im Haushaltsbereich (150–260 V).
  if (
    ref.phases != null &&
    ref.voltage != null &&
    ref.voltage >= 150 &&
    ref.voltage <= 260
  ) {
    return "ac";
  }
  // Sonst über die Spitzenleistung: > 11 kW ist praktisch immer DC.
  if (maxPowerKw != null && maxPowerKw > 11) return "dc";
  return "ac";
}

function buildChargeEpisode(samples: ChargeSample[]): ChargeEpisode {
  const first = samples[0]!;
  const last = samples[samples.length - 1]!;

  let maxPowerKw: number | null = null;
  let refSample = first; // Sample bei Spitzenleistung entscheidet über AC/DC
  let powerSum = 0;
  let powerCount = 0;
  for (const s of samples) {
    if (s.powerKw == null) continue;
    if (maxPowerKw == null || s.powerKw > maxPowerKw) {
      maxPowerKw = s.powerKw;
      refSample = s;
    }
    if (s.powerKw > 0) {
      powerSum += s.powerKw;
      powerCount++;
    }
  }

  return {
    startTs: first.ts,
    endTs: last.ts,
    startSoc: first.soc,
    endSoc: last.soc,
    maxPowerKw,
    avgPowerKw: powerCount > 0 ? powerSum / powerCount : null,
    chargerType: classifyCharger(refSample, maxPowerKw),
    samples,
  };
}

/**
 * Zerlegt die (nach Zeit sortierte) Lade-Signalserie in Lade-Episoden: jeder
 * zusammenhängende Lauf von state === 'Charging'. Ein Zustandswechsel
 * (jedes Nicht-Charging-Sample) oder eine Lücke > 15 min zwischen zwei
 * Charging-Samples beendet die Episode.
 */
export function segmentCharges(samples: ChargeSample[]): ChargeEpisode[] {
  const episodes: ChargeEpisode[] = [];
  let cur: ChargeSample[] = [];

  const flush = () => {
    if (cur.length > 0) {
      episodes.push(buildChargeEpisode(cur));
      cur = [];
    }
  };

  for (const s of samples) {
    if (s.state === "Charging") {
      if (cur.length > 0 && s.ts - cur[cur.length - 1]!.ts > CHARGE_GAP_MS) {
        flush();
      }
      cur.push(s);
    } else {
      // Zustandswechsel beendet den laufenden Ladevorgang.
      flush();
    }
  }
  flush();

  return episodes;
}
