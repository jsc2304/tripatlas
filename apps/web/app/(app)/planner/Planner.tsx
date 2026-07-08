"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { MapPin, Navigation, TriangleAlert } from "lucide-react";
import { formatDuration } from "@tripatlas/core";
import type { PlannerPlace, PlannerStatus } from "../../../lib/planner";
import {
  planRoute,
  type PlanResult,
} from "../../../lib/actions/planner";
import type { AddressSearchResult } from "../../../lib/actions/places";
import { buttonClasses } from "../../../components/ui/Button";
import { DestinationSearch } from "./DestinationSearch";
import { PlannerMapLoader } from "./PlannerMapLoader";

export interface PlannerProps {
  vehicleId: number;
  places: PlannerPlace[];
  status: PlannerStatus | null;
  defaultSoc: number;
  defaultTempC: number;
  defaultCapacityKwh: number;
  capacityIsDerived: boolean;
  historyDriveCount: number;
  osrmIsDefault: boolean;
}

const CURRENT_VALUE = "current";

/** Mappt den fachlichen baseSource-Wert auf den camelCase-Key in messages/planner.json#baseSource. */
const BASE_SOURCE_KEYS: Record<PlanResult["baseSource"], string> = {
  "temp-bin": "tempBin",
  "history-avg": "historyAvg",
  "vehicle-efficiency": "vehicleEfficiency",
  default: "default",
};

const inputClasses =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100";
const labelClasses =
  "block text-xs font-medium text-neutral-600 dark:text-neutral-400";

interface Coords {
  lat: number;
  lon: number;
}

interface SocTone {
  /** Key unter messages/planner.json#arrivalTone — Übersetzung erfolgt beim Aufrufer. */
  labelKey: "comfortable" | "tight" | "critical";
  card: string;
  value: string;
}

/** Ampel-Farbgebung des Ankunfts-SoC: grün ≥20 %, gelb 10–20 %, rot <10 %. */
function socTone(soc: number): SocTone {
  if (soc >= 20) {
    return {
      labelKey: "comfortable",
      card: "border-green-300 bg-green-50 dark:border-green-900/60 dark:bg-green-950/30",
      value: "text-green-700 dark:text-green-400",
    };
  }
  if (soc >= 10) {
    return {
      labelKey: "tight",
      card: "border-amber-300 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/30",
      value: "text-amber-700 dark:text-amber-400",
    };
  }
  return {
    labelKey: "critical",
    card: "border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30",
    value: "text-red-700 dark:text-red-400",
  };
}

function formatKm(km: number): string {
  return `${km.toFixed(km < 100 ? 1 : 0)} km`;
}

function formatSignedKwh(kwh: number): string {
  const sign = kwh > 0 ? "+" : kwh < 0 ? "−" : "";
  return `${sign}${Math.abs(kwh).toFixed(1)} kWh`;
}

export function Planner({
  vehicleId,
  places,
  status,
  defaultSoc,
  defaultTempC,
  defaultCapacityKwh,
  capacityIsDerived,
  historyDriveCount,
  osrmIsDefault,
}: PlannerProps) {
  const t = useTranslations("planner");
  const hasCurrentPosition = status?.hasPosition ?? false;

  // Start: ein Dropdown mit „Aktuelle Fahrzeugposition" (falls vorhanden) + Orte.
  const [startValue, setStartValue] = useState<string>(
    hasCurrentPosition
      ? CURRENT_VALUE
      : places[0]
        ? `place:${places[0].id}`
        : "",
  );

  // Ziel: eigener Ort ODER Adresssuche.
  const [destMode, setDestMode] = useState<"place" | "address">(
    places.length > 0 ? "place" : "address",
  );
  const [destPlaceValue, setDestPlaceValue] = useState<string>(
    places[0] ? `place:${places[0].id}` : "",
  );
  const [destAddress, setDestAddress] = useState<AddressSearchResult | null>(
    null,
  );
  const [destQuery, setDestQuery] = useState("");

  const [soc, setSoc] = useState(String(defaultSoc));
  const [tempC, setTempC] = useState(String(defaultTempC));
  const [capacityKwh, setCapacityKwh] = useState(String(defaultCapacityKwh));

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [planId, setPlanId] = useState(0);

  function resolvePlaceValue(value: string): Coords | null {
    if (value === CURRENT_VALUE) {
      if (status?.lat != null && status?.lon != null) {
        return { lat: status.lat, lon: status.lon };
      }
      return null;
    }
    const id = Number(value.replace("place:", ""));
    const place = places.find((p) => p.id === id);
    return place ? { lat: place.lat, lon: place.lon } : null;
  }

  function resolveDestination(): Coords | null {
    if (destMode === "place") return resolvePlaceValue(destPlaceValue);
    if (destAddress) return { lat: destAddress.lat, lon: destAddress.lon };
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const start = resolvePlaceValue(startValue);
    const dest = resolveDestination();
    if (!start) {
      setError(t("errors.missingStart"));
      return;
    }
    if (!dest) {
      setError(
        destMode === "address"
          ? t("errors.missingDestAddress")
          : t("errors.missingDestPlace"),
      );
      return;
    }

    const socNum = Number(soc);
    const tempNum = Number(tempC);
    const capNum = Number(capacityKwh);
    if (!Number.isFinite(socNum) || socNum < 0 || socNum > 100) {
      setError(t("errors.socRange"));
      return;
    }
    if (!Number.isFinite(tempNum)) {
      setError(t("errors.tempInvalid"));
      return;
    }
    if (!Number.isFinite(capNum) || capNum < 5 || capNum > 250) {
      setError(t("errors.capacityRange"));
      return;
    }

    setPending(true);
    setError(null);
    const res = await planRoute({
      vehicleId,
      startLat: start.lat,
      startLon: start.lon,
      destLat: dest.lat,
      destLon: dest.lon,
      startSoc: socNum,
      tempC: tempNum,
      capacityKwh: capNum,
    });
    setPending(false);

    if (!res.ok) {
      setError(res.error);
      setPlan(null);
      return;
    }
    setPlan(res.plan);
    setPlanId((n) => n + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Start */}
          <div>
            <label htmlFor="planner-start" className={labelClasses}>
              {t("form.start")}
            </label>
            <select
              id="planner-start"
              value={startValue}
              onChange={(e) => setStartValue(e.target.value)}
              className={`mt-1 ${inputClasses}`}
            >
              {hasCurrentPosition && (
                <option value={CURRENT_VALUE}>
                  {t("form.currentPosition")}
                </option>
              )}
              {places.map((p) => (
                <option key={p.id} value={`place:${p.id}`}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Ziel */}
          <div>
            <div className="flex items-center justify-between">
              <span className={labelClasses}>{t("form.destination")}</span>
              <div className="flex gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setDestMode("place")}
                  className={`rounded px-1.5 py-0.5 ${
                    destMode === "place"
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                      : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                  }`}
                >
                  {t("form.destModePlace")}
                </button>
                <button
                  type="button"
                  onClick={() => setDestMode("address")}
                  className={`rounded px-1.5 py-0.5 ${
                    destMode === "address"
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                      : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                  }`}
                >
                  {t("form.destModeAddress")}
                </button>
              </div>
            </div>
            <div className="mt-1">
              {destMode === "place" ? (
                <select
                  aria-label={t("form.destPlaceAriaLabel")}
                  value={destPlaceValue}
                  onChange={(e) => setDestPlaceValue(e.target.value)}
                  className={inputClasses}
                >
                  {places.length === 0 && (
                    <option value="">{t("form.noPlaces")}</option>
                  )}
                  {places.map((p) => (
                    <option key={p.id} value={`place:${p.id}`}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : (
                <DestinationSearch
                  value={destQuery}
                  onValueChange={(v) => {
                    setDestQuery(v);
                    setDestAddress(null);
                  }}
                  onSelect={setDestAddress}
                />
              )}
            </div>
          </div>

          {/* Start-SoC */}
          <div>
            <label htmlFor="planner-soc" className={labelClasses}>
              {t("form.startSoc")}
            </label>
            <input
              id="planner-soc"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              value={soc}
              onChange={(e) => setSoc(e.target.value)}
              className={`mt-1 ${inputClasses}`}
            />
          </div>

          {/* Außentemperatur */}
          <div>
            <label htmlFor="planner-temp" className={labelClasses}>
              {t("form.expectedTemp")}
            </label>
            <input
              id="planner-temp"
              type="number"
              inputMode="numeric"
              value={tempC}
              onChange={(e) => setTempC(e.target.value)}
              className={`mt-1 ${inputClasses}`}
            />
          </div>

          {/* Batteriekapazität */}
          <div className="sm:col-span-2">
            <label htmlFor="planner-capacity" className={labelClasses}>
              {t("form.batteryCapacity")}
            </label>
            <input
              id="planner-capacity"
              type="number"
              inputMode="numeric"
              min={5}
              max={250}
              value={capacityKwh}
              onChange={(e) => setCapacityKwh(e.target.value)}
              className={`mt-1 ${inputClasses}`}
            />
            <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
              {capacityIsDerived
                ? t("form.capacityHintDerived")
                : t("form.capacityHintDefault")}
            </p>
          </div>
        </div>

        {error && (
          <p className="mt-4 flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
            <TriangleAlert aria-hidden size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className={buttonClasses("primary", "md")}
          >
            <Navigation aria-hidden size={16} />
            {pending ? t("form.submitPending") : t("form.submit")}
          </button>
          {historyDriveCount < 30 && (
            <span className="text-xs text-neutral-400 dark:text-neutral-500">
              {t("form.historyHint", { count: historyDriveCount })}
            </span>
          )}
        </div>

        <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500">
          {t("form.routingPrefix")}{" "}
          {osrmIsDefault
            ? t("form.routingDefaultHint")
            : t("form.routingCustomHint")}
        </p>
      </form>

      {plan && <Result key={planId} plan={plan} />}
    </div>
  );
}

function Result({ plan }: { plan: PlanResult }) {
  const t = useTranslations("planner");
  const arrivalRounded = Math.round(plan.arrivalSoc);
  const displaySoc = Math.max(0, arrivalRounded);
  const tone = socTone(plan.arrivalSoc);
  const toneLabel = t(`arrivalTone.${tone.labelKey}`);

  return (
    <div className="flex flex-col gap-4">
      <PlannerMapLoader geometry={plan.geometry} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric label={t("result.distance")} value={formatKm(plan.distanceKm)} />
        <Metric
          label={t("result.duration")}
          value={formatDuration(plan.durationSeconds)}
        />
        <Metric
          label={t("result.avgSpeed")}
          value={`${Math.round(plan.avgSpeedKmh)} km/h`}
        />
        <Metric
          label={t("result.consumption")}
          value={`${plan.energyKwh.toFixed(1)} kWh`}
          sub={`${Math.round(plan.whPerKm)} Wh/km`}
        />
        <div
          className={`col-span-2 rounded-xl border p-3 sm:col-span-1 ${tone.card}`}
        >
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            {t("result.arrivalSoc")}
          </p>
          <p
            className={`mt-0.5 text-xl font-semibold tabular-nums ${tone.value}`}
          >
            {displaySoc} %
          </p>
          <p className={`text-xs font-medium ${tone.value}`}>{toneLabel}</p>
        </div>
      </div>

      {plan.arrivalSoc < 10 && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {t("result.lowArrivalHint")}
        </p>
      )}

      <Assumptions plan={plan} />
    </div>
  );
}

function Metric({
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
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
        {value}
      </p>
      {sub && (
        <p className="text-xs text-neutral-400 dark:text-neutral-500">{sub}</p>
      )}
    </div>
  );
}

function Assumptions({ plan }: { plan: PlanResult }) {
  const t = useTranslations("planner");
  const baseLabel = t(`baseSource.${BASE_SOURCE_KEYS[plan.baseSource]}`);
  const baseTempHint =
    plan.tempBinCenterC != null
      ? t("assumptions.tempBinHint", {
          tempC: Math.round(plan.tempBinCenterC),
        })
      : "";

  return (
    <details className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <summary className="cursor-pointer text-sm font-medium text-neutral-900 dark:text-neutral-100">
        {t("assumptions.summary")}
      </summary>
      <dl className="mt-3 flex flex-col gap-2 text-sm">
        <Row
          term={t("assumptions.baseConsumption")}
          desc={t("assumptions.baseConsumptionDesc", {
            whPerKm: Math.round(plan.baseWhPerKm),
            source: baseLabel,
            tempHint: baseTempHint,
          })}
        />
        <Row
          term={t("assumptions.temperature")}
          desc={t("assumptions.temperatureDesc", {
            tempC: Math.round(plan.tempC),
          })}
        />
        <Row
          term={t("assumptions.elevation")}
          desc={
            plan.elevationOk
              ? t("assumptions.elevationDesc", {
                  ascent: Math.round(plan.ascentM),
                  descent: Math.round(plan.descentM),
                })
              : t("assumptions.elevationUnavailable")
          }
        />
        <Row
          term={t("assumptions.speedAdjustment")}
          desc={t("assumptions.speedAdjustmentDesc", {
            planned: Math.round(plan.avgSpeedKmh),
            reference: Math.round(plan.referenceSpeedKmh),
            factor: plan.breakdown.speedFactor.toFixed(2),
          })}
        />
        <Row
          term={t("assumptions.capacity")}
          desc={t("assumptions.capacityDesc", {
            capacity: Math.round(plan.capacityKwh),
          })}
        />
        <Row
          term={t("assumptions.routing")}
          desc={
            plan.osrmIsDefault
              ? t("assumptions.routingPublic")
              : t("assumptions.routingCustom")
          }
        />
      </dl>

      <div className="mt-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {t("assumptions.energyBreakdown")}
        </p>
        <dl className="mt-2 flex flex-col gap-1.5 text-sm">
          <Row
            term={t("assumptions.base")}
            desc={formatSignedKwh(plan.breakdown.baseKwh)}
          />
          <Row
            term={t("assumptions.speedAdjustment")}
            desc={formatSignedKwh(plan.breakdown.speedAdjustmentKwh)}
          />
          <Row
            term={t("assumptions.ascent")}
            desc={formatSignedKwh(plan.breakdown.ascentKwh)}
          />
          <Row
            term={t("assumptions.descentRegen")}
            desc={formatSignedKwh(plan.breakdown.descentCreditKwh)}
          />
          <Row
            term={t("assumptions.total")}
            desc={`${plan.energyKwh.toFixed(1)} kWh`}
            strong
          />
        </dl>
      </div>

      <p className="mt-3 flex items-start gap-2 text-xs text-neutral-400 dark:text-neutral-500">
        <MapPin aria-hidden size={14} className="mt-0.5 shrink-0" />
        <span>{t("assumptions.footer")}</span>
      </p>
    </details>
  );
}

function Row({
  term,
  desc,
  strong,
}: {
  term: string;
  desc: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-neutral-500 dark:text-neutral-400">{term}</dt>
      <dd
        className={`text-right tabular-nums ${
          strong
            ? "font-semibold text-neutral-900 dark:text-neutral-100"
            : "text-neutral-700 dark:text-neutral-300"
        }`}
      >
        {desc}
      </dd>
    </div>
  );
}
