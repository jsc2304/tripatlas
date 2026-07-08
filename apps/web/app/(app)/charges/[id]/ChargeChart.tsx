"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ChargeCurvePoint } from "../../../../lib/chargeCurve";

export interface ChargeChartProps {
  points: ChargeCurvePoint[];
  avgPowerKw: number | null;
  maxPowerKw: number | null;
}

const kwFormatter = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Formats a power value in kW (de-DE, one decimal, comma separator). */
function formatKwPrecise(kw: number): string {
  return `${kwFormatter.format(kw)} kW`;
}

const CHART_WIDTH = 600;
const CHART_HEIGHT = 200;
const PADDING = { top: 14, right: 16, bottom: 22, left: 40 };

type XMode = "soc" | "time";

/**
 * Hand-gebautes SVG-Chart „Ladekurve" (M19) — Leistung (kW) über SoC (%,
 * Standardmodus, DIE Ladekurven-Ansicht) oder wahlweise über verstrichene
 * Zeit (min). Bewusst einfacher gehalten als DriveChart (M18): eine Serie,
 * kein Ein-/Ausblenden — nur der X-Achsen-Toggle. Übernimmt Optik/Interaktion
 * von DriveChart (Hover-Führungslinie, Tooltip-Zeile unter dem SVG,
 * dark-mode-aware Klassen).
 */
export function ChargeChart({ points, avgPowerKw, maxPowerKw }: ChargeChartProps) {
  const t = useTranslations("charges");
  const [mode, setMode] = useState<XMode>("soc");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const data = useMemo(() => {
    // Nur Punkte mit gültiger Leistung berücksichtigen.
    const withPower = points.filter((p) => p.powerKw != null);

    // Beide Modi teilen sich elapsedMin, damit der Tooltip ohne Cast auskommt.
    // Modus „SoC": nach SoC aufsteigend sortieren (Ladekurve als Funktion des SoC).
    // Modus „Zeit": Originalreihenfolge (bereits ts-aufsteigend aus der Query).
    const t0 = points[0]?.ts ?? 0;
    const byTime = withPower.map((p) => ({ ...p, elapsedMin: (p.ts - t0) / 60000 }));
    const bySoc = byTime
      .filter((p) => p.soc != null)
      .slice()
      .sort((a, b) => a.soc! - b.soc!);

    const powers = withPower.map((p) => p.powerKw!);
    const powerMin = Math.min(...powers, 0);
    const powerMax = Math.max(...powers, maxPowerKw ?? 0);

    return { bySoc, byTime, powerMin, powerMax };
  }, [points, maxPowerKw]);

  const active = mode === "soc" ? data.bySoc : data.byTime;

  const xs = useMemo(() => {
    if (mode === "soc") return data.bySoc.map((p) => p.soc!);
    return data.byTime.map((p) => p.elapsedMin);
  }, [mode, data]);

  const xMin = xs.length > 0 ? Math.min(...xs) : 0;
  const xMax = xs.length > 0 ? Math.max(...xs) : 1;
  const xRange = xMax - xMin || 1;

  const innerWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const innerHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const plotBottom = PADDING.top + innerHeight;

  const yPad = (data.powerMax - data.powerMin) * 0.08 || 1;
  const yMin = Math.max(0, data.powerMin - yPad);
  const yMax = data.powerMax + yPad;
  const yRange = yMax - yMin || 1;

  const toX = (i: number) => PADDING.left + ((xs[i]! - xMin) / xRange) * innerWidth;
  const toY = (kw: number) => PADDING.top + innerHeight - ((kw - yMin) / yRange) * innerHeight;

  const linePath = useMemo(() => {
    let d = "";
    let started = false;
    active.forEach((p, i) => {
      const kw = p.powerKw;
      if (kw == null) {
        started = false;
        return;
      }
      const cmd = started ? "L" : "M";
      d += `${cmd} ${toX(i).toFixed(1)} ${toY(kw).toFixed(1)} `;
      started = true;
    });
    return d.trim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, xMin, xRange, yMin, yRange]);

  const areaPath = useMemo(() => {
    if (!linePath || active.length === 0) return "";
    return `${linePath} L ${toX(active.length - 1).toFixed(1)} ${plotBottom.toFixed(1)} L ${toX(0).toFixed(1)} ${plotBottom.toFixed(1)} Z`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linePath, active, plotBottom]);

  function handleMove(clientX: number) {
    const svg = svgRef.current;
    if (!svg || active.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const vbX = ((clientX - rect.left) / rect.width) * CHART_WIDTH;
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < active.length; i++) {
      const dx = Math.abs(toX(i) - vbX);
      if (dx < best) {
        best = dx;
        nearest = i;
      }
    }
    setHoverIdx(nearest);
  }

  function throttledMove(clientX: number) {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      handleMove(clientX);
    });
  }

  if (points.length < 3) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {t("detail.curve.noData")}
      </p>
    );
  }

  const hoverX = hoverIdx != null ? toX(hoverIdx) : null;
  const hoverPoint = hoverIdx != null ? active[hoverIdx] : null;

  return (
    <div>
      {/* X-Achsen-Toggle */}
      <div className="mb-3 flex gap-2">
        {(
          [
            { key: "soc", label: t("detail.curve.modePowerOverSoc") },
            { key: "time", label: t("detail.curve.modeOverTime") },
          ] as const
        ).map((opt) => {
          const on = mode === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => {
                setMode(opt.key);
                setHoverIdx(null);
              }}
              aria-pressed={on}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                on
                  ? "border-neutral-300 bg-neutral-50 text-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
                  : "border-neutral-200 bg-transparent text-neutral-400 dark:border-neutral-800 dark:text-neutral-600"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="h-52 w-full touch-none"
        role="img"
        aria-label={
          mode === "soc"
            ? t("detail.curve.ariaSoc")
            : t("detail.curve.ariaTime")
        }
        onMouseMove={(e) => throttledMove(e.clientX)}
        onMouseLeave={() => setHoverIdx(null)}
        onTouchStart={(e) => {
          const t = e.touches[0];
          if (t) handleMove(t.clientX);
        }}
        onTouchMove={(e) => {
          const t = e.touches[0];
          if (t) throttledMove(t.clientX);
        }}
        onTouchEnd={() => setHoverIdx(null)}
      >
        {/* Horizontales Grid (min/mid/max) */}
        {[0, 0.5, 1].map((f, i) => {
          const y = PADDING.top + innerHeight - f * innerHeight;
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

        {/* Fläche unter der Kurve */}
        {areaPath && (
          <path d={areaPath} className="fill-emerald-500/15 dark:fill-emerald-400/15" />
        )}

        {/* Ø-/Max-Leistung Referenzlinien (dünn, gestrichelt) */}
        {avgPowerKw != null && avgPowerKw >= yMin && avgPowerKw <= yMax && (
          <>
            <line
              x1={PADDING.left}
              x2={CHART_WIDTH - PADDING.right}
              y1={toY(avgPowerKw)}
              y2={toY(avgPowerKw)}
              className="stroke-neutral-400 dark:stroke-neutral-500"
              strokeWidth={1}
              strokeDasharray="2 3"
            />
            <text
              x={CHART_WIDTH - PADDING.right}
              y={toY(avgPowerKw) - 3}
              textAnchor="end"
              className="text-[9px] fill-neutral-500 dark:fill-neutral-400"
            >
              {t("detail.curve.avgAbbrev", { value: formatKwPrecise(avgPowerKw) })}
            </text>
          </>
        )}
        {maxPowerKw != null && maxPowerKw >= yMin && maxPowerKw <= yMax && (
          <>
            <line
              x1={PADDING.left}
              x2={CHART_WIDTH - PADDING.right}
              y1={toY(maxPowerKw)}
              y2={toY(maxPowerKw)}
              className="stroke-neutral-400 dark:stroke-neutral-500"
              strokeWidth={1}
              strokeDasharray="2 3"
            />
            <text
              x={CHART_WIDTH - PADDING.right}
              y={toY(maxPowerKw) - 3}
              textAnchor="end"
              className="text-[9px] fill-neutral-500 dark:fill-neutral-400"
            >
              {t("detail.curve.maxAbbrev", { value: formatKwPrecise(maxPowerKw) })}
            </text>
          </>
        )}

        {/* Leistungslinie */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            className="text-emerald-600 dark:text-emerald-400"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Linke Achsen-Labels (min/max kW) */}
        {[yMax, yMin].map((val, i) => (
          <text
            key={`ya-${i}`}
            x={PADDING.left - 6}
            y={i === 0 ? PADDING.top : plotBottom}
            textAnchor="end"
            dominantBaseline={i === 0 ? "hanging" : "auto"}
            className="text-[9px] fill-neutral-500 dark:fill-neutral-400"
          >
            {Math.round(val)} kW
          </text>
        ))}

        {/* Hover-Führungslinie + Punkt */}
        {hoverX != null && hoverPoint?.powerKw != null && (
          <>
            <line
              x1={hoverX}
              x2={hoverX}
              y1={PADDING.top}
              y2={plotBottom}
              className="stroke-neutral-400 dark:stroke-neutral-500"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle
              cx={hoverX}
              cy={toY(hoverPoint.powerKw)}
              r={3}
              className="text-emerald-600 dark:text-emerald-400"
              fill="currentColor"
              stroke="white"
              strokeWidth={1}
            />
          </>
        )}
      </svg>

      {/* Tooltip als HTML unter dem SVG */}
      {hoverPoint?.powerKw != null && (
        <div className="mt-1 text-xs tabular-nums text-emerald-700 dark:text-emerald-400">
          {mode === "soc"
            ? t("detail.curve.tooltipSoc", {
                percent: Math.round(hoverPoint.soc!),
                power: formatKwPrecise(hoverPoint.powerKw),
              })
            : t("detail.curve.tooltipTime", {
                minutes: Math.round(hoverPoint.elapsedMin),
                power: formatKwPrecise(hoverPoint.powerKw),
              })}
        </div>
      )}
    </div>
  );
}
