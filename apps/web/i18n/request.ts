import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

/** Unterstützte Sprachen. Default ist Deutsch. */
export const LOCALES = ["de", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "de";

/** Cookie, in das der LocaleSwitcher die aktive Sprache schreibt. */
export const LOCALE_COOKIE = "tripatlas_locale";

/**
 * Feste Reihenfolge der Namespaces. Jede Sprache hat pro Namespace eine
 * Datei unter messages/<locale>/<ns>.json; der Dateiname wird zum Top-Level-Key
 * im gemergten Messages-Objekt (z. B. { common: {...}, nav: {...}, ... }).
 */
export const NAMESPACES = [
  "common",
  "nav",
  "auth",
  "ui",
  "dashboard",
  "weather",
  "day",
  "calendar",
  "bulk",
  "drives",
  "charges",
  "journeys",
  "places",
  "tags",
  "search",
  "reports",
  "insights",
  "settings",
  "rules",
  "planner",
  "exports",
] as const;

export function isLocale(value: string | undefined): value is Locale {
  return value === "de" || value === "en";
}

export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  // Alle Namespaces der aktiven Sprache dynamisch laden und unter ihrem
  // Namespace-Namen zusammenführen. Die Extraktions-Agents befüllen die
  // einzelnen Dateien; hier bleibt die Liste die einzige Quelle der Wahrheit.
  const entries = await Promise.all(
    NAMESPACES.map(
      async (ns) =>
        [ns, (await import(`../messages/${locale}/${ns}.json`)).default] as const,
    ),
  );

  return {
    locale,
    messages: Object.fromEntries(entries),
  };
});
