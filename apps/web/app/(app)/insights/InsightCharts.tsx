"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { Bin } from "@tripatlas/core";

// Gemeinsame SVG-Geometrie, an DriveChart/ChargeChart (M18/M19) angelehnt:
// 600×200-viewBox, dark-mode-aware currentColor-Klassen, min/max-Achsenlabels.
// Bewusst einfacher gehalten als DriveChart — statische Achsenbeschriftung,
// dezente Punktwolke, eine Bin-Mittel-Linie; kein Serien-Toggle.
const CHART_WIDTH = 600;
const CHART_HEIGHT = 200;
const PADDING = { top: 16, right: 16, bottom: 26, left: 44 };

const INNER_W = CHART_WIDTH - PADDING.left - PADDING.right;
const INNER_H = CHART_HEIGHT - PADDING.top - PADDING.bottom;
const PLOT_BOTTOM = PADDING.top + INNER_H;

const numFmt = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

/** „nice"-Wert nach unten/oben für ruhige Achsengrenzen. */
function niceMin(v: number, step: number): number {
  return Math.floor(v / step) * step;
}
function niceMax(v: number, step: number): number {
  return Math.ceil(v / step) * step;
}

export interface ScatterPoint {
  x: number;
  y: number;
}

/**
 * Streudiagramm (jede Fahrt ein dezenter Punkt) + Bin-Mittel-Linie. Verwendet
 * für „Verbrauch vs. Außentemperatur" und „Verbrauch vs. Tempo". X-/Y-Einheit
 * und Bin-Achsenschritt kommen als Props.
 */
export function ScatterBinnedChart({
  points,
  bins,
  xUnit,
  yUnit,
  xStep = 5,
  ariaLabel,
}: {
  points: ScatterPoint[];
  bins: Bin[];
  xUnit: string;
  yUnit: string;
  /** Schrittweite der X-Achsengrenzen-Rundung (z. B. 5 °C, 10 km/h). */
  xStep?: number;
  ariaLabel: string;
}) {
  const t = useTranslations("insights");
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const geom = useMemo(() => {
    const xsAll = [...points.map((p) => p.x), ...bins.map((b) => b.xCenter)];
    const ysAll = [...points.map((p) => p.y), ...bins.map((b) => b.meanY)];
    const xMin = niceMin(Math.min(...xsAll), xStep);
    const xMax = niceMax(Math.max(...xsAll), xStep);
    const yMinRaw = Math.min(...ysAll);
    const yMaxRaw = Math.max(...ysAll);
    // Y mit etwas Luft, an 20er-Schritten ausgerichtet.
    const yMin = niceMin(yMinRaw - (yMaxRaw - yMinRaw) * 0.05, 20);
    const yMax = niceMax(yMaxRaw + (yMaxRaw - yMinRaw) * 0.05, 20);
    return {
      xMin,
      xMax,
      xRange: xMax - xMin || 1,
      yMin,
      yMax,
      yRange: yMax - yMin || 1,
    };
  }, [points, bins, xStep]);

  const toX = (x: number) =>
    PADDING.left + ((x - geom.xMin) / geom.xRange) * INNER_W;
  const toY = (y: number) =>
    PADDING.top + INNER_H - ((y - geom.yMin) / geom.yRange) * INNER_H;

  const linePath = useMemo(() => {
    let d = "";
    bins.forEach((b, i) => {
      d += `${i === 0 ? "M" : "L"} ${toX(b.xCenter).toFixed(1)} ${toY(b.meanY).toFixed(1)} `;
    });
    return d.trim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bins, geom]);

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="h-52 w-full touch-none"
        role="img"
        aria-label={ariaLabel}
        onMouseLeave={() => setHover(null)}
      >
        {/* Horizontales Grid + Y-Achsen-Labels (min/mid/max) */}
        {[0, 0.5, 1].map((f, i) => {
          const y = PADDING.top + INNER_H - f * INNER_H;
          const val = geom.yMin + f * geom.yRange;
          return (
            <g key={`grid-${i}`}>
              <line
                x1={PADDING.left}
                x2={CHART_WIDTH - PADDING.right}
                y1={y}
                y2={y}
                className="stroke-neutral-200 dark:stroke-neutral-700"
                strokeWidth={1}
              />
              <text
                x={PADDING.left - 6}
                y={y}
                textAnchor="end"
                dominantBaseline={i === 2 ? "hanging" : i === 0 ? "auto" : "middle"}
                className="fill-neutral-500 text-[9px] dark:fill-neutral-400"
              >
                {numFmt.format(Math.round(val))}
              </text>
            </g>
          );
        })}

        {/* X-Achsen-Labels min/max */}
        {[geom.xMin, geom.xMax].map((val, i) => (
          <text
            key={`xa-${i}`}
            x={i === 0 ? PADDING.left : CHART_WIDTH - PADDING.right}
            y={PLOT_BOTTOM + 14}
            textAnchor={i === 0 ? "start" : "end"}
            className="fill-neutral-500 text-[9px] dark:fill-neutral-400"
          >
            {numFmt.format(val)} {xUnit}
          </text>
        ))}
        <text
          x={PADDING.left}
          y={PADDING.top - 6}
          className="fill-neutral-400 text-[9px] dark:fill-neutral-500"
        >
          {yUnit}
        </text>

        {/* Dezente Punktwolke */}
        {points.map((p, i) => (
          <circle
            key={`pt-${i}`}
            cx={toX(p.x)}
            cy={toY(p.y)}
            r={2}
            className="fill-neutral-400/40 dark:fill-neutral-500/40"
          />
        ))}

        {/* Bin-Mittel-Linie */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            className="text-blue-600 dark:text-blue-400"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {/* Bin-Punkte (klickbar/hoverbar) */}
        {bins.map((b, i) => (
          <circle
            key={`bin-${i}`}
            cx={toX(b.xCenter)}
            cy={toY(b.meanY)}
            r={hover === i ? 5 : 3.5}
            className="text-blue-600 dark:text-blue-400"
            fill="currentColor"
            stroke="white"
            strokeWidth={1}
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>

      {/* Tooltip-Zeile: Bin-Mittel bei Hover, sonst dezente Legende. */}
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1.5 text-blue-700 dark:text-blue-400">
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400"
          />
          {t("charts.scatterLegend", { step: xStep, unit: xUnit })}
        </span>
        {hover != null && bins[hover] && (
          <span className="tabular-nums text-neutral-600 dark:text-neutral-300">
            {numFmt.format(Math.round(bins[hover]!.xCenter))} {xUnit}:{" "}
            {numFmt.format(Math.round(bins[hover]!.meanY))} {yUnit} ·{" "}
            {t("driveCountLabel", { count: bins[hover]!.count })}
          </span>
        )}
      </div>
    </div>
  );
}

export interface MonthDatum {
  label: string;
  km: number;
  meanConsumption: number;
  driveCount: number;
}

/**
 * Monatsverlauf: km als Balken (linke Achse) + Ø-Verbrauch als Linie (rechte
 * Achse). Zwei kleine Serien mit de-DE-Monatslabels.
 */
export function MonthChart({ months }: { months: MonthDatum[] }) {
  const t = useTranslations("insights");
  const [hover, setHover] = useState<number | null>(null);

  const kmMax = niceMax(Math.max(...months.map((m) => m.km), 1), 100);
  const consVals = months.map((m) => m.meanConsumption);
  const consMin = niceMin(Math.min(...consVals) - 10, 20);
  const consMax = niceMax(Math.max(...consVals) + 10, 20);
  const consRange = consMax - consMin || 1;

  const n = months.length;
  const slot = INNER_W / n;
  const barW = Math.min(slot * 0.5, 48);

  const barX = (i: number) => PADDING.left + slot * i + slot / 2;
  const kmToY = (km: number) => PADDING.top + INNER_H - (km / kmMax) * INNER_H;
  const consToY = (c: number) =>
    PADDING.top + INNER_H - ((c - consMin) / consRange) * INNER_H;

  const linePath = months
    .map((m, i) => `${i === 0 ? "M" : "L"} ${barX(i).toFixed(1)} ${consToY(m.meanConsumption).toFixed(1)}`)
    .join(" ");

  return (
    <div>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="h-52 w-full touch-none"
        role="img"
        aria-label={t("charts.monthChartAriaLabel")}
        onMouseLeave={() => setHover(null)}
      >
        {[0, 0.5, 1].map((f, i) => {
          const y = PADDING.top + INNER_H - f * INNER_H;
          return (
            <line
              key={`grid-${i}`}
              x1={PADDING.left}
              x2={CHART_WIDTH - PADDING.right}
              y1={y}
              y2={y}
              className="stroke-neutral-200 dark:stroke-neutral-700"
              strokeWidth={1}
            />
          );
        })}

        {/* km-Balken (emerald) */}
        {months.map((m, i) => {
          const y = kmToY(m.km);
          return (
            <rect
              key={`bar-${i}`}
              x={barX(i) - barW / 2}
              y={y}
              width={barW}
              height={PLOT_BOTTOM - y}
              rx={3}
              className={
                hover === i
                  ? "fill-emerald-500 dark:fill-emerald-400"
                  : "fill-emerald-500/70 dark:fill-emerald-400/70"
              }
              onMouseEnter={() => setHover(i)}
            />
          );
        })}

        {/* Verbrauchslinie (blau) */}
        <path
          d={linePath}
          fill="none"
          className="text-blue-600 dark:text-blue-400"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {months.map((m, i) => (
          <circle
            key={`cd-${i}`}
            cx={barX(i)}
            cy={consToY(m.meanConsumption)}
            r={hover === i ? 5 : 3.5}
            className="text-blue-600 dark:text-blue-400"
            fill="currentColor"
            stroke="white"
            strokeWidth={1}
            onMouseEnter={() => setHover(i)}
          />
        ))}

        {/* Linke Achse: km (max) */}
        <text
          x={PADDING.left - 6}
          y={PADDING.top}
          textAnchor="end"
          dominantBaseline="hanging"
          className="fill-emerald-700 text-[9px] dark:fill-emerald-400"
        >
          {numFmt.format(kmMax)} km
        </text>
        {/* Rechte Achse: Verbrauch (min/max) */}
        {[consMax, consMin].map((val, i) => (
          <text
            key={`ra-${i}`}
            x={CHART_WIDTH - PADDING.right + 6}
            y={i === 0 ? PADDING.top : PLOT_BOTTOM}
            textAnchor="end"
            dominantBaseline={i === 0 ? "hanging" : "auto"}
            className="fill-blue-700 text-[9px] dark:fill-blue-400"
          >
            {numFmt.format(val)}
          </text>
        ))}

        {/* Monatslabels */}
        {months.map((m, i) => (
          <text
            key={`ml-${i}`}
            x={barX(i)}
            y={PLOT_BOTTOM + 14}
            textAnchor="middle"
            className="fill-neutral-500 text-[9px] dark:fill-neutral-400"
          >
            {m.label}
          </text>
        ))}
      </svg>

      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
          <span aria-hidden className="inline-block h-2 w-2 rounded-sm bg-emerald-500 dark:bg-emerald-400" />
          km
        </span>
        <span className="inline-flex items-center gap-1.5 text-blue-700 dark:text-blue-400">
          <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
          {t("charts.monthChartConsumptionLegend")}
        </span>
        {hover != null && months[hover] && (
          <span className="tabular-nums text-neutral-600 dark:text-neutral-300">
            {months[hover]!.label}: {numFmt.format(Math.round(months[hover]!.km))} km ·{" "}
            {numFmt.format(Math.round(months[hover]!.meanConsumption))} Wh/km ·{" "}
            {t("driveCountLabel", { count: months[hover]!.driveCount })}
          </span>
        )}
      </div>
    </div>
  );
}

export interface WeekdayDatum {
  label: string;
  km: number;
  count: number;
}

/** Wochentagsmuster: km je Wochentag (Mo–So) als Balken + Fahrtenanzahl. */
export function WeekdayChart({ days }: { days: WeekdayDatum[] }) {
  const t = useTranslations("insights");
  const [hover, setHover] = useState<number | null>(null);
  const kmMax = niceMax(Math.max(...days.map((d) => d.km), 1), 50);

  const n = days.length;
  const slot = INNER_W / n;
  const barW = Math.min(slot * 0.6, 40);
  const barX = (i: number) => PADDING.left + slot * i + slot / 2;
  const kmToY = (km: number) => PADDING.top + INNER_H - (km / kmMax) * INNER_H;

  return (
    <div>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="h-52 w-full touch-none"
        role="img"
        aria-label={t("charts.weekdayChartAriaLabel")}
        onMouseLeave={() => setHover(null)}
      >
        {[0, 0.5, 1].map((f, i) => {
          const y = PADDING.top + INNER_H - f * INNER_H;
          const val = (kmMax * f);
          return (
            <g key={`grid-${i}`}>
              <line
                x1={PADDING.left}
                x2={CHART_WIDTH - PADDING.right}
                y1={y}
                y2={y}
                className="stroke-neutral-200 dark:stroke-neutral-700"
                strokeWidth={1}
              />
              <text
                x={PADDING.left - 6}
                y={y}
                textAnchor="end"
                dominantBaseline={i === 2 ? "hanging" : i === 0 ? "auto" : "middle"}
                className="fill-neutral-500 text-[9px] dark:fill-neutral-400"
              >
                {numFmt.format(Math.round(val))}
              </text>
            </g>
          );
        })}

        {days.map((d, i) => {
          const y = kmToY(d.km);
          return (
            <rect
              key={`bar-${i}`}
              x={barX(i) - barW / 2}
              y={y}
              width={barW}
              height={PLOT_BOTTOM - y}
              rx={3}
              className={
                hover === i
                  ? "fill-amber-500 dark:fill-amber-400"
                  : "fill-amber-500/70 dark:fill-amber-400/70"
              }
              onMouseEnter={() => setHover(i)}
            />
          );
        })}

        <text
          x={PADDING.left}
          y={PADDING.top - 6}
          className="fill-neutral-400 text-[9px] dark:fill-neutral-500"
        >
          km
        </text>

        {days.map((d, i) => (
          <text
            key={`dl-${i}`}
            x={barX(i)}
            y={PLOT_BOTTOM + 14}
            textAnchor="middle"
            className="fill-neutral-500 text-[9px] dark:fill-neutral-400"
          >
            {d.label}
          </text>
        ))}
      </svg>

      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
          <span aria-hidden className="inline-block h-2 w-2 rounded-sm bg-amber-500 dark:bg-amber-400" />
          {t("charts.weekdayChartLegend")}
        </span>
        {hover != null && days[hover] && (
          <span className="tabular-nums text-neutral-600 dark:text-neutral-300">
            {days[hover]!.label}: {numFmt.format(Math.round(days[hover]!.km))} km ·{" "}
            {t("driveCountLabel", { count: days[hover]!.count })}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Kurzstrecken-Donut: Anteil Fahrten < 5 km als Ring, mit Ø-Verbrauch
 * Kurzstrecke vs. Gesamt daneben. Rein präsentativ, kein Hover nötig.
 */
export function ShortTripDonut({
  shortShare,
  shortCount,
  totalCount,
  shortMeanConsumption,
  overallMeanConsumption,
}: {
  shortShare: number;
  shortCount: number;
  totalCount: number;
  shortMeanConsumption: number | null;
  overallMeanConsumption: number | null;
}) {
  const t = useTranslations("insights");
  const pct = Math.round(shortShare * 100);
  const R = 42;
  const C = 2 * Math.PI * R;
  const dash = C * shortShare;

  const surplus =
    shortMeanConsumption != null && overallMeanConsumption != null && overallMeanConsumption > 0
      ? (shortMeanConsumption - overallMeanConsumption) / overallMeanConsumption
      : null;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg
        viewBox="0 0 120 120"
        className="h-32 w-32 shrink-0 -rotate-90"
        role="img"
        aria-label={t("charts.shortTripAriaLabel", { pct })}
      >
        <circle
          cx={60}
          cy={60}
          r={R}
          fill="none"
          strokeWidth={14}
          className="stroke-neutral-200 dark:stroke-neutral-700"
        />
        <circle
          cx={60}
          cy={60}
          r={R}
          fill="none"
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C - dash}`}
          className="text-orange-500 dark:text-orange-400"
          stroke="currentColor"
        />
        <text
          x={60}
          y={60}
          textAnchor="middle"
          dominantBaseline="central"
          className="rotate-90 fill-neutral-900 text-[22px] font-semibold tabular-nums dark:fill-neutral-100"
          style={{ transformOrigin: "60px 60px" }}
        >
          {pct}%
        </text>
      </svg>

      <div className="min-w-0 flex-1 space-y-2 text-sm">
        <p className="text-neutral-700 dark:text-neutral-300">
          <span className="font-semibold tabular-nums">{shortCount}</span>{" "}
          {t("charts.shortTripOf")}{" "}
          <span className="tabular-nums">{totalCount}</span> {t("charts.shortTripTail")}
        </p>
        {shortMeanConsumption != null && overallMeanConsumption != null && (
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span className="text-neutral-500 dark:text-neutral-400">
              {t("charts.avgShortTrip")}{" "}
              <span className="font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                {numFmt.format(Math.round(shortMeanConsumption))} Wh/km
              </span>
            </span>
            <span className="text-neutral-500 dark:text-neutral-400">
              {t("charts.avgOverall")}{" "}
              <span className="font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                {numFmt.format(Math.round(overallMeanConsumption))} Wh/km
              </span>
            </span>
          </div>
        )}
        {surplus != null && surplus > 0.01 && (
          <p className="text-orange-700 dark:text-orange-400">
            {t("charts.surplusPrefix")}{" "}
            <span className="font-semibold tabular-nums">
              +{Math.round(surplus * 100)}%
            </span>{" "}
            {t("charts.surplusSuffix")}
          </p>
        )}
      </div>
    </div>
  );
}
