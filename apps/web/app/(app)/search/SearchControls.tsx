"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Classification } from "@tripatlas/core";

const CLASSIFICATION_VALUES: Classification[] = [
  "business",
  "private",
  "commute",
  "unclassified",
];

const TYPE_VALUES: Array<"drives" | "charges" | "all"> = ["drives", "charges", "all"];

export function SearchControls({
  q,
  from,
  to,
  classifications,
  type,
}: {
  q: string;
  from: string;
  to: string;
  classifications: Classification[];
  type: "drives" | "charges" | "all";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("search");
  const tc = useTranslations("common");
  const [qInput, setQInput] = useState(q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local input in sync if the URL changes from elsewhere (e.g. back/forward nav).
  useEffect(() => {
    setQInput(q);
  }, [q]);

  function pushParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value == null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    router.replace(`/search?${params.toString()}`);
  }

  function onQChange(value: string) {
    setQInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushParams({ q: value });
    }, 400);
  }

  function toggleClassification(value: Classification) {
    const isSelected = classifications.includes(value);
    const next = isSelected
      ? classifications.filter((c) => c !== value)
      : [...classifications, value];
    pushParams({ classification: next.length > 0 ? next.join(",") : null });
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        autoFocus
        value={qInput}
        onChange={(e) => onQChange(e.target.value)}
        placeholder={t("placeholder")}
        aria-label={t("title")}
        className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-900 shadow-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-2">
          <label
            htmlFor="search-from"
            className="text-xs font-medium text-neutral-500 dark:text-neutral-400"
          >
            {t("from")}
          </label>
          <input
            id="search-from"
            type="date"
            value={from}
            onChange={(e) => pushParams({ from: e.target.value })}
            className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-base text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
          <label
            htmlFor="search-to"
            className="text-xs font-medium text-neutral-500 dark:text-neutral-400"
          >
            {t("to")}
          </label>
          <input
            id="search-to"
            type="date"
            value={to}
            onChange={(e) => pushParams({ to: e.target.value })}
            className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-base text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {CLASSIFICATION_VALUES.map((value) => {
            const active = classifications.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleClassification(value)}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  active
                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                    : "border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                }`}
              >
                {tc(`classification.${value}`)}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-neutral-300 p-0.5 dark:border-neutral-700">
          {TYPE_VALUES.map((value) => {
            const active = type === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => pushParams({ type: value === "drives" ? null : value })}
                aria-pressed={active}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  active
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                }`}
              >
                {t(`type.${value}`)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
