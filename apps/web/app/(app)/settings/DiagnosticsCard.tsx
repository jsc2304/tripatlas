import { getLocale, getTranslations } from "next-intl/server";
import { CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";
import { formatRelativeTime } from "../../../lib/day";
import {
  getDiagnostics,
  diagnosticsHints,
  entityLabel,
  buildEntityLabels,
  type SyncHealth,
} from "../../../lib/diagnostics";
import { TeslamateTestButton } from "./TeslamateTestButton";

type HealthBadgeConfig = Record<SyncHealth, { classes: string }>;

const HEALTH_BADGE: HealthBadgeConfig = {
  fresh: {
    classes: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  aging: {
    classes: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  stale: {
    classes: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  },
  never: {
    classes: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  },
};

/**
 * Diagnose-Card oben in den Settings: Tripatlas-DB-Erreichbarkeit, Alter des
 * letzten erfolgreichen Syncs je sync_state-Entity (Ampel grün/gelb/rot),
 * Klartext-Hinweise bei typischen Fehlerbildern, und ein optionaler
 * TeslaMate-Direkttest (nur falls TESLAMATE_DATABASE_URL im Web-Container
 * gesetzt ist).
 */
export async function DiagnosticsCard() {
  const [t, locale] = await Promise.all([
    getTranslations("settings"),
    getLocale(),
  ]);
  const summary = await getDiagnostics();
  const hints = diagnosticsHints(summary, t);
  const entityLabels = buildEntityLabels(t);
  const badgeLabels: Record<SyncHealth, string> = {
    fresh: t("diagnostics.badges.fresh"),
    aging: t("diagnostics.badges.aging"),
    stale: t("diagnostics.badges.stale"),
    never: t("diagnostics.badges.never"),
  };

  return (
    <section
      id="diagnose"
      className="mt-6 scroll-mt-6 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        {t("diagnostics.title")}
      </h2>

      <div className="mt-3 flex flex-col gap-4">
        <div className="flex items-center gap-2 text-sm">
          {summary.tripatlasDbOk ? (
            <CheckCircle2
              aria-hidden
              size={16}
              className="shrink-0 text-emerald-600 dark:text-emerald-400"
            />
          ) : (
            <XCircle aria-hidden size={16} className="shrink-0 text-red-600 dark:text-red-400" />
          )}
          <span className="font-medium text-neutral-900 dark:text-neutral-100">
            {t("diagnostics.db")}
          </span>
          <span className="text-neutral-500 dark:text-neutral-400">
            {summary.tripatlasDbOk
              ? t("diagnostics.dbReachable")
              : (summary.tripatlasDbError ?? t("diagnostics.dbUnreachableFallback"))}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {t("diagnostics.workerSync")}
          </p>
          {summary.entities.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {t("diagnostics.empty")}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {summary.entities.map((e) => {
                const badge = HEALTH_BADGE[e.health];
                return (
                  <li key={`${e.source}-${e.entity}`} className="text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-neutral-900 dark:text-neutral-100">
                        {entityLabel(e.source, e.entity, entityLabels)}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.classes}`}
                      >
                        {badgeLabels[e.health]}
                      </span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        {e.lastSuccessAt
                          ? t("diagnostics.lastSuccess", {
                              time: formatRelativeTime(e.lastSuccessAt, locale),
                            })
                          : t("diagnostics.neverSuccessful")}
                      </span>
                    </div>
                    {e.lastStatus === "error" && e.lastError && (
                      <p className="mt-1 flex items-start gap-1.5 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
                        <AlertTriangle aria-hidden size={14} className="mt-0.5 shrink-0" />
                        <span className="break-words">{e.lastError}</span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {hints.length > 0 && (
          <div className="flex flex-col gap-1.5 rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-950">
            {hints.map((hint) => (
              <p
                key={hint}
                className="flex items-start gap-1.5 text-xs text-amber-900 dark:text-amber-200"
              >
                <Info aria-hidden size={14} className="mt-0.5 shrink-0" />
                <span>{hint}</span>
              </p>
            ))}
          </div>
        )}

        <div className="border-t border-neutral-100 pt-3 dark:border-neutral-800">
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {t("diagnostics.teslamateTest.title")}
          </p>
          {summary.teslamateEnvSet ? (
            <>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {t("diagnostics.teslamateTest.description")}
              </p>
              <div className="mt-2">
                <TeslamateTestButton />
              </div>
            </>
          ) : (
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {t("diagnostics.teslamateTest.envNotSet")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
