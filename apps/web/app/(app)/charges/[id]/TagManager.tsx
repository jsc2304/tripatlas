"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  assignTagToCharge,
  removeTagFromCharge,
} from "../../../../lib/actions/charges";
import type { TagLite } from "../../../../lib/queries";

export function TagManager({
  chargeSessionId,
  initialTags,
  allTagNames,
}: {
  chargeSessionId: number;
  initialTags: TagLite[];
  allTagNames: string[];
}) {
  const t = useTranslations("charges");
  const [assigned, setAssigned] = useState<TagLite[]>(initialTags);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // After revalidatePath the RSC tree re-renders with fresh props — adopt
  // them so local state never drifts from the DB (e.g. optimistic entries).
  useEffect(() => {
    setAssigned(initialTags);
  }, [initialTags]);

  const assignedNames = useMemo(
    () => new Set(assigned.map((t) => t.name.toLowerCase())),
    [assigned],
  );

  const suggestions = useMemo(() => {
    const q = input.trim().toLowerCase();
    return allTagNames
      .filter((name) => !assignedNames.has(name.toLowerCase()))
      .filter((name) => (q === "" ? true : name.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [input, allTagNames, assignedNames]);

  function addTag(name: string) {
    const trimmed = name.trim();
    if (trimmed === "") return;
    setError(null);
    setInput("");
    startTransition(async () => {
      try {
        const tag = await assignTagToCharge(chargeSessionId, trimmed);
        // Reflect immediately under the REAL tag id (so remove works right
        // away); the RSC refresh from revalidatePath reconciles afterwards.
        setAssigned((prev) =>
          prev.some((t) => t.id === tag.id) ? prev : [...prev, tag],
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : t("tagManager.addError"));
      }
    });
  }

  function removeTag(tag: TagLite) {
    setError(null);
    setAssigned((prev) => prev.filter((t) => t.id !== tag.id));
    startTransition(async () => {
      try {
        await removeTagFromCharge(chargeSessionId, tag.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("tagManager.removeError"));
        setAssigned((prev) =>
          prev.some((t) => t.id === tag.id) ? prev : [...prev, tag],
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {assigned.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("tagManager.none")}
          </p>
        )}
        {assigned.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white py-1 pl-2.5 pr-1.5 text-sm font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
          >
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: tag.color ?? "#a3a3a3" }}
            />
            {tag.name}
            <button
              type="button"
              disabled={pending}
              onClick={() => removeTag(tag)}
              aria-label={t("tagManager.removeTag", { name: tag.name })}
              className="flex h-4 w-4 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-200 hover:text-neutral-700 disabled:opacity-50 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag(input);
            }
          }}
          placeholder={t("tagManager.addPlaceholder")}
          aria-label={t("tagManager.addLabel")}
          disabled={pending}
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-900 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
        />

        {input.trim() !== "" && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-md dark:border-neutral-700 dark:bg-neutral-900">
            {suggestions.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => addTag(name)}
                className="block w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                {name}
              </button>
            ))}
            {!allTagNames.some(
              (n) => n.toLowerCase() === input.trim().toLowerCase(),
            ) && (
              <button
                type="button"
                onClick={() => addTag(input)}
                className="block w-full border-t border-neutral-200 px-3 py-2 text-left text-sm font-medium text-neutral-900 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
              >
                {t("tagManager.createNew", { name: input.trim() })}
              </button>
            )}
          </div>
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
