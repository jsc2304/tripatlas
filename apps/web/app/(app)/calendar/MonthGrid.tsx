import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Zap } from "lucide-react";
import { formatKm } from "@tripatlas/core";
import type { CalendarCell } from "../../../lib/calendarGrid";

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/**
 * 3-4 step subtle intensity scale, dark-mode-aware. Kept low-contrast so the
 * day number and count stay legible on every step.
 */
function intensityClasses(intensity: number): string {
  if (intensity <= 0) return "";
  if (intensity < 0.34) return "bg-sky-50 dark:bg-sky-950/40";
  if (intensity < 0.67) return "bg-sky-100 dark:bg-sky-900/50";
  return "bg-sky-200 dark:bg-sky-800/60";
}

export async function MonthGrid({
  cells,
  vehicleQuery,
}: {
  cells: CalendarCell[];
  vehicleQuery: string;
}) {
  const t = await getTranslations("calendar");
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-900 sm:p-3">
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {WEEKDAY_KEYS.map((key) => (
          <div key={key} className="py-1">
            {t(`weekday.${key}`)}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell) => (
          <Link
            key={cell.date}
            href={`/day/${cell.date}${vehicleQuery}`}
            data-testid="calendar-day-cell"
            className={`flex aspect-square flex-col items-center justify-start rounded-lg border p-1 text-xs transition hover:border-neutral-400 dark:hover:border-neutral-600 sm:aspect-auto sm:min-h-20 sm:items-start sm:p-2 ${
              cell.isToday
                ? "border-2 border-neutral-900 dark:border-white"
                : "border-neutral-200 dark:border-neutral-800"
            } ${intensityClasses(cell.intensity)} ${
              cell.inMonth ? "" : "opacity-40"
            }`}
          >
            <div className="flex w-full items-center justify-between">
              <span
                className={`tabular-nums ${
                  cell.inMonth
                    ? "text-neutral-900 dark:text-neutral-100"
                    : "text-neutral-400 dark:text-neutral-600"
                }`}
              >
                {cell.dayOfMonth}
              </span>
              {cell.stats && cell.stats.chargeCount > 0 && (
                <Zap aria-label={t("chargeIcon")} size={12} className="text-amber-500" />
              )}
            </div>
            {cell.stats && cell.stats.driveCount > 0 && (
              <>
                {/* Mobile: compact count-only dot. */}
                <span
                  className="mt-auto text-[11px] font-medium tabular-nums text-neutral-600 dark:text-neutral-400 sm:hidden"
                  aria-label={t("driveCountLabel", { count: cell.stats.driveCount })}
                >
                  {cell.stats.driveCount}
                </span>
                {/* sm+: full count + km label. */}
                <span className="mt-auto hidden truncate text-[11px] tabular-nums text-neutral-600 dark:text-neutral-400 sm:block">
                  {cell.stats.driveCount} · {formatKm(cell.stats.totalKm)}
                </span>
              </>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
