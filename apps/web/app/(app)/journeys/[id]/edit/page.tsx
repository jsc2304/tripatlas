import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getJourneyById } from "../../../../../lib/journeys";
import { toDateTimeLocal } from "../../../../../lib/day";
import { JourneyForm, type JourneyFormValues } from "../../JourneyForm";

export const dynamic = "force-dynamic";

export default async function EditJourneyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("journeys");
  const tCommon = await getTranslations("common");
  const { id } = await params;
  const journeyId = Number(id);
  if (!Number.isInteger(journeyId) || journeyId <= 0) notFound();

  const journey = await getJourneyById(journeyId);
  if (!journey) notFound();

  const initial: JourneyFormValues = {
    id: journey.id,
    name: journey.name,
    type: journey.type,
    startTime: toDateTimeLocal(journey.startTime),
    endTime: toDateTimeLocal(journey.endTime),
    color: journey.color,
    description: journey.description,
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/journeys/${journey.id}`}
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
      >
        <ChevronLeft aria-hidden size={16} />
        {tCommon("actions.back")}
      </Link>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight">
        {t("editTitle")}
      </h1>

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <JourneyForm initial={initial} />
      </div>
    </div>
  );
}
