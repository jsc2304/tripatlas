import type { Classification } from "@tripatlas/core";

const VALID_CLASSIFICATIONS: Classification[] = [
  "unclassified",
  "private",
  "business",
  "commute",
];

const MONTH_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidFormat(format: string | null): format is "csv" | "pdf" {
  return format === "csv" || format === "pdf";
}

/**
 * Widened format check for exports that also support GPX (single drive,
 * journey) — kept separate from `isValidFormat` so day/month exports, which
 * have no route-based GPX output, can't silently accept `?format=gpx`.
 */
export function isValidFormatWithGpx(format: string | null): format is "csv" | "pdf" | "gpx" {
  return format === "csv" || format === "pdf" || format === "gpx";
}

export function isValidMonthParam(month: string): boolean {
  if (!MONTH_RE.test(month)) return false;
  const m = Number(month.slice(5, 7));
  return m >= 1 && m <= 12;
}

export function isValidDateParam(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m! - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * Parses the `classification=business,private` query param. Returns null for
 * "not provided" (caller should default to all), or throws if any value is
 * unknown (caller maps that to a 400).
 */
export function parseClassifications(raw: string | null): Classification[] | null {
  if (raw == null || raw.trim() === "") return null;
  const parts = raw.split(",").map((s) => s.trim()).filter((s) => s !== "");
  for (const part of parts) {
    if (!VALID_CLASSIFICATIONS.includes(part as Classification)) {
      throw new Error(`Ungültige Klassifizierung: ${part}`);
    }
  }
  return parts as Classification[];
}

export const ALL_CLASSIFICATIONS = VALID_CLASSIFICATIONS;
