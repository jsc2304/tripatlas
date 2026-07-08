import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { getAllPlacesWithUsage, getPlaceById } from "../../../../../lib/queries";
import { PlaceForm } from "../../PlaceForm";
import { DeletePlaceButton } from "../../DeletePlaceButton";

export const dynamic = "force-dynamic";

export default async function EditPlacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("places");
  const tCommon = await getTranslations("common");
  const { id } = await params;
  const placeId = Number(id);
  if (!Number.isInteger(placeId) || placeId <= 0) notFound();

  const place = await getPlaceById(placeId);
  if (!place) notFound();

  const allWithUsage = await getAllPlacesWithUsage();
  const usage = allWithUsage.find((p) => p.id === placeId);
  const usageCount = usage
    ? usage.driveStartCount + usage.driveEndCount + usage.chargeCount + usage.parkCount
    : 0;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/places"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
      >
        <ChevronLeft aria-hidden size={16} />
        {tCommon("actions.back")}
      </Link>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight">
        {t("editTitle", { name: place.name })}
      </h1>

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <PlaceForm
          initial={{
            id: place.id,
            name: place.name,
            type: place.type,
            lat: place.lat,
            lon: place.lon,
            radiusM: place.radiusM,
            address: place.address,
            electricityPricePerKwh: place.electricityPricePerKwh,
            electricityPriceCurrency: place.electricityPriceCurrency,
          }}
        />
      </div>

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {t("dangerZone.title")}
        </h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {t("dangerZone.usage", { count: usageCount })}
        </p>
        <div className="mt-3">
          <DeletePlaceButton
            placeId={place.id}
            placeName={place.name}
            usageCount={usageCount}
          />
        </div>
      </div>
    </div>
  );
}
