"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { deletePlace } from "../../../lib/actions/places";
import { buttonClasses } from "../../../components/ui/Button";

export function DeletePlaceButton({
  placeId,
  placeName,
  usageCount,
}: {
  placeId: number;
  placeName: string;
  usageCount: number;
}) {
  const t = useTranslations("places");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    const confirmMsg =
      usageCount > 0
        ? t("delete.confirmWithUsage", { name: placeName, count: usageCount })
        : t("delete.confirmSimple", { name: placeName });
    if (!window.confirm(confirmMsg)) return;

    setError(null);
    startTransition(async () => {
      try {
        await deletePlace(placeId);
        router.push("/places");
      } catch (err) {
        setError(err instanceof Error ? err.message : t("delete.error"));
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={handleDelete}
        className={buttonClasses("destructive", "sm", "self-start border-transparent")}
      >
        {pending ? t("delete.deleting") : t("delete.button")}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
