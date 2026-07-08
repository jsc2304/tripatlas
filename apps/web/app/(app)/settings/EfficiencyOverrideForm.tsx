"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  updateEfficiencyOverride,
  type EfficiencyOverrideResult,
} from "../../../lib/actions/settings";
import { buttonClasses } from "../../../components/ui/Button";

const initialState: EfficiencyOverrideResult = { ok: false };

/**
 * Effizienz-Fallback (Wh/km) je Fahrzeug — greift nur, solange TeslaMate die
 * Effizienz noch nicht aus Ladevorgängen gelernt hat (Vision §15.3).
 */
export function EfficiencyOverrideForm({
  vehicleId,
  currentWhPerKm,
  teslaMateHasLearned,
}: {
  vehicleId: number;
  currentWhPerKm: number | null;
  teslaMateHasLearned: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateEfficiencyOverride,
    initialState,
  );
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");

  return (
    <form action={formAction} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
        {t("efficiencyOverride.label")}
        <input
          type="number"
          name="whPerKm"
          min={80}
          max={400}
          step={1}
          defaultValue={currentWhPerKm ?? ""}
          placeholder={t("efficiencyOverride.placeholder")}
          className="w-24 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-right text-sm tabular-nums text-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
        <span className="text-neutral-400">{t("efficiencyOverride.unit")}</span>
      </label>
      <button type="submit" disabled={pending} className={buttonClasses("secondary", "sm")}>
        {pending ? t("efficiencyOverride.saving") : tCommon("actions.save")}
      </button>
      {state.error && (
        <span role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </span>
      )}
      <p className="w-full text-xs text-neutral-500 dark:text-neutral-400">
        {teslaMateHasLearned
          ? t("efficiencyOverride.hintLearned")
          : t("efficiencyOverride.hintNotLearned")}
      </p>
    </form>
  );
}
