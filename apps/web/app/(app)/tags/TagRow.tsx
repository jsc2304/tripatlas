"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  deleteTag,
  renameTag,
  setTagCategory,
  setTagColor,
} from "../../../lib/actions/tags";
import { TAG_COLOR_PRESETS } from "../../../lib/tagColors";
import type { TagWithUsage } from "../../../lib/queries";
import { buttonClasses } from "../../../components/ui/Button";

export function TagRow({ tag }: { tag: TagWithUsage }) {
  const t = useTranslations("tags");
  const tCommon = useTranslations("common");
  const [name, setName] = useState(tag.name);
  const [category, setCategory] = useState(tag.category ?? "");
  const [color, setColor] = useState(tag.color ?? TAG_COLOR_PRESETS[0]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);

  if (deleted) return null;

  function saveName() {
    const trimmed = name.trim();
    if (trimmed === "" || trimmed === tag.name) {
      setName(tag.name);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await renameTag(tag.id, trimmed);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("errors.renameFailed"));
        setName(tag.name);
      }
    });
  }

  function saveCategory() {
    const trimmed = category.trim();
    if (trimmed === (tag.category ?? "")) return;
    setError(null);
    startTransition(async () => {
      try {
        await setTagCategory(tag.id, trimmed === "" ? null : trimmed);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("errors.saveFailed"));
      }
    });
  }

  function pickColor(next: string) {
    setColor(next);
    setError(null);
    startTransition(async () => {
      try {
        await setTagColor(tag.id, next);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("errors.saveFailed"));
        setColor(tag.color ?? TAG_COLOR_PRESETS[0]);
      }
    });
  }

  function handleDelete() {
    const usage = tag.driveCount + tag.chargeCount;
    const confirmMsg =
      usage > 0
        ? t("deleteConfirm.withUsage", { name: tag.name, count: usage })
        : t("deleteConfirm.simple", { name: tag.name });
    if (!window.confirm(confirmMsg)) return;

    setError(null);
    startTransition(async () => {
      try {
        await deleteTag(tag.id);
        setDeleted(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("errors.deleteFailed"));
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 border-b border-neutral-200 py-3 last:border-0 dark:border-neutral-800">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          {TAG_COLOR_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-label={t("row.colorAriaLabel", { color: preset })}
              disabled={pending}
              onClick={() => pickColor(preset)}
              className={`h-5 w-5 rounded-full transition ${
                color.toLowerCase() === preset.toLowerCase()
                  ? "ring-2 ring-neutral-900 ring-offset-2 dark:ring-white"
                  : ""
              }`}
              style={{ backgroundColor: preset }}
            />
          ))}
        </div>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          disabled={pending}
          className="min-w-[8rem] flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-base font-medium text-neutral-900 outline-none hover:border-neutral-300 focus:border-neutral-900 dark:text-neutral-100 dark:hover:border-neutral-700 dark:focus:border-neutral-100"
        />

        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          onBlur={saveCategory}
          disabled={pending}
          placeholder={t("row.categoryPlaceholder")}
          className="w-32 rounded-lg border border-transparent bg-transparent px-2 py-1 text-base text-neutral-500 outline-none hover:border-neutral-300 focus:border-neutral-900 dark:text-neutral-400 dark:hover:border-neutral-700 dark:focus:border-neutral-100"
        />

        <span className="text-sm tabular-nums text-neutral-500 dark:text-neutral-400">
          {t("row.usage", { driveCount: tag.driveCount, chargeCount: tag.chargeCount })}
        </span>

        <button
          type="button"
          disabled={pending}
          onClick={handleDelete}
          className={buttonClasses("destructive", "sm", "ml-auto border-transparent")}
        >
          {tCommon("actions.delete")}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
