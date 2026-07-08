export type PlaceType = "home" | "work" | "customer" | "charger" | "other";

// Labels for PlaceType live in messages/{de,en}/places.json under
// "placeTypes.<type>" — look them up via t(`placeTypes.${type}`) rather than
// a static record, so both locales render correctly.

export const PLACE_TYPE_OPTIONS: PlaceType[] = [
  "home",
  "work",
  "customer",
  "charger",
  "other",
];

export const DEFAULT_RADIUS_M = 100;
export const MIN_RADIUS_M = 25;
export const MAX_RADIUS_M = 1000;
