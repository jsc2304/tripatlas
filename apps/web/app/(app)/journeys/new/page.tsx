import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { JourneyForm } from "../JourneyForm";

export const dynamic = "force-dynamic";

export default async function NewJourneyPage() {
  const t = await getTranslations("journeys");
  const tCommon = await getTranslations("common");
  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/journeys"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
      >
        <ChevronLeft aria-hidden size={16} />
        {tCommon("actions.back")}
      </Link>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{t("list.newJourney")}</h1>

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <JourneyForm />
      </div>
    </div>
  );
}
