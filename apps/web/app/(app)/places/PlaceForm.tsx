"use client";
import { useActionState, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createPlace,
  updatePlace,
  type PlaceFormResult,
} from "../../../lib/actions/places";
import {
  DEFAULT_RADIUS_M,
  MAX_RADIUS_M,
  MIN_RADIUS_M,
  PLACE_TYPE_OPTIONS,
  type PlaceType,
} from "../../../lib/places";
import { buttonClasses } from "../../../components/ui/Button";
import { AddressSearch } from "./AddressSearch";

// Leaflet touches window/document at import time, so the map must never be
// part of the server-rendered bundle.
const PlaceMap = dynamic(
  () => import("./PlaceMap").then((m) => m.PlaceMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-80 w-full animate-pulse rounded-lg border border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800" />
    ),
  },
);

// Coordinate inputs use step="0.000001" (6 decimals); native number-input
// validation silently blocks submission if the value has more precision
// than that (e.g. raw Leaflet click coordinates), so round at every entry
// point that can produce extra digits.
function roundCoord(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

const fieldClasses =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100";

const initialState: PlaceFormResult = { ok: false };

export interface PlaceFormValues {
  id?: number;
  name: string;
  type: PlaceType;
  lat: number;
  lon: number;
  radiusM: number;
  address: string | null;
  electricityPricePerKwh?: string | null;
  electricityPriceCurrency?: string | null;
}

export function PlaceForm({
  initial,
}: {
  initial?: PlaceFormValues;
}) {
  const t = useTranslations("places");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const isEdit = initial?.id != null;
  const action = isEdit ? updatePlace : createPlace;

  const [state, formAction, pending] = useActionState(
    async (prev: PlaceFormResult, formData: FormData) => {
      const result = await action(prev, formData);
      if (result.ok) router.push("/places");
      return result;
    },
    initialState,
  );

  const [radius, setRadius] = useState(initial?.radiusM ?? DEFAULT_RADIUS_M);
  const [lat, setLat] = useState<number | null>(initial?.lat ?? null);
  const [lon, setLon] = useState<number | null>(initial?.lon ?? null);
  const [address, setAddress] = useState(initial?.address ?? "");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {isEdit && <input type="hidden" name="id" value={initial!.id} />}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t("form.name")}
        </span>
        <input
          type="text"
          name="name"
          required
          maxLength={200}
          defaultValue={initial?.name ?? ""}
          placeholder={t("form.namePlaceholder")}
          className={fieldClasses}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t("form.type")}
        </span>
        <select
          name="type"
          defaultValue={initial?.type ?? "other"}
          className={fieldClasses}
        >
          {PLACE_TYPE_OPTIONS.map((pt) => (
            <option key={pt} value={pt}>
              {t(`placeTypes.${pt}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t("form.searchAddress")}
        </span>
        <AddressSearch
          onSelect={(result) => {
            setLat(roundCoord(result.lat));
            setLon(roundCoord(result.lon));
            setAddress(result.label);
          }}
        />
        <span className="text-xs text-neutral-400 dark:text-neutral-500">
          {t("form.searchAddressHint")}
        </span>
      </label>

      <PlaceMap
        lat={lat}
        lon={lon}
        radiusM={radius}
        onChange={(newLat, newLon) => {
          setLat(roundCoord(newLat));
          setLon(roundCoord(newLon));
        }}
      />
      <p className="-mt-2 text-xs text-neutral-400 dark:text-neutral-500">
        {t("form.mapHint")}{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-neutral-600 dark:hover:text-neutral-300"
        >
          OpenStreetMap contributors
        </a>
      </p>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {t("form.latitude")}
          </span>
          <input
            type="number"
            name="lat"
            required
            step="0.000001"
            min={-90}
            max={90}
            value={lat ?? ""}
            onChange={(e) => setLat(e.target.value === "" ? null : Number(e.target.value))}
            placeholder="47.376900"
            className={`${fieldClasses} py-1.5 font-mono`}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {t("form.longitude")}
          </span>
          <input
            type="number"
            name="lon"
            required
            step="0.000001"
            min={-180}
            max={180}
            value={lon ?? ""}
            onChange={(e) => setLon(e.target.value === "" ? null : Number(e.target.value))}
            placeholder="8.541700"
            className={`${fieldClasses} py-1.5 font-mono`}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="flex items-center justify-between text-sm font-medium text-neutral-700 dark:text-neutral-300">
          <span>{t("form.radius")}</span>
          <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
            {t("form.radiusValue", { radius })}
          </span>
        </span>
        <input
          type="range"
          name="radiusM"
          min={MIN_RADIUS_M}
          max={MAX_RADIUS_M}
          step={5}
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          className="accent-neutral-900 dark:accent-white"
        />
        <span className="flex justify-between text-xs text-neutral-400 dark:text-neutral-500">
          <span>{t("form.radiusValue", { radius: MIN_RADIUS_M })}</span>
          <span>{t("form.radiusValue", { radius: MAX_RADIUS_M })}</span>
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t("form.address")}
        </span>
        <input
          type="text"
          name="address"
          maxLength={500}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={t("form.optionalPlaceholder")}
          className={fieldClasses}
        />
      </label>

      <div className="grid grid-cols-[2fr_1fr] gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t("form.electricityPrice")}
          </span>
          <input
            type="number"
            name="electricityPricePerKwh"
            step="0.0001"
            min={0}
            defaultValue={initial?.electricityPricePerKwh ?? ""}
            placeholder={t("form.optionalPlaceholder")}
            className={fieldClasses}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t("form.currency")}
          </span>
          <input
            type="text"
            name="electricityPriceCurrency"
            maxLength={3}
            defaultValue={initial?.electricityPriceCurrency ?? "EUR"}
            placeholder="EUR"
            className={`${fieldClasses} uppercase`}
          />
        </label>
      </div>
      <p className="-mt-2 text-xs text-neutral-400 dark:text-neutral-500">
        {t("form.electricityPriceHint")}
      </p>

      {state.error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClasses("primary", "md")}>
          {pending ? t("form.submitting") : isEdit ? tCommon("actions.save") : tCommon("actions.create")}
        </button>
      </div>
    </form>
  );
}
