"use client";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createRule,
  updateRule,
  type RuleFormResult,
} from "../../../lib/actions/rules";
import type { PlaceLite } from "../../../lib/queries";
import { buttonClasses } from "../../../components/ui/Button";
import { weekdayOptions } from "./labels";

// text-base (16px) verhindert den iOS-Auto-Zoom beim Fokussieren.
const fieldClasses =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100";

const labelText =
  "text-sm font-medium text-neutral-700 dark:text-neutral-300";

const initialState: RuleFormResult = { ok: false };

export interface TagOption {
  id: number;
  name: string;
}

export interface RuleFormValues {
  id?: number;
  name: string;
  priority: number;
  enabled: boolean;
  startPlaceId: number | null;
  endPlaceId: number | null;
  weekdays: number[] | null;
  classification: "private" | "business" | "commute" | null;
  tagId: number | null;
  purpose: string | null;
  customer: string | null;
  project: string | null;
}

export function RuleForm({
  initial,
  places,
  tags,
}: {
  initial?: RuleFormValues;
  places: PlaceLite[];
  tags: TagOption[];
}) {
  const router = useRouter();
  const isEdit = initial?.id != null;
  const action = isEdit ? updateRule : createRule;
  const t = useTranslations("rules");
  const tCommon = useTranslations("common");

  const [state, formAction, pending] = useActionState(
    async (prev: RuleFormResult, formData: FormData) => {
      const result = await action(prev, formData);
      if (result.ok) router.push("/rules");
      return result;
    },
    initialState,
  );

  const selectedWeekdays = new Set(initial?.weekdays ?? []);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {isEdit && <input type="hidden" name="id" value={initial!.id} />}

      <label className="flex flex-col gap-1.5">
        <span className={labelText}>{t("form.name")}</span>
        <input
          type="text"
          name="name"
          required
          maxLength={200}
          defaultValue={initial?.name ?? ""}
          placeholder={t("form.namePlaceholder")}
          className={fieldClasses}
        />
      </label>

      <fieldset className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <legend className="px-1 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          {t("form.conditionsLegend")}
        </legend>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {t("form.conditionsHint")}
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={labelText}>{t("form.startPlace")}</span>
            <select
              name="startPlaceId"
              defaultValue={initial?.startPlaceId ?? ""}
              className={fieldClasses}
            >
              <option value="">{t("form.anyPlace")}</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={labelText}>{t("form.endPlace")}</span>
            <select
              name="endPlaceId"
              defaultValue={initial?.endPlaceId ?? ""}
              className={fieldClasses}
            >
              <option value="">{t("form.anyPlace")}</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="flex flex-col gap-1.5">
          <legend className={labelText}>{t("form.weekdaysLegend")}</legend>
          <div className="flex flex-wrap gap-1.5">
            {weekdayOptions(t).map((wd) => (
              <label key={wd.iso} className="cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="weekdays"
                  value={wd.iso}
                  defaultChecked={selectedWeekdays.has(wd.iso)}
                  className="peer sr-only"
                />
                <span className="block rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 peer-checked:border-neutral-900 peer-checked:bg-neutral-900 peer-checked:text-white dark:border-neutral-700 dark:text-neutral-300 dark:peer-checked:border-white dark:peer-checked:bg-white dark:peer-checked:text-neutral-900">
                  {wd.label}
                </span>
              </label>
            ))}
          </div>
          <span className="text-xs text-neutral-400 dark:text-neutral-500">
            {t("form.weekdaysHint")}
          </span>
        </fieldset>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <legend className="px-1 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          {t("form.actionsLegend")}
        </legend>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {t("form.actionsHint")}
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={labelText}>{t("form.classification")}</span>
            <select
              name="classification"
              defaultValue={initial?.classification ?? ""}
              className={fieldClasses}
            >
              <option value="">{t("form.noChange")}</option>
              <option value="private">{tCommon("classification.private")}</option>
              <option value="business">{tCommon("classification.business")}</option>
              <option value="commute">{tCommon("classification.commute")}</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={labelText}>{t("form.tag")}</span>
            <select
              name="tagId"
              defaultValue={initial?.tagId ?? ""}
              className={fieldClasses}
            >
              <option value="">{t("form.noTag")}</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className={labelText}>{t("form.purpose")}</span>
          <input
            type="text"
            name="purpose"
            maxLength={200}
            defaultValue={initial?.purpose ?? ""}
            placeholder={t("form.optionalPlaceholder")}
            className={fieldClasses}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={labelText}>{t("form.customer")}</span>
            <input
              type="text"
              name="customer"
              maxLength={200}
              defaultValue={initial?.customer ?? ""}
              placeholder={t("form.optionalPlaceholder")}
              className={fieldClasses}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={labelText}>{t("form.project")}</span>
            <input
              type="text"
              name="project"
              maxLength={200}
              defaultValue={initial?.project ?? ""}
              placeholder={t("form.optionalPlaceholder")}
              className={fieldClasses}
            />
          </label>
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={labelText}>{t("form.priority")}</span>
          <input
            type="number"
            name="priority"
            step={1}
            defaultValue={initial?.priority ?? 0}
            className={fieldClasses}
          />
          <span className="text-xs text-neutral-400 dark:text-neutral-500">
            {t("form.priorityHint")}
          </span>
        </label>

        <label className="flex items-center gap-2 self-end pb-2">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={initial?.enabled ?? true}
            className="h-4 w-4 accent-neutral-900 dark:accent-white"
          />
          <span className={labelText}>{t("form.enabled")}</span>
        </label>
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className={buttonClasses("primary", "md")}
        >
          {pending ? t("form.saving") : isEdit ? tCommon("actions.save") : tCommon("actions.create")}
        </button>
        <button
          type="button"
          onClick={() => router.push("/rules")}
          className={buttonClasses("secondary", "md")}
        >
          {tCommon("actions.cancel")}
        </button>
      </div>
    </form>
  );
}
