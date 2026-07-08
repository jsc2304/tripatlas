"use client";
import { useActionState, useRef } from "react";
import { useTranslations } from "next-intl";
import { createTag, type TagFormResult } from "../../../lib/actions/tags";
import { TAG_COLOR_PRESETS } from "../../../lib/tagColors";
import { buttonClasses } from "../../../components/ui/Button";

const initialState: TagFormResult = { ok: false };

export function CreateTagForm() {
  const t = useTranslations("tags");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (prev: TagFormResult, formData: FormData) => {
      const result = await createTag(prev, formData);
      if (result.ok) formRef.current?.reset();
      return result;
    },
    initialState,
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-1 min-w-[10rem] flex-col gap-1.5">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t("form.name")}
          </span>
          <input
            type="text"
            name="name"
            required
            maxLength={100}
            placeholder={t("form.namePlaceholder")}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
          />
        </label>

        <label className="flex flex-1 min-w-[10rem] flex-col gap-1.5">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t("form.category")}
          </span>
          <input
            type="text"
            name="category"
            maxLength={100}
            placeholder={t("form.categoryPlaceholder")}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
          />
        </label>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t("form.color")}
          </legend>
          <div className="flex gap-1.5">
            {TAG_COLOR_PRESETS.map((color, i) => (
              <label key={color} className="cursor-pointer">
                <input
                  type="radio"
                  name="color"
                  value={color}
                  defaultChecked={i === 0}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className="block h-6 w-6 rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-neutral-900 dark:peer-checked:ring-white"
                  style={{ backgroundColor: color }}
                />
              </label>
            ))}
          </div>
        </fieldset>

        <button type="submit" disabled={pending} className={buttonClasses("primary", "md")}>
          {pending ? t("form.submitting") : t("form.submit")}
        </button>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {state.error}
        </p>
      )}
    </form>
  );
}
