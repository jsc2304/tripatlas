import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { PlaceForm, type PlaceFormValues } from "../PlaceForm";

export const dynamic = "force-dynamic";

function parseNum(value: string | string[] | undefined): number | undefined {
  if (typeof value !== "string") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export default async function NewPlacePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("places");
  const tCommon = await getTranslations("common");
  const params = await searchParams;
  const lat = parseNum(params.lat);
  const lon = parseNum(params.lon);
  const name = typeof params.name === "string" ? params.name : "";

  const initial: PlaceFormValues | undefined =
    lat != null || lon != null || name !== ""
      ? {
          name,
          type: "other",
          lat: lat ?? 0,
          lon: lon ?? 0,
          radiusM: 100,
          address: null,
        }
      : undefined;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/places"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
      >
        <ChevronLeft aria-hidden size={16} />
        {tCommon("actions.back")}
      </Link>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{t("newPlace")}</h1>

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <PlaceForm initial={initial} />
      </div>
    </div>
  );
}
