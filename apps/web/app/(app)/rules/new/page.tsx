import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { getAllPlacesLite, getAllTags } from "../../../../lib/queries";
import { RuleForm } from "../RuleForm";

export const dynamic = "force-dynamic";

export default async function NewRulePage() {
  const t = await getTranslations("rules");
  const tCommon = await getTranslations("common");
  const [places, tags] = await Promise.all([getAllPlacesLite(), getAllTags()]);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/rules"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
      >
        <ChevronLeft aria-hidden size={16} />
        {tCommon("actions.back")}
      </Link>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{t("newTitle")}</h1>

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <RuleForm
          places={places}
          tags={tags.map((t) => ({ id: t.id, name: t.name }))}
        />
      </div>
    </div>
  );
}
