"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Vehicle } from "../../../lib/queries";

/** Fahrzeug-Umschalter — Pass-through über ?vehicle= (wie Kalender/Tag). */
export function InsightsVehicleSwitcher({
  vehicles,
  current,
}: {
  vehicles: Vehicle[];
  current: number;
}) {
  const router = useRouter();
  const t = useTranslations("insights");
  return (
    <select
      aria-label={t("vehicleSwitcherLabel")}
      value={current}
      onChange={(e) => router.push(`/insights?vehicle=${e.target.value}`)}
      className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
    >
      {vehicles.map((v) => (
        <option key={v.id} value={v.id}>
          {v.displayName}
        </option>
      ))}
    </select>
  );
}
