"use server";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { auditLog, chargeSessions, places } from "@tripatlas/db";
import { computeAutoChargeCost } from "@tripatlas/core";
import { db } from "../db";
import { validateSession } from "../auth/session";
import { rematchAllPlaces } from "../rematch";
import { MAX_RADIUS_M, MIN_RADIUS_M } from "../places";

type Translator = Awaited<ReturnType<typeof getTranslations>>;

const placeTypeSchema = z.enum(["home", "work", "customer", "charger", "other"]);

/**
 * Builds the place input schema with locale-aware validation messages. Built
 * per-request (instead of as a module-level constant) since the messages
 * come from next-intl's `getTranslations`, which is only available inside an
 * async request/action context.
 */
function buildPlaceInputSchema(t: Translator) {
  return z.object({
    name: z.string().trim().min(1, t("errors.nameRequired")).max(200),
    type: placeTypeSchema,
    lat: z.number().gte(-90).lte(90),
    lon: z.number().gte(-180).lte(180),
    radiusM: z.number().int().min(MIN_RADIUS_M).max(MAX_RADIUS_M),
    address: z.string().trim().max(500).nullable(),
    // Strompreis am Ort (user-owned) — Basis für automatische Ladekosten, siehe
    // packages/db/src/schema.ts. Formatvalidierung hier, Wert>0 + Währung
    // erforderlich via priceFieldsError (cross-field, s.u.).
    electricityPricePerKwh: z
      .string()
      .regex(/^\d+(\.\d{1,4})?$/, t("errors.invalidElectricityPrice"))
      .nullable(),
    electricityPriceCurrency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, t("errors.invalidCurrency"))
      .nullable(),
  });
}

/**
 * Cross-field-Validierung der Strompreis-Felder (Preis > 0, Währung Pflicht
 * sobald ein Preis gesetzt ist). Separat statt via zod `.refine`, damit
 * `updatePlaceSchema` weiterhin per `.extend` auf `placeInputSchema` aufbauen
 * kann (refine würde das ZodObject in ZodEffects verpacken).
 */
function priceFieldsError(
  data: {
    electricityPricePerKwh: string | null;
    electricityPriceCurrency: string | null;
  },
  t: Translator,
): string | null {
  if (data.electricityPricePerKwh == null) return null;
  if (Number(data.electricityPricePerKwh) <= 0) {
    return t("errors.priceMustBePositive");
  }
  if (data.electricityPriceCurrency == null) {
    return t("errors.currencyRequired");
  }
  return null;
}

/**
 * Rechnet die 'auto'-Ladekosten aller Sessions eines Orts nach einer
 * Preisänderung neu (gleiche Formel wie der Worker, siehe
 * packages/core/src/charging/cost.ts). Nur 'auto'-markierte Sessions werden
 * angefasst — 'manual'/'synced' bleiben unberührt (user-owned-Konvention).
 * Preis entfernt (price === null) setzt cost/currency/costSource der
 * 'auto'-Sessions zurück auf NULL; Neuzuordnung frisch gematchter Sessions
 * ohne bisherigen Kostenwert übernimmt der nächste Worker-Sync-Zyklus.
 */
async function recomputeAutoChargeCostsForPlace(
  placeId: number,
  price: string | null,
  currency: string | null,
): Promise<void> {
  if (price == null || currency == null) {
    return;
  }

  const priceNum = Number(price);
  const sessions = await db
    .select({
      id: chargeSessions.id,
      energyAddedKwh: chargeSessions.energyAddedKwh,
      cost: chargeSessions.cost,
      currency: chargeSessions.currency,
    })
    .from(chargeSessions)
    .where(and(eq(chargeSessions.placeId, placeId), eq(chargeSessions.costSource, "auto")));

  for (const session of sessions) {
    if (session.energyAddedKwh == null) continue;
    const newCost = computeAutoChargeCost(session.energyAddedKwh, priceNum).toFixed(2);
    if (session.cost === newCost && session.currency === currency) continue; // idempotent
    await db
      .update(chargeSessions)
      .set({ cost: newCost, currency, updatedAt: new Date() })
      .where(eq(chargeSessions.id, session.id));
  }
}

/**
 * Self-heals stale auto costs after place rematches/deletions: an 'auto' cost is
 * only valid while the session currently belongs to a place with a complete
 * electricity price.
 */
async function resetStaleAutoChargeCosts(): Promise<void> {
  const staleSessions = await db
    .select({ id: chargeSessions.id })
    .from(chargeSessions)
    .leftJoin(places, eq(chargeSessions.placeId, places.id))
    .where(
      and(
        eq(chargeSessions.costSource, "auto"),
        or(
          isNull(chargeSessions.placeId),
          isNull(places.electricityPricePerKwh),
          isNull(places.electricityPriceCurrency),
        ),
      ),
    );

  for (const session of staleSessions) {
    await db
      .update(chargeSessions)
      .set({ cost: null, currency: null, costSource: null, updatedAt: new Date() })
      .where(eq(chargeSessions.id, session.id));
  }
}

export interface PlaceFormResult {
  ok: boolean;
  error?: string;
  placeId?: number;
}

function nullableString(value: FormDataEntryValue | null): string | null {
  if (value == null) return null;
  const str = String(value).trim();
  return str === "" ? null : str;
}

function parsePlaceForm(schema: ReturnType<typeof buildPlaceInputSchema>, formData: FormData) {
  return schema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    lat: Number(formData.get("lat")),
    lon: Number(formData.get("lon")),
    radiusM: Number(formData.get("radiusM")),
    address: nullableString(formData.get("address")),
    electricityPricePerKwh: nullableString(formData.get("electricityPricePerKwh")),
    electricityPriceCurrency: nullableString(formData.get("electricityPriceCurrency")),
  });
}

function revalidatePlacePaths() {
  revalidatePath("/places");
  revalidatePath("/day/[date]", "page");
  revalidatePath("/drives/[id]", "page");
}

/**
 * Creates a place, then synchronously rematches all unlocked drive/charge/park
 * place assignments (the new place may now be the best match for existing
 * coordinates).
 */
export async function createPlace(
  _prev: PlaceFormResult,
  formData: FormData,
): Promise<PlaceFormResult> {
  const t = await getTranslations("places");
  const user = await validateSession();
  if (!user) return { ok: false, error: t("errors.notAuthenticated") };

  const parsed = parsePlaceForm(buildPlaceInputSchema(t), formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? t("errors.invalidInput") };
  }
  const priceError = priceFieldsError(parsed.data, t);
  if (priceError) return { ok: false, error: priceError };

  // Preis ohne Währung (oder umgekehrt) kann durch priceFieldsError nicht
  // vorkommen — hier nur der Fall "kein Preis => Währung immer null" normalisiert.
  const electricityPriceCurrency =
    parsed.data.electricityPricePerKwh == null ? null : parsed.data.electricityPriceCurrency;

  const inserted = await db
    .insert(places)
    .values({ ...parsed.data, electricityPriceCurrency, source: "user" })
    .returning({ id: places.id });
  const placeId = inserted[0]?.id;

  if (placeId != null && parsed.data.electricityPricePerKwh != null) {
    await db.insert(auditLog).values([
      {
        entityType: "place",
        entityId: placeId,
        field: "electricity_price_per_kwh",
        oldValue: null,
        newValue: parsed.data.electricityPricePerKwh,
        changedBy: user.username,
      },
      {
        entityType: "place",
        entityId: placeId,
        field: "electricity_price_currency",
        oldValue: null,
        newValue: electricityPriceCurrency,
        changedBy: user.username,
      },
    ]);
  }

  await rematchAllPlaces(db);
  await resetStaleAutoChargeCosts();
  if (placeId != null) {
    await recomputeAutoChargeCostsForPlace(
      placeId,
      parsed.data.electricityPricePerKwh,
      electricityPriceCurrency,
    );
  }
  revalidatePlacePaths();

  return { ok: true, placeId };
}

function buildUpdatePlaceSchema(t: Translator) {
  return buildPlaceInputSchema(t).extend({
    id: z.number().int().positive(),
  });
}

/**
 * Updates a place, then synchronously rematches all unlocked place
 * assignments (radius/coordinate changes can gain or lose matches).
 */
export async function updatePlace(
  _prev: PlaceFormResult,
  formData: FormData,
): Promise<PlaceFormResult> {
  const t = await getTranslations("places");
  const user = await validateSession();
  if (!user) return { ok: false, error: t("errors.notAuthenticated") };

  const parsed = buildUpdatePlaceSchema(t).safeParse({
    id: Number(formData.get("id")),
    name: formData.get("name"),
    type: formData.get("type"),
    lat: Number(formData.get("lat")),
    lon: Number(formData.get("lon")),
    radiusM: Number(formData.get("radiusM")),
    address: nullableString(formData.get("address")),
    electricityPricePerKwh: nullableString(formData.get("electricityPricePerKwh")),
    electricityPriceCurrency: nullableString(formData.get("electricityPriceCurrency")),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? t("errors.invalidInput") };
  }
  const priceError = priceFieldsError(parsed.data, t);
  if (priceError) return { ok: false, error: priceError };

  const { id, ...values } = parsed.data;
  // Preis ohne Währung (oder umgekehrt) kann durch priceFieldsError nicht
  // vorkommen — hier nur der Fall "kein Preis => Währung immer null" normalisiert.
  const electricityPriceCurrency =
    values.electricityPricePerKwh == null ? null : values.electricityPriceCurrency;

  const existing = await db
    .select({
      id: places.id,
      electricityPricePerKwh: places.electricityPricePerKwh,
      electricityPriceCurrency: places.electricityPriceCurrency,
    })
    .from(places)
    .where(eq(places.id, id))
    .limit(1);
  const current = existing[0];
  if (!current) return { ok: false, error: t("errors.placeNotFound") };

  await db
    .update(places)
    .set({ ...values, electricityPriceCurrency, updatedAt: new Date() })
    .where(eq(places.id, id));

  // Numerischer Vergleich statt String-Gleichheit — die DB liefert den Preis
  // mit fester Skala (z.B. "0.3200"), das Formular typischerweise "0.32".
  const currentPriceNum =
    current.electricityPricePerKwh != null ? Number(current.electricityPricePerKwh) : null;
  const nextPriceNum =
    values.electricityPricePerKwh != null ? Number(values.electricityPricePerKwh) : null;

  const priceChanges: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];
  if (currentPriceNum !== nextPriceNum) {
    priceChanges.push({
      field: "electricity_price_per_kwh",
      oldValue: current.electricityPricePerKwh,
      newValue: values.electricityPricePerKwh,
    });
  }
  if (current.electricityPriceCurrency !== electricityPriceCurrency) {
    priceChanges.push({
      field: "electricity_price_currency",
      oldValue: current.electricityPriceCurrency,
      newValue: electricityPriceCurrency,
    });
  }
  if (priceChanges.length > 0) {
    await db.insert(auditLog).values(
      priceChanges.map((c) => ({
        entityType: "place",
        entityId: id,
        ...c,
        changedBy: user.username,
      })),
    );
  }

  await rematchAllPlaces(db);
  await resetStaleAutoChargeCosts();
  await recomputeAutoChargeCostsForPlace(id, values.electricityPricePerKwh, electricityPriceCurrency);
  revalidatePlacePaths();

  return { ok: true, placeId: id };
}

export interface AddressSearchResult {
  label: string;
  lat: number;
  lon: number;
}

const NOMINATIM_USER_AGENT =
  "Tripatlas/0.1 (self-hosted, github.com/jsc2304/tripatlas)";

/**
 * Builds a short, human-friendly address label from Nominatim's structured
 * `address` details (road + house number, city), falling back to the raw
 * `display_name` when the structured fields are missing.
 */
function shortLabel(item: {
  display_name: string;
  address?: Record<string, string | undefined>;
}): string {
  const a = item.address;
  if (!a) return item.display_name;

  const street = [a.road, a.house_number].filter(Boolean).join(" ");
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? "";
  const label = [street, city].filter((part) => part && part.length > 0).join(", ");
  return label !== "" ? label : item.display_name;
}

/**
 * Server-side address search against the public Nominatim (OSM) API. Kept
 * server-side to (a) send the User-Agent Nominatim's usage policy requires,
 * (b) avoid CORS, and (c) keep client IPs from being sent to a third party
 * directly (see docs/vision.md §19.3 — no unnecessary third parties; OSM/
 * Nominatim is the accepted compromise for address search/reverse geocoding).
 * Fails soft: any network/parse error yields an empty result list.
 */
export async function searchAddress(query: string): Promise<AddressSearchResult[]> {
  const user = await validateSession();
  if (!user) return [];

  const q = query.trim();
  if (q.length < 3) return [];

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "5");
    url.searchParams.set("accept-language", "de");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("q", q);

    const res = await fetch(url, {
      headers: { "User-Agent": NOMINATIM_USER_AGENT },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];

    const data: unknown = await res.json();
    if (!Array.isArray(data)) return [];

    return data
      .map((item): AddressSearchResult | null => {
        if (
          typeof item !== "object" ||
          item === null ||
          typeof (item as { display_name?: unknown }).display_name !== "string" ||
          typeof (item as { lat?: unknown }).lat !== "string" ||
          typeof (item as { lon?: unknown }).lon !== "string"
        ) {
          return null;
        }
        const rec = item as {
          display_name: string;
          lat: string;
          lon: string;
          address?: Record<string, string | undefined>;
        };
        const lat = Number(rec.lat);
        const lon = Number(rec.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return { label: shortLabel(rec), lat, lon };
      })
      .filter((r): r is AddressSearchResult => r !== null);
  } catch {
    return [];
  }
}

const deletePlaceSchema = z.object({ id: z.number().int().positive() });

/**
 * Deletes a place. FK columns (drives/charges/parks *_place_id) are ON DELETE
 * SET NULL, so references become null automatically. Rematch afterwards so a
 * bigger overlapping place can pick up the now-unmatched coordinates.
 */
export async function deletePlace(id: number): Promise<void> {
  const t = await getTranslations("places");
  const user = await validateSession();
  if (!user) throw new Error(t("errors.notAuthenticated"));

  const parsed = deletePlaceSchema.parse({ id });

  await db.delete(places).where(eq(places.id, parsed.id));

  await rematchAllPlaces(db);
  await resetStaleAutoChargeCosts();
  revalidatePlacePaths();
}
