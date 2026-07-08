export type IntlLocale = "de-DE" | "en-GB";

export function toIntlLocale(locale: string): IntlLocale {
  return locale === "en" ? "en-GB" : "de-DE";
}
