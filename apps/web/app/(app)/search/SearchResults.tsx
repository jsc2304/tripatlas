import Link from "next/link";
import { Zap } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { formatKwh, formatPlaceLabel, formatTimeRange } from "@tripatlas/core";
import { TagChip } from "../../../components/TagChip";
import { toIntlLocale } from "../../../lib/i18nLocale";
import type { SearchResultRow } from "../../../lib/search";
import { DriveResultRow } from "./DriveResultRow";
import { matchHint } from "./matchHint";

/** Local YYYY-MM-DD for an instant, in the given IANA timezone. */
function localDateKey(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: tz,
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

function formatDayHeading(dateKey: string, locale: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!, 12));
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(dt);
}

export async function SearchResults({
  rows,
  tz,
  q,
}: {
  rows: SearchResultRow[];
  tz: string;
  q: string;
}) {
  const locale = await getLocale();
  const groups = new Map<string, SearchResultRow[]>();
  for (const row of rows) {
    const key = localDateKey(row.startTime, tz);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  const orderedKeys = [...groups.keys()].sort((a, b) => (a < b ? 1 : -1));

  return (
    <div className="flex flex-col gap-6">
      {orderedKeys.map((dateKey) => (
        <section key={dateKey}>
          <Link
            href={`/day/${dateKey}`}
            className="text-sm font-semibold text-neutral-700 hover:underline dark:text-neutral-300"
          >
            {formatDayHeading(dateKey, locale)}
          </Link>
          <ol className="mt-2 flex flex-col gap-2">
            {groups.get(dateKey)!.map((row) =>
              row.kind === "drive" ? (
                <DriveResultRow key={`d${row.id}`} row={row} tz={tz} q={q} />
              ) : (
                <ChargeResultRow key={`c${row.id}`} row={row} tz={tz} q={q} />
              ),
            )}
          </ol>
        </section>
      ))}
    </div>
  );
}

async function ChargeResultRow({
  row,
  tz,
  q,
}: {
  row: Extract<SearchResultRow, { kind: "charge" }>;
  tz: string;
  q: string;
}) {
  const t = await getTranslations("search");
  const label = formatPlaceLabel(row.placeName, row.address, null, null);
  const hint = matchHint(q, [
    { label: t("matchFieldPlace"), value: row.placeName ?? row.address },
    ...row.tags.map((tag) => ({ label: t("matchFieldTag"), value: tag.name })),
  ]);

  return (
    <li className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40">
      <Link href={`/charges/${row.id}`} className="block px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-emerald-800 dark:text-emerald-300">
          <span className="flex items-center gap-1.5 tabular-nums text-xs">
            <Zap aria-hidden size={14} />
            {formatTimeRange(row.startTime, row.endTime, tz)}
          </span>
          {row.energyAddedKwh != null && (
            <span className="text-xs font-medium">
              {formatKwh(row.energyAddedKwh, { sign: true })}
            </span>
          )}
        </div>

        <p className="mt-1 text-sm font-medium text-emerald-900 dark:text-emerald-200">
          {label}
        </p>

        {hint && (
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
            {t("matchLabel", { hint })}
          </p>
        )}

        {row.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {row.tags.map((tag) => (
              <TagChip key={tag.id} tag={tag} />
            ))}
          </div>
        )}
      </Link>
    </li>
  );
}
