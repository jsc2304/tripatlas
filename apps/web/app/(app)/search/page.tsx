import { Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Classification } from "@tripatlas/core";
import { APP_TIMEZONE } from "../../../lib/config";
import { dayBounds, isValidDateParam } from "../../../lib/day";
import { getDefaultVehicleId, runSearch, type SearchType } from "../../../lib/search";
import { getAllTags } from "../../../lib/queries";
import { EmptyState } from "../../../components/ui/EmptyState";
import {
  BulkSelectionProvider,
  SelectionToggle,
} from "../../../components/bulkSelection";
import { SearchControls } from "./SearchControls";
import { SearchResults } from "./SearchResults";

export const dynamic = "force-dynamic";

const ALL_CLASSIFICATIONS: Classification[] = [
  "unclassified",
  "private",
  "business",
  "commute",
];

function parseClassifications(raw: string | undefined): Classification[] {
  if (raw == null || raw.trim() === "") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is Classification => ALL_CLASSIFICATIONS.includes(s as Classification));
}

function parseType(raw: string | undefined): SearchType {
  if (raw === "charges" || raw === "all") return raw;
  return "drives";
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    from?: string;
    to?: string;
    classification?: string;
    type?: string;
  }>;
}) {
  const t = await getTranslations("search");
  const sp = await searchParams;
  const q = sp.q ?? "";
  const from = sp.from && isValidDateParam(sp.from) ? sp.from : "";
  const to = sp.to && isValidDateParam(sp.to) ? sp.to : "";
  const classifications = parseClassifications(sp.classification);
  const type = parseType(sp.type);

  const trimmedQ = q.trim();
  const hasFilters = from !== "" || to !== "" || classifications.length > 0;
  const hasQuery = trimmedQ !== "";
  const shouldSearch = hasQuery || hasFilters;

  const vehicleId = await getDefaultVehicleId();

  const result =
    shouldSearch && vehicleId != null
      ? await runSearch(vehicleId, {
          q: trimmedQ,
          from: from ? dayBounds(from).start : undefined,
          to: to ? dayBounds(to).end : undefined,
          classifications: classifications.length > 0 ? classifications : undefined,
          type,
        })
      : null;

  const tagOptions = result
    ? (await getAllTags()).map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
      }))
    : [];
  const driveResultIds = result
    ? result.rows.flatMap((r) => (r.kind === "drive" ? [r.id] : []))
    : [];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {t("subtitle")}
      </p>

      <div className="mt-6">
        <SearchControls
          q={q}
          from={from}
          to={to}
          classifications={classifications}
          type={type}
        />
      </div>

      <div className="mt-6">
        {!shouldSearch && (
          <EmptyState
            icon={Search}
            title={t("emptyPrompt.title")}
            hint={t("emptyPrompt.hint")}
          />
        )}

        {shouldSearch && vehicleId == null && (
          <p className="rounded-xl border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
            {t("noVehicle")}
          </p>
        )}

        {result && (
          <BulkSelectionProvider allIds={driveResultIds} tags={tagOptions}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p
                className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
                data-testid="search-summary"
              >
                {formatSummary(t, result.driveCount, result.chargeCount, type)}
              </p>
              {driveResultIds.length > 0 && <SelectionToggle />}
            </div>

            {result.rows.length === 0 ? (
              <EmptyState
                icon={Search}
                title={t("noResults.title")}
                hint={t("noResults.hint")}
              />
            ) : (
              <>
                <SearchResults rows={result.rows} tz={APP_TIMEZONE} q={trimmedQ} />
                {result.truncated && (
                  <p className="mt-4 text-center text-xs text-neutral-500 dark:text-neutral-400">
                    {t("truncatedHint")}
                  </p>
                )}
              </>
            )}
          </BulkSelectionProvider>
        )}
      </div>
    </div>
  );
}

function formatSummary(
  t: Awaited<ReturnType<typeof getTranslations>>,
  driveCount: number,
  chargeCount: number,
  type: SearchType,
): string {
  const parts: string[] = [];
  if (type !== "charges") {
    parts.push(t("summaryDrives", { count: driveCount }));
  }
  if (type !== "drives") {
    parts.push(t("summaryCharges", { count: chargeCount }));
  }
  return parts.join(", ");
}
