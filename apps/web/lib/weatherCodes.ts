import {
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudRain,
  CloudSnow,
  CloudLightning,
  type LucideIcon,
} from "lucide-react";

/**
 * Maps a WMO weather code (as returned by Open-Meteo) to the message key
 * used under the `weather.code.*` i18n namespace (messages/<locale>/weather.json).
 * Grouped by the official WMO 4677 code table sections; every recognised
 * code has its own key (some share the same label per language, but each
 * WMO code is listed explicitly so translators can differentiate later).
 * Callers resolve the actual label via `t(`code.${weatherCodeKey(code)}`)`.
 */
export function weatherCodeKey(code: number): string {
  if (code === 0) return "0";
  if (code === 1) return "1";
  if (code === 2) return "2";
  if (code === 3) return "3";
  if (code === 45 || code === 48) return String(code);
  if (code >= 51 && code <= 55) return String(code);
  if (code === 56 || code === 57) return String(code);
  if (code >= 61 && code <= 65) return String(code);
  if (code === 66 || code === 67) return String(code);
  if (code >= 71 && code <= 75) return String(code);
  if (code === 77) return "77";
  if (code === 80 || code === 81 || code === 82) return String(code);
  if (code === 85 || code === 86) return String(code);
  if (code === 95) return "95";
  if (code === 96 || code === 99) return String(code);
  return "unknown";
}

export function weatherCodeIcon(code: number): LucideIcon {
  if (code === 0) return Sun;
  if (code === 1 || code === 2) return CloudSun;
  if (code === 3) return Cloud;
  if (code === 45 || code === 48) return CloudFog;
  if (
    (code >= 51 && code <= 57) ||
    (code >= 61 && code <= 67) ||
    (code >= 80 && code <= 82)
  ) {
    return CloudRain;
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return CloudSnow;
  if (code === 95 || code === 96 || code === 99) return CloudLightning;
  return Cloud;
}
