import Link from "next/link";
import { Zap } from "lucide-react";
import { getTranslations } from "next-intl/server";
import {
  formatDuration,
  formatKwh,
  formatPlaceLabel,
  formatSoc,
  formatTimeRange,
} from "@tripatlas/core";
import { APP_TIMEZONE } from "../../../lib/config";
import { todayInAppTz } from "../../../lib/day";
import { monthBounds } from "../../../lib/exports/data";
import { isValidMonthParam } from "../../../lib/exports/params";
import { getChargeSessionsInRange, getVehicles } from "../../../lib/queries";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ChargeMonthFilters } from "./ChargeMonthFilters";

export const dynamic = "force-dynamic";

function currentMonthInAppTz(): string {
  return todayInAppTz().slice(0, 7);
}

function formatDateCell(date: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: APP_TIMEZONE,
  }).format(date);
}

const currencyFormatters = new Map<string, Intl.NumberFormat>();
function formatCost(cost: string | null, currency: string | null): string {
  if (cost == null) return "–";
  const cur = currency ?? "CHF";
  let fmt = currencyFormatters.get(cur);
  if (!fmt) {
    fmt = new Intl.NumberFormat("de-DE", { style: "currency", currency: cur });
    currencyFormatters.set(cur, fmt);
  }
  try {
    return fmt.format(Number(cost));
  } catch {
    return `${Number(cost).toFixed(2)} ${cur}`;
  }
}

const CHARGER_BADGE: Record<"ac" | "dc", string> = {
  ac: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  dc: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
};

export default async function ChargesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const t = await getTranslations("charges");
  const sp = await searchParams;
  const month = sp.month && isValidMonthParam(sp.month) ? sp.month : currentMonthInAppTz();

  const vehicles = await getVehicles();
  const vehicleId = vehicles[0]?.id;

  const { start, end } = monthBounds(month);
  const sessions = vehicleId != null ? await getChargeSessionsInRange(vehicleId, start, end) : [];

  const totalEnergy = sessions.reduce((sum, s) => sum + (s.energyAddedKwh ?? 0), 0);
  const costsPresent = sessions.filter((s) => s.cost != null);
  const totalCost = costsPresent.reduce((sum, s) => sum + Number(s.cost), 0);
  const hasCostsMissing = costsPresent.length < sessions.length && sessions.length > 0;
  const acCount = sessions.filter((s) => s.chargerType === "ac").length;
  const dcCount = sessions.filter((s) => s.chargerType === "dc").length;

  // Currency for the total: use the first session's currency, default CHF.
  const totalCurrency = costsPresent[0]?.currency ?? "CHF";

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">{t("page.title")}</h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {t("page.subtitle")}
      </p>

      <div className="mt-6">
        <ChargeMonthFilters month={month} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {t("page.stats.sessions")}
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{sessions.length}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {t("page.stats.energyAdded")}
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{formatKwh(totalEnergy)}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {t("page.stats.totalCost")}
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {costsPresent.length > 0 ? formatCost(String(totalCost), totalCurrency) : "–"}
          </p>
          {hasCostsMissing && (
            <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
              {t("page.stats.costsPartial")}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {t("page.stats.acDc")}
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {acCount} / {dcCount}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {sessions.length === 0 && (
          <EmptyState
            icon={Zap}
            title={t("page.empty.title")}
            hint={t("page.empty.hint")}
          />
        )}
        {sessions.map((s) => {
          const placeLabel = formatPlaceLabel(s.placeName, s.address, s.lat, s.lon);
          return (
            <Link
              key={s.id}
              href={`/charges/${s.id}`}
              className="rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {formatDateCell(s.startTime)} ·{" "}
                    {formatTimeRange(s.startTime, s.endTime, APP_TIMEZONE)}
                  </p>
                  <p className="mt-0.5 truncate font-medium text-neutral-900 dark:text-neutral-100">
                    {placeLabel}
                  </p>
                </div>
                {s.chargerType && (
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium uppercase ${CHARGER_BADGE[s.chargerType]}`}
                  >
                    {s.chargerType}
                  </span>
                )}
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-neutral-500 sm:grid-cols-4 dark:text-neutral-400">
                <div>
                  <dt>{t("page.session.energy")}</dt>
                  <dd className="mt-0.5 font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                    {s.energyAddedKwh != null ? formatKwh(s.energyAddedKwh, { sign: true }) : "–"}
                  </dd>
                </div>
                <div>
                  <dt>{t("page.session.soc")}</dt>
                  <dd className="mt-0.5 font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                    {s.startSoc != null ? formatSoc(s.startSoc) : "–"}
                    {" → "}
                    {s.endSoc != null ? formatSoc(s.endSoc) : "–"}
                  </dd>
                </div>
                <div>
                  <dt>{t("page.session.maxPower")}</dt>
                  <dd className="mt-0.5 font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                    {s.maxPowerKw != null ? `${s.maxPowerKw.toFixed(1)} kW` : "–"}
                  </dd>
                </div>
                <div>
                  <dt>{t("page.session.duration")}</dt>
                  <dd className="mt-0.5 font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                    {s.durationSeconds != null ? formatDuration(s.durationSeconds) : "–"}
                  </dd>
                </div>
              </dl>

              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-neutral-400 dark:text-neutral-500">
                  {t("page.session.cost")}
                </span>
                <span className="text-sm font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                  {formatCost(s.cost, s.currency)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
