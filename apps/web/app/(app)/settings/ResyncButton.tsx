"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { resetSyncWatermarks } from "../../../lib/actions/settings";
import { buttonClasses } from "../../../components/ui/Button";

export function ResyncButton() {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");

  function trigger() {
    setError(null);
    setConfirming(false);
    startTransition(async () => {
      try {
        const result = await resetSyncWatermarks();
        if (result.ok) {
          setHint(t("sync.resyncSuccess"));
        } else {
          setError(result.error ?? t("sync.resyncError"));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t("sync.resyncError"));
      }
    });
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
        <p className="text-amber-900 dark:text-amber-200">
          {t("sync.resyncConfirmMessage")}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={trigger}
            disabled={pending}
            className={buttonClasses(
              "primary",
              "md",
              "!bg-amber-600 hover:!bg-amber-700 dark:!bg-amber-600 dark:hover:!bg-amber-700 !text-white focus-visible:!ring-amber-600",
            )}
          >
            {pending ? t("sync.resyncing") : t("sync.resyncConfirmLabel")}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className={buttonClasses("secondary", "md")}
          >
            {tCommon("actions.cancel")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={pending}
        className={buttonClasses("secondary", "md", "self-start")}
      >
        {t("sync.resyncTrigger")}
      </button>
      {hint && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">{hint}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
