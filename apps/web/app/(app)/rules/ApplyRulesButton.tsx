"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Wand2 } from "lucide-react";
import { applyRulesNow } from "../../../lib/actions/rules";
import { buttonClasses } from "../../../components/ui/Button";

export function ApplyRulesButton({ liveUnclassified }: { liveUnclassified: number }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("rules");

  function trigger() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const { applied } = await applyRulesNow();
        setResult(
          applied === 0
            ? t("applyButton.none")
            : t("applyButton.applied", { count: applied }),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : t("applyButton.error"));
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={trigger}
          disabled={pending}
          className={buttonClasses("primary", "md")}
        >
          <Wand2 aria-hidden size={16} />
          {pending ? t("applyButton.pending") : t("applyButton.label")}
        </button>
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          {t("applyButton.open", { count: liveUnclassified })}
        </span>
      </div>
      {result && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">{result}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
