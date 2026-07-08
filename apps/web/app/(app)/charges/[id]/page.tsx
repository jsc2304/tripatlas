import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { chargeSessions, places } from "@tripatlas/db";
import {
  formatDuration,
  formatKwh,
  formatPlaceLabel,
  formatSoc,
  formatTemp,
  formatTimeRange,
} from "@tripatlas/core";
import { db } from "../../../../lib/db";
import { APP_TIMEZONE } from "../../../../lib/config";
import { formatLongDate } from "../../../../lib/day";
import {
  getAllTags,
  getAuditLogFor,
  getChargeSessionById,
} from "../../../../lib/queries";
import {
  getChargeCurve,
  MIN_CHARGE_CURVE_POINTS,
} from "../../../../lib/chargeCurve";
import { AnnotationForm } from "./AnnotationForm";
import { TagManager } from "./TagManager";
import { AuditLogList } from "../../drives/[id]/AuditLogList";
import { ChargeChart } from "./ChargeChart";
import { ChargeMapLoader } from "./ChargeMapLoader";

export const dynamic = "force-dynamic";

/**
 * Kosten-Provenance (cost_source) + Ortspreis für die "automatisch (…)"
 * Anzeige in AnnotationForm — getChargeSessionById (lib/queries.ts, nicht
 * Teil dieser Aufgabe) liefert diese Felder nicht, daher hier separat.
 */
async function getChargeCostMeta(chargeSessionId: number) {
  const rows = await db
    .select({
      costSource: chargeSessions.costSource,
      pricePerKwh: places.electricityPricePerKwh,
      priceCurrency: places.electricityPriceCurrency,
    })
    .from(chargeSessions)
    .leftJoin(places, eq(chargeSessions.placeId, places.id))
    .where(eq(chargeSessions.id, chargeSessionId))
    .limit(1);
  return rows[0] ?? null;
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Renders a Date as a YYYY-MM-DD in APP_TIMEZONE for the day-view link. */
function toDateParam(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: APP_TIMEZONE,
  }).format(date);
}

function roundCoord(coord: number): string {
  return coord.toFixed(6);
}

export default async function ChargeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [t, tCommon, locale] = await Promise.all([
    getTranslations("charges"),
    getTranslations("common"),
    getLocale(),
  ]);
  const { id } = await params;
  const chargeId = Number(id);
  if (!Number.isInteger(chargeId) || chargeId <= 0) notFound();

  const charge = await getChargeSessionById(chargeId);
  if (!charge) notFound();

  const CHARGER_TYPE_LABEL: Record<"ac" | "dc", string> = {
    ac: t("detail.chargerType.ac"),
    dc: t("detail.chargerType.dc"),
  };

  const [auditEntries, allTags, curvePoints, costMeta] = await Promise.all([
    getAuditLogFor("charge_session", chargeId),
    getAllTags(),
    getChargeCurve(chargeId),
    getChargeCostMeta(chargeId),
  ]);

  const placeLabel = formatPlaceLabel(charge.placeName, charge.address, charge.lat, charge.lon);
  const dateStr = toDateParam(charge.startTime);
  const location =
    charge.lat != null && charge.lon != null ? { lat: charge.lat, lon: charge.lon } : null;
  const newPlaceHref = location
    ? `/places/new?lat=${roundCoord(location.lat)}&lon=${roundCoord(location.lon)}`
    : null;

  const kennzahlen: Array<[string, React.ReactNode]> = [
    [
      t("detail.metrics.energyAdded"),
      charge.energyAddedKwh != null ? formatKwh(charge.energyAddedKwh, { sign: true }) : "—",
    ],
    [
      t("detail.metrics.energyUsed"),
      charge.energyUsedKwh != null ? formatKwh(charge.energyUsedKwh) : "—",
    ],
    [
      t("detail.metrics.soc"),
      `${charge.startSoc != null ? formatSoc(charge.startSoc) : "—"} → ${charge.endSoc != null ? formatSoc(charge.endSoc) : "—"}`,
    ],
    [
      t("detail.metrics.maxPower"),
      charge.maxPowerKw != null ? `${charge.maxPowerKw.toFixed(1)} kW` : "—",
    ],
    [
      t("detail.metrics.avgPower"),
      charge.avgPowerKw != null ? `${charge.avgPowerKw.toFixed(1)} kW` : "—",
    ],
    [t("detail.metrics.type"), charge.chargerType != null ? CHARGER_TYPE_LABEL[charge.chargerType] : "—"],
    [
      t("detail.metrics.duration"),
      charge.durationSeconds != null ? formatDuration(charge.durationSeconds) : "—",
    ],
    [t("detail.metrics.address"), charge.address ?? "—"],
  ];

  if (charge.outsideTempAvg != null) {
    kennzahlen.push([t("detail.metrics.outsideTempAvg"), formatTemp(charge.outsideTempAvg)]);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/charges"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
      >
        <ChevronLeft aria-hidden size={16} />
        {tCommon("actions.back")}
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {formatLongDate(dateStr, locale)} ·{" "}
            {formatTimeRange(charge.startTime, charge.endTime, APP_TIMEZONE)}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{placeLabel}</h1>
        </div>
        {charge.chargerType && (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium uppercase ${
              charge.chargerType === "dc"
                ? "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300"
                : "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
            }`}
          >
            {charge.chargerType}
          </span>
        )}
      </div>

      <Link
        href={`/day/${dateStr}`}
        className="mt-2 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 hover:underline dark:text-neutral-400 dark:hover:text-white"
      >
        {t("detail.toDayView", { date: dateStr })}
        <ChevronRight aria-hidden size={14} />
      </Link>

      {location && (
        <Card title={t("detail.location.title")}>
          <ChargeMapLoader lat={location.lat} lon={location.lon} />
          <div className="mt-3 flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
            {charge.address && (
              <p className="text-neutral-500 dark:text-neutral-400">{charge.address}</p>
            )}
            {!charge.placeName && newPlaceHref && (
              <Link
                href={newPlaceHref}
                className="text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline dark:text-neutral-400 dark:hover:text-white"
              >
                {t("detail.location.createPlace")}
              </Link>
            )}
          </div>
        </Card>
      )}

      <Card title={t("detail.metrics.title")}>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {kennzahlen.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 text-sm">
              <dt className="text-neutral-500 dark:text-neutral-400">{label}</dt>
              <dd className="text-right font-medium tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title={t("detail.curve.title")}>
        <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
          {t("detail.curve.pointCount", { count: curvePoints.length })}
        </p>
        {/* Auf plottbare Punkte gaten, nicht auf Rohzeilen — power_kw ist
            nullable und der Chart filtert vor dem Zeichnen (Codex-Finding). */}
        {curvePoints.filter((p) => p.powerKw != null).length >= MIN_CHARGE_CURVE_POINTS ? (
          <ChargeChart
            points={curvePoints}
            avgPowerKw={charge.avgPowerKw}
            maxPowerKw={charge.maxPowerKw}
          />
        ) : (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("detail.curve.noData")}
          </p>
        )}
      </Card>

      <Card title={t("detail.postProcessing.title")}>
        <AnnotationForm
          chargeSessionId={charge.id}
          cost={charge.cost}
          currency={charge.currency}
          notes={charge.notes}
          costSource={costMeta?.costSource ?? null}
          autoPricePerKwh={costMeta?.pricePerKwh ?? null}
          autoPriceCurrency={costMeta?.priceCurrency ?? null}
          placeName={charge.placeName}
        />
      </Card>

      <Card title={t("detail.tags.title")}>
        <TagManager
          chargeSessionId={charge.id}
          initialTags={charge.tags}
          allTagNames={allTags.map((t) => t.name)}
        />
      </Card>

      <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {t("detail.history")}
          </summary>
          <div className="mt-3">
            <AuditLogList entries={auditEntries} />
          </div>
        </details>
      </section>
    </div>
  );
}
