"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import {
  deleteRule,
  setRulePriority,
  toggleRule,
} from "../../../lib/actions/rules";
import { CLASSIFICATION_BADGE } from "../../../lib/classification";
import type { ClassificationRuleRow } from "../../../lib/rules";
import { buttonClasses } from "../../../components/ui/Button";
import { describeCondition } from "./labels";

const actionBadge =
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";
const neutralBadge = `${actionBadge} bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300`;

export function RuleRow({ rule }: { rule: ClassificationRuleRow }) {
  const [enabled, setEnabled] = useState(rule.enabled);
  const [priority, setPriority] = useState(rule.priority);
  const [deleted, setDeleted] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("rules");
  const tCommon = useTranslations("common");

  if (deleted) return null;

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    setError(null);
    startTransition(async () => {
      try {
        await toggleRule(rule.id, next);
      } catch (err) {
        setEnabled(!next);
        setError(err instanceof Error ? err.message : t("row.errorToggle"));
      }
    });
  }

  function savePriority() {
    if (priority === rule.priority) return;
    setError(null);
    startTransition(async () => {
      try {
        await setRulePriority(rule.id, priority);
      } catch (err) {
        setPriority(rule.priority);
        setError(err instanceof Error ? err.message : t("row.errorSavePriority"));
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(t("row.deleteConfirm", { name: rule.name }))) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteRule(rule.id);
        setDeleted(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("row.errorDelete"));
      }
    });
  }

  const hasAction =
    rule.classification != null ||
    rule.tagName != null ||
    rule.purpose != null ||
    rule.customer != null ||
    rule.project != null;

  return (
    <div className="flex flex-col gap-3 border-b border-neutral-200 py-4 last:border-0 dark:border-neutral-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`truncate font-medium ${
                enabled
                  ? "text-neutral-900 dark:text-neutral-100"
                  : "text-neutral-400 line-through dark:text-neutral-600"
              }`}
            >
              {rule.name}
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {describeCondition(rule, t, () => tCommon("state.none"))}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            <span>{t("row.priorityLabel")}</span>
            <input
              type="number"
              step={1}
              value={priority}
              disabled={pending}
              onChange={(e) => setPriority(Number(e.target.value))}
              onBlur={savePriority}
              className="w-16 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-base tabular-nums text-neutral-900 outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
            />
          </label>

          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={enabled ? t("row.disableAria") : t("row.enableAria")}
            disabled={pending}
            onClick={handleToggle}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60 ${
              enabled
                ? "bg-neutral-900 dark:bg-white"
                : "bg-neutral-300 dark:bg-neutral-700"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transition dark:bg-neutral-900 ${
                enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>

          <Link
            href={`/rules/${rule.id}/edit`}
            aria-label={t("row.editAria")}
            className={buttonClasses("ghost", "sm")}
          >
            <Pencil aria-hidden size={16} />
          </Link>

          <button
            type="button"
            disabled={pending}
            onClick={handleDelete}
            className={buttonClasses("destructive", "sm", "border-transparent")}
          >
            {tCommon("actions.delete")}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {rule.classification && (
          <span
            className={`${actionBadge} ${CLASSIFICATION_BADGE[rule.classification]}`}
          >
            {tCommon(`classification.${rule.classification}`)}
          </span>
        )}
        {rule.tagName && <span className={neutralBadge}>#{rule.tagName}</span>}
        {rule.purpose && (
          <span className={neutralBadge}>{t("row.purposeBadge", { value: rule.purpose })}</span>
        )}
        {rule.customer && (
          <span className={neutralBadge}>{t("row.customerBadge", { value: rule.customer })}</span>
        )}
        {rule.project && (
          <span className={neutralBadge}>{t("row.projectBadge", { value: rule.project })}</span>
        )}
        {!hasAction && (
          <span className={neutralBadge}>{t("row.noAction")}</span>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
