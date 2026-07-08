import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Zap, ArrowRight, ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import {
  buildJourneyKpis,
  formatConsumption,
  formatDuration,
  formatKm,
  formatKwh,
  formatTime,
} from "@tripatlas/core";
import { APP_TIMEZONE } from "../../../../lib/config";
import {
  getJourneyCandidates,
  getJourneyDetail,
  getJourneyRouteTracks,
  type JourneyTimelineItem,
} from "../../../../lib/journeys";
import { buttonClasses } from "../../../../components/ui/Button";
import { DeleteJourneyButton } from "./DeleteJourneyButton";
import { AddItemButton, RemoveItemButton } from "./ItemButtons";
import { JourneyMapLoader } from "./JourneyMapLoader";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: APP_TIMEZONE,
});

function formatRange(start: Date, end: Date): string {
  return `${dateFmt.format(start)} – ${dateFmt.format(end)}`;
}

function formatDateTimeShort(date: Date): string {
  return `${dateFmt.format(date)} ${formatTime(date, APP_TIMEZONE)}`;
}

function formatEur(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
        {value}
      </p>
      {sub && (
        <p className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
          {sub}
        </p>
      )}
    </div>
  );
}

export default async function JourneyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("journeys");
  const tCommon = await getTranslations("common");
  const { id } = await params;
  const journeyId = Number(id);
  if (!Number.isInteger(journeyId) || journeyId <= 0) notFound();

  const detail = await getJourneyDetail(journeyId);
  if (!detail) notFound();

  const { journey, items, kpiDrives, kpiCharges } = detail;
  const kpis = buildJourneyKpis(kpiDrives, kpiCharges);
  const driveIds = items.filter((i) => i.kind === "drive").map((i) => i.id);
  const [candidates, routeTracks] = await Promise.all([
    getJourneyCandidates(journeyId),
    getJourneyRouteTracks(driveIds),
  ]);

  const chargeMarkers = items
    .filter(
      (i): i is Extract<JourneyTimelineItem, { kind: "charge" }> =>
        i.kind === "charge" && i.lat != null && i.lon != null,
    )
    .map((i) => ({ id: i.id, lat: i.lat as number, lon: i.lon as number, placeName: i.placeName }));
  const hasRouteData = routeTracks.some((t) => t.points.length >= 2) || chargeMarkers.length > 0;
  const mapKey = `${routeTracks.map((t) => t.driveId).join("-")}:${chargeMarkers.map((c) => c.id).join("-")}`;

  const socValue =
    kpis.minSoc != null && kpis.maxSoc != null
      ? `${kpis.minSoc} – ${kpis.maxSoc} %`
      : "–";
  const socSub =
    kpis.startSoc != null && kpis.endSoc != null
      ? t("detail.kpi.socRange", { start: kpis.startSoc, end: kpis.endSoc })
      : undefined;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/journeys"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
      >
        <ChevronLeft aria-hidden size={16} />
        {t("detail.allJourneys")}
      </Link>

      {/* Header */}
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              aria-hidden
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: journey.color ?? "#94a3b8" }}
            />
            <h1 className="text-2xl font-semibold tracking-tight">
              {journey.name}
            </h1>
            <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              {t(`type.${journey.type}`)}
            </span>
          </div>
          <p className="mt-1 text-sm tabular-nums text-neutral-500 dark:text-neutral-400">
            {formatRange(journey.startTime, journey.endTime)}
          </p>
          {journey.description && (
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
              {journey.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Link
            href={`/journeys/${journey.id}/edit`}
            className={buttonClasses("secondary", "md")}
          >
            {tCommon("actions.edit")}
          </Link>
          <DeleteJourneyButton journeyId={journey.id} name={journey.name} />
        </div>
      </div>

      {/* Export (vision.md §20.4) */}
      <div className="mt-4 flex items-center gap-1.5">
        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {t("detail.export")}
        </span>
        <a
          href={`/api/export/journey/${journey.id}?format=csv`}
          className={buttonClasses("ghost", "sm")}
        >
          <Download aria-hidden size={14} />
          CSV
        </a>
        <a
          href={`/api/export/journey/${journey.id}?format=pdf`}
          className={buttonClasses("ghost", "sm")}
        >
          <Download aria-hidden size={14} />
          PDF
        </a>
        {hasRouteData && (
          <a
            href={`/api/export/journey/${journey.id}?format=gpx`}
            className={buttonClasses("ghost", "sm")}
          >
            <Download aria-hidden size={14} />
            GPX
          </a>
        )}
      </div>

      {hasRouteData && (
        <div className="mt-4">
          <JourneyMapLoader
            key={mapKey}
            tracks={routeTracks}
            charges={chargeMarkers}
            color={journey.color}
          />
        </div>
      )}

      {/* KPI grid */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi label={t("detail.kpi.totalDistance")} value={formatKm(kpis.totalDistanceKm)} />
        <Kpi label={t("detail.kpi.driveTime")} value={formatDuration(kpis.driveTimeSeconds)} />
        <Kpi label={t("detail.kpi.chargeTime")} value={formatDuration(kpis.chargeTimeSeconds)} />
        <Kpi
          label={t("detail.kpi.avgConsumption")}
          value={
            kpis.avgConsumptionWhKm != null
              ? formatConsumption(kpis.avgConsumptionWhKm, kpis.anyEstimated)
              : "–"
          }
        />
        <Kpi
          label={t("detail.kpi.consumedEnergy")}
          value={formatKwh(kpis.consumedEnergyKwh)}
          sub={kpis.anyEstimated ? t("detail.kpi.partiallyEstimated") : undefined}
        />
        <Kpi
          label={t("detail.kpi.chargedEnergy")}
          value={formatKwh(kpis.chargedEnergyKwh)}
        />
        <Kpi
          label={t("detail.kpi.chargeStops")}
          value={String(kpis.chargeStopCount)}
        />
        <Kpi label={t("detail.kpi.socMinMax")} value={socValue} sub={socSub} />
        <Kpi
          label={t("detail.kpi.cost")}
          value={kpis.totalCost != null ? formatEur(kpis.totalCost) : "–"}
          sub={
            kpis.costPer100Km != null
              ? t("detail.kpi.costPerKm", { value: formatEur(kpis.costPer100Km) })
              : kpis.hasIncompleteCost
                ? t("detail.kpi.incomplete")
                : undefined
          }
        />
      </div>

      {kpis.hasIncompleteCost && kpis.totalCost != null && (
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          {t("detail.incompleteCostNote")}
        </p>
      )}

      {/* Chronological item list */}
      <h2 className="mt-8 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        {t("detail.itemsHeading")}
      </h2>
      <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
            {t("detail.noItems")}
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {items.map((item) => (
              <ItemRow key={`${item.kind}-${item.id}`} item={item} journeyId={journey.id} t={t} />
            ))}
          </ul>
        )}
      </div>

      {/* Add candidates */}
      <h2 className="mt-8 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        {t("detail.add")}
      </h2>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        {t("detail.addHint")}
      </p>
      <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
        {candidates.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
            {t("detail.noCandidates")}
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {candidates.map((c) => (
              <li
                key={`${c.kind}-${c.id}`}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                {c.kind === "charge" ? (
                  <Zap aria-hidden size={16} className="shrink-0 text-amber-500" />
                ) : (
                  <ArrowRight aria-hidden size={16} className="shrink-0 text-neutral-400" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-neutral-800 dark:text-neutral-200">
                    {c.label}
                    {c.excluded && (
                      <span className="ml-1.5 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                        {t("detail.previouslyRemoved")}
                      </span>
                    )}
                  </p>
                  <p className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                    {formatDateTimeShort(c.startTime)}
                    {c.kind === "drive" && c.distanceKm != null
                      ? ` · ${formatKm(c.distanceKm)}`
                      : ""}
                    {c.kind === "charge" && c.energyAddedKwh != null
                      ? ` · ${formatKwh(c.energyAddedKwh, { sign: true })}${
                          c.chargerType ? ` · ${c.chargerType.toUpperCase()}` : ""
                        }`
                      : ""}
                  </p>
                </div>
                <AddItemButton
                  journeyId={journey.id}
                  itemType={c.kind}
                  itemId={c.id}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ItemRow({
  item,
  journeyId,
  t,
}: {
  item: JourneyTimelineItem;
  journeyId: number;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const href = item.kind === "drive" ? `/drives/${item.id}` : `/charges/${item.id}`;

  const title =
    item.kind === "drive"
      ? `${item.startPlaceName ?? item.startAddress ?? "?"} → ${
          item.endPlaceName ?? item.endAddress ?? "?"
        }`
      : item.placeName ?? item.address ?? t("chargingSession");

  const sub =
    item.kind === "drive"
      ? [
          formatDateTimeShort(item.startTime),
          item.distanceKm != null ? formatKm(item.distanceKm) : null,
          item.durationSeconds != null
            ? formatDuration(item.durationSeconds)
            : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : [
          formatDateTimeShort(item.startTime),
          item.energyAddedKwh != null
            ? formatKwh(item.energyAddedKwh, { sign: true })
            : null,
          item.chargerType ? item.chargerType.toUpperCase() : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      {item.kind === "charge" ? (
        <Zap aria-hidden size={16} className="shrink-0 text-amber-500" />
      ) : (
        <ArrowRight aria-hidden size={16} className="shrink-0 text-neutral-400" />
      )}
      <Link href={href} className="min-w-0 flex-1 hover:underline">
        <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {title}
        </p>
        <p className="truncate text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
          {sub}
        </p>
      </Link>
      <RemoveItemButton
        journeyId={journeyId}
        itemType={item.kind}
        itemId={item.id}
      />
    </li>
  );
}
