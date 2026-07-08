import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { getRuleById } from "../../../../../lib/rules";
import { getAllPlacesLite, getAllTags } from "../../../../../lib/queries";
import { RuleForm, type RuleFormValues } from "../../RuleForm";

export const dynamic = "force-dynamic";

export default async function EditRulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ruleId = Number(id);
  if (!Number.isInteger(ruleId) || ruleId <= 0) notFound();

  const t = await getTranslations("rules");
  const tCommon = await getTranslations("common");
  const [rule, places, tags] = await Promise.all([
    getRuleById(ruleId),
    getAllPlacesLite(),
    getAllTags(),
  ]);
  if (!rule) notFound();

  // Regel-Klassifizierung als Aktion ist nie 'unclassified' (nur die drei
  // sinnvollen Werte oder null "nicht ändern").
  const classification =
    rule.classification === "private" ||
    rule.classification === "business" ||
    rule.classification === "commute"
      ? rule.classification
      : null;

  const initial: RuleFormValues = {
    id: rule.id,
    name: rule.name,
    priority: rule.priority,
    enabled: rule.enabled,
    startPlaceId: rule.startPlaceId,
    endPlaceId: rule.endPlaceId,
    weekdays: rule.weekdays,
    classification,
    tagId: rule.tagId,
    purpose: rule.purpose,
    customer: rule.customer,
    project: rule.project,
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/rules"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
      >
        <ChevronLeft aria-hidden size={16} />
        {tCommon("actions.back")}
      </Link>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight">
        {t("editTitle")}
      </h1>

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <RuleForm
          initial={initial}
          places={places}
          tags={tags.map((t) => ({ id: t.id, name: t.name }))}
        />
      </div>
    </div>
  );
}
