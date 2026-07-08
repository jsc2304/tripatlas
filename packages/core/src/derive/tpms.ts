export interface TpmsReadings {
  fl: number | null;
  fr: number | null;
  rl: number | null;
  rr: number | null;
}

export interface TpmsThresholds {
  /** Absolute floor in bar — below this a tire always warns. Default 2.4. */
  minBar?: number;
  /** Max allowed deviation (bar) from the axle-pair mean before warning. Default 0.3. */
  maxAxleDeltaBar?: number;
}

export interface TpmsTireAssessment {
  value: number | null;
  warn: boolean;
}

export interface TpmsAssessment {
  fl: TpmsTireAssessment;
  fr: TpmsTireAssessment;
  rl: TpmsTireAssessment;
  rr: TpmsTireAssessment;
  anyWarn: boolean;
}

/**
 * Per-tire pressure assessment for the dashboard TPMS card.
 *
 * Two independent warning triggers per tire:
 * - absolute: value < minBar,
 * - relative: |value - axle-pair mean| > maxAxleDeltaBar (catches a slow leak
 *   before it drops under the absolute floor, by comparing each tire against
 *   its same-axle partner rather than a fixed reference).
 *
 * Null-safe: a missing tire never warns (nothing to compare), and a tire
 * with a null axle partner falls back to the absolute check only — there is
 * no pair mean to compute a deviation against.
 */
export function assessTpms(
  readings: TpmsReadings,
  thresholds: TpmsThresholds = {},
): TpmsAssessment {
  const minBar = thresholds.minBar ?? 2.4;
  const maxAxleDeltaBar = thresholds.maxAxleDeltaBar ?? 0.3;

  const fl = assessTire(readings.fl, readings.fr, minBar, maxAxleDeltaBar);
  const fr = assessTire(readings.fr, readings.fl, minBar, maxAxleDeltaBar);
  const rl = assessTire(readings.rl, readings.rr, minBar, maxAxleDeltaBar);
  const rr = assessTire(readings.rr, readings.rl, minBar, maxAxleDeltaBar);

  return {
    fl,
    fr,
    rl,
    rr,
    anyWarn: fl.warn || fr.warn || rl.warn || rr.warn,
  };
}

function assessTire(
  value: number | null,
  partner: number | null,
  minBar: number,
  maxAxleDeltaBar: number,
): TpmsTireAssessment {
  if (value == null) return { value: null, warn: false };

  if (value < minBar) return { value, warn: true };

  if (partner != null) {
    const axleMean = (value + partner) / 2;
    // Tiny epsilon absorbs float noise from the /2 division so an exact
    // boundary value (deviation === maxAxleDeltaBar) never flips by rounding.
    const EPSILON = 1e-9;
    if (Math.abs(value - axleMean) > maxAxleDeltaBar + EPSILON) {
      return { value, warn: true };
    }
  }

  return { value, warn: false };
}
