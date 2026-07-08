import { getTranslations } from "next-intl/server";
import { Plus, Wand2 } from "lucide-react";
import {
  getClassificationRules,
  getUnclassifiedLiveCount,
} from "../../../lib/rules";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ApplyRulesButton } from "./ApplyRulesButton";
import { RuleRow } from "./RuleRow";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const t = await getTranslations("rules");
  const [rules, liveUnclassified] = await Promise.all([
    getClassificationRules(),
    getUnclassifiedLiveCount(),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {t("subtitle")}
          </p>
        </div>
        <Button
          href="/rules/new"
          variant="primary"
          className="shrink-0"
          icon={<Plus aria-hidden size={16} />}
        >
          {t("newRule")}
        </Button>
      </div>

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        {t("manualUntouchedNotice")}
      </div>

      <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <ApplyRulesButton liveUnclassified={liveUnclassified} />
      </div>

      <div className="mt-6">
        {rules.length === 0 ? (
          <EmptyState
            icon={Wand2}
            title={t("empty.title")}
            hint={t("empty.hint")}
            action={{
              label: t("newRule"),
              href: "/rules/new",
              icon: <Plus aria-hidden size={16} />,
            }}
          />
        ) : (
          <div className="rounded-xl border border-neutral-200 bg-white px-4 dark:border-neutral-800 dark:bg-neutral-900">
            {rules.map((rule) => (
              <RuleRow key={rule.id} rule={rule} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
