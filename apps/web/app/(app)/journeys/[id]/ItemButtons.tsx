"use client";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { addItem, removeItem } from "../../../../lib/actions/journeys";
import { buttonClasses } from "../../../../components/ui/Button";

type ItemType = "drive" | "charge" | "park";

export function RemoveItemButton({
  journeyId,
  itemType,
  itemId,
}: {
  journeyId: number;
  itemType: ItemType;
  itemId: number;
}) {
  const t = useTranslations("journeys");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              await removeItem(journeyId, itemType, itemId);
            } catch (err) {
              setError(err instanceof Error ? err.message : t("itemError"));
            }
          })
        }
        className={buttonClasses("destructive", "sm", "shrink-0 border-transparent px-2 py-1")}
      >
        {pending ? "…" : t("detail.remove")}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-700 dark:text-red-300">
          {error}
        </span>
      )}
    </>
  );
}

export function AddItemButton({
  journeyId,
  itemType,
  itemId,
}: {
  journeyId: number;
  itemType: ItemType;
  itemId: number;
}) {
  const t = useTranslations("journeys");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={pending}
        aria-label={t("detail.addAriaLabel")}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              await addItem(journeyId, itemType, itemId);
            } catch (err) {
              setError(err instanceof Error ? err.message : t("itemError"));
            }
          })
        }
        className={buttonClasses("secondary", "sm", "shrink-0")}
      >
        {pending ? "…" : <><Plus aria-hidden size={14} /> {t("detail.add")}</>}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-700 dark:text-red-300">
          {error}
        </span>
      )}
    </>
  );
}
