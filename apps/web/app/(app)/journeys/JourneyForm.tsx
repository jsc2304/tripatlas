"use client";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createJourney,
  updateJourney,
  type JourneyFormResult,
} from "../../../lib/actions/journeys";
import {
  JOURNEY_TYPE_OPTIONS,
  type JourneyType,
} from "../../../lib/journeyTypes";
import { TAG_COLOR_PRESETS } from "../../../lib/tagColors";
import { buttonClasses } from "../../../components/ui/Button";

const fieldClasses =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100";

const initialState: JourneyFormResult = { ok: false };

export interface JourneyFormValues {
  id?: number;
  name: string;
  type: JourneyType;
  /** datetime-local strings (YYYY-MM-DDTHH:mm) in APP_TIMEZONE. */
  startTime: string;
  endTime: string;
  color: string | null;
  description: string | null;
}

export function JourneyForm({ initial }: { initial?: JourneyFormValues }) {
  const t = useTranslations("journeys");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const isEdit = initial?.id != null;
  const action = isEdit ? updateJourney : createJourney;

  const [clientError, setClientError] = useState<string | null>(null);
  const [color, setColor] = useState(initial?.color ?? TAG_COLOR_PRESETS[0]);
  const [startTime, setStartTime] = useState(initial?.startTime ?? "");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "");

  const [state, formAction, pending] = useActionState(
    async (prev: JourneyFormResult, formData: FormData) => {
      // Client-Validierung: von < bis.
      if (startTime !== "" && endTime !== "" && startTime >= endTime) {
        setClientError(t("errors.rangeInvalid"));
        return prev;
      }
      setClientError(null);
      const result = await action(prev, formData);
      if (result.ok && result.journeyId != null) {
        router.push(`/journeys/${result.journeyId}`);
      }
      return result;
    },
    initialState,
  );

  const error = clientError ?? state.error;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {isEdit && <input type="hidden" name="id" value={initial!.id} />}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t("form.name")}
        </span>
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

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t("form.type")}
        </span>
        <select
          name="type"
          defaultValue={initial?.type ?? "other"}
          className={fieldClasses}
        >
          {JOURNEY_TYPE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {t(`type.${option}`)}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t("form.startTime")}
          </span>
          <input
            type="datetime-local"
            name="startTime"
            required
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={fieldClasses}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t("form.endTime")}
          </span>
          <input
            type="datetime-local"
            name="endTime"
            required
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={fieldClasses}
          />
        </label>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t("form.color")}
        </legend>
        <input type="hidden" name="color" value={color} />
        <div className="flex flex-wrap gap-1.5">
          {TAG_COLOR_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-label={t("form.colorAriaLabel", { color: preset })}
              onClick={() => setColor(preset)}
              className={`h-7 w-7 rounded-full transition ${
                color.toLowerCase() === preset.toLowerCase()
                  ? "ring-2 ring-neutral-900 ring-offset-2 dark:ring-white dark:ring-offset-neutral-900"
                  : ""
              }`}
              style={{ backgroundColor: preset }}
            />
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t("form.description")}
        </span>
        <textarea
          name="description"
          maxLength={5000}
          rows={3}
          defaultValue={initial?.description ?? ""}
          placeholder={t("form.descriptionPlaceholder")}
          className={fieldClasses}
        />
      </label>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClasses("primary", "md")}>
          {pending ? t("form.saving") : isEdit ? tCommon("actions.save") : tCommon("actions.create")}
        </button>
      </div>
    </form>
  );
}
