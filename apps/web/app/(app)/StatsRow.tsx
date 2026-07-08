import Link from "next/link";
import { CalendarDays, CalendarRange, Zap, HelpCircle, ArrowRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { formatKm, formatKwh, formatPlaceLabel } from "@tripatlas/core";
import { formatRelativeTime } from "../../lib/day";
import type {
  LastChargeStats,
  TodayStats,
  UnclassifiedCount,
  WeekStats,
} from "../../lib/dashboard";

function StatCard({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean; className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400">
        <Icon aria-hidden size={13} />
        {label}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export async function StatsRow({
  today,
  week,
  lastCharge,
  unclassifiedCount,
}: {
  today: TodayStats;
  week: WeekStats;
  lastCharge: LastChargeStats | null;
  unclassifiedCount: UnclassifiedCount;
}) {
  const [t, tCommon, locale] = await Promise.all([
    getTranslations("dashboard"),
    getTranslations("common"),
    getLocale(),
  ]);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatCard icon={CalendarDays} label={t("stats.today")}>
        <p className="text-lg font-semibold tabular-nums">{formatKm(today.distanceKm)}</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {t("stats.driveCount", { count: today.driveCount })}
        </p>
      </StatCard>

      <StatCard icon={CalendarRange} label={t("stats.thisWeek")}>
        <p className="text-lg font-semibold tabular-nums">{formatKm(week.distanceKm)}</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {t("stats.driveCount", { count: week.driveCount })}
        </p>
      </StatCard>

      <StatCard icon={Zap} label={t("stats.lastCharge")}>
        {lastCharge ? (
          <>
            <p className="text-lg font-semibold tabular-nums">
              {lastCharge.energyAddedKwh != null
                ? formatKwh(lastCharge.energyAddedKwh, { sign: true })
                : tCommon("state.none")}
            </p>
            <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
              {formatRelativeTime(lastCharge.endTime, locale)}
              {lastCharge.placeName || lastCharge.address
                ? ` · ${formatPlaceLabel(lastCharge.placeName, lastCharge.address, null, null)}`
                : ""}
            </p>
          </>
        ) : (
          <p className="text-sm text-neutral-400">{t("stats.noData")}</p>
        )}
      </StatCard>

      <StatCard icon={HelpCircle} label={t("stats.unclassified")}>
        <p className="text-lg font-semibold tabular-nums">{unclassifiedCount.live}</p>
        {unclassifiedCount.live > 0 ? (
          <Link
            href="/search?classification=unclassified"
            className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
          >
            {t("stats.classifyNow")} <ArrowRight aria-hidden size={11} />
          </Link>
        ) : (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{t("stats.allDone")}</p>
        )}
        {unclassifiedCount.imported > 0 ? (
          <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
            {t("stats.importedExtra", { count: unclassifiedCount.imported })}
          </p>
        ) : null}
      </StatCard>
    </div>
  );
}
