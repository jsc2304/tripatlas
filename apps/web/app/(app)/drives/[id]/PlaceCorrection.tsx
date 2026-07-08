"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { formatPlaceLabel } from "@tripatlas/core";
import { setDrivePlace } from "../../../../lib/actions/drives";
import type { PlaceLite } from "../../../../lib/queries";

const AUTO_VALUE = "auto";

interface RowProps {
  driveId: number;
  which: "start" | "end";
  label: string;
  placeId: number | null;
  placeName: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
  locked: boolean;
  allPlaces: PlaceLite[];
}

function CorrectionRow({
  driveId,
  which,
  label,
  placeId,
  placeName,
  address,
  lat,
  lon,
  locked,
  allPlaces,
}: RowProps) {
  const t = useTranslations("drives");
  const [currentPlaceId, setCurrentPlaceId] = useState(placeId);
  const [currentLocked, setCurrentLocked] = useState(locked);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const resolvedLabel = formatPlaceLabel(placeName, address, lat, lon);
  const selectValue = currentPlaceId != null ? String(currentPlaceId) : AUTO_VALUE;

  function handleChange(value: string) {
    setError(null);
    const nextPlaceId = value === AUTO_VALUE ? null : Number(value);
    const prevPlaceId = currentPlaceId;
    const prevLocked = currentLocked;

    setCurrentPlaceId(nextPlaceId);
    setCurrentLocked(nextPlaceId !== null);

    startTransition(async () => {
      try {
        await setDrivePlace(driveId, which, nextPlaceId);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("placeCorrection.errorSaving"));
        setCurrentPlaceId(prevPlaceId);
        setCurrentLocked(prevLocked);
      }
    });
  }

  const createHref =
    lat != null && lon != null
      ? `/places/new?lat=${lat}&lon=${lon}${address ? `&name=${encodeURIComponent(address)}` : ""}`
      : null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {label}
        </span>
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          {resolvedLabel}
          {currentLocked && (
            <span
              title={t("placeCorrection.manuallyAssigned")}
              className="ml-1.5 inline-block align-text-top"
            >
              <Lock aria-label={t("placeCorrection.manuallyAssigned")} size={12} />
            </span>
          )}
        </span>
      </div>

      <select
        value={selectValue}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-900 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
      >
        <option value={AUTO_VALUE}>{t("placeCorrection.auto")}</option>
        {allPlaces.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      {createHref && (
        <Link
          href={createHref}
          className="self-start text-xs text-neutral-500 hover:text-neutral-900 hover:underline dark:text-neutral-400 dark:hover:text-white"
        >
          {t("placeCorrection.createFromCoords")}
        </Link>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

export function PlaceCorrection({
  driveId,
  start,
  end,
  allPlaces,
}: {
  driveId: number;
  start: {
    placeId: number | null;
    placeName: string | null;
    address: string | null;
    lat: number | null;
    lon: number | null;
    locked: boolean;
  };
  end: {
    placeId: number | null;
    placeName: string | null;
    address: string | null;
    lat: number | null;
    lon: number | null;
    locked: boolean;
  };
  allPlaces: PlaceLite[];
}) {
  const t = useTranslations("drives");
  return (
    <div className="flex flex-col gap-5">
      <CorrectionRow
        driveId={driveId}
        which="start"
        label={t("placeCorrection.start")}
        allPlaces={allPlaces}
        {...start}
      />
      <CorrectionRow
        driveId={driveId}
        which="end"
        label={t("placeCorrection.destination")}
        allPlaces={allPlaces}
        {...end}
      />
    </div>
  );
}
