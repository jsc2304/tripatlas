"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonClasses } from "../../../components/ui/Button";

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const idx = y! * 12 + (m! - 1) + delta;
  const yy = Math.floor(idx / 12);
  const mm = (idx % 12) + 1;
  return `${yy}-${String(mm).padStart(2, "0")}`;
}

export function ChargeMonthFilters({ month }: { month: string }) {
  const router = useRouter();
  const t = useTranslations("charges");

  function goTo(nextMonth: string) {
    router.push(`/charges?month=${nextMonth}`);
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={t("filters.prevMonth")}
        onClick={() => goTo(shiftMonth(month, -1))}
        className={buttonClasses("secondary", "md", "!h-10 !w-10 !p-0")}
      >
        <ChevronLeft aria-hidden size={18} />
      </button>
      <input
        type="month"
        value={month}
        aria-label={t("filters.selectMonth")}
        onChange={(e) => {
          if (e.target.value) goTo(e.target.value);
        }}
        className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus-visible:ring-white dark:focus-visible:ring-offset-neutral-950"
      />
      <button
        type="button"
        aria-label={t("filters.nextMonth")}
        onClick={() => goTo(shiftMonth(month, 1))}
        className={buttonClasses("secondary", "md", "!h-10 !w-10 !p-0")}
      >
        <ChevronRight aria-hidden size={18} />
      </button>
    </div>
  );
}
