"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { deleteJourney } from "../../../../lib/actions/journeys";
import { buttonClasses } from "../../../../components/ui/Button";

export function DeleteJourneyButton({
  journeyId,
  name,
}: {
  journeyId: number;
  name: string;
}) {
  const t = useTranslations("journeys");
  const tCommon = useTranslations("common");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!window.confirm(t("deleteConfirm", { name }))) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteJourney(journeyId);
      } catch (err) {
        // redirect() wirft intern NEXT_REDIRECT — nicht als Fehler behandeln.
        if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) return;
        setError(err instanceof Error ? err.message : t("deleteError"));
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        className={buttonClasses("destructive", "sm")}
      >
        {tCommon("actions.delete")}
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
