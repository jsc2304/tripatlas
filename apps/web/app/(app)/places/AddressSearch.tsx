"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { searchAddress, type AddressSearchResult } from "../../../lib/actions/places";

const DEBOUNCE_MS = 600;
const MIN_QUERY_LENGTH = 3;

export interface AddressSearchProps {
  onSelect: (result: AddressSearchResult) => void;
}

/**
 * Debounced address search box backed by the `searchAddress` server action
 * (Nominatim/OSM, see docs/vision.md §19.3). Purely additive to the form:
 * selecting a result calls onSelect so the caller can move the map pin and
 * fill the Adresse field, but typed lat/lon/address still work without this.
 */
export function AddressSearch({ onSelect }: AddressSearchProps) {
  const t = useTranslations("places");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AddressSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const requestId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      const found = await searchAddress(q);
      if (requestId.current !== id) return; // stale response, ignore
      setResults(found);
      setOpen(true);
      setLoading(false);
      setActiveIndex(-1);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  function handleSelect(result: AddressSearchResult) {
    onSelect(result);
    setQuery(result.label);
    setOpen(false);
    setResults([]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0) {
        e.preventDefault();
        handleSelect(results[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={t("addressSearch.placeholder")}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls="address-search-results"
        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
      />
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">
          {t("addressSearch.searching")}
        </span>
      )}
      {open && results.length > 0 && (
        <ul
          id="address-search-results"
          role="listbox"
          className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-neutral-200 bg-white py-1 text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
        >
          {results.map((r, i) => (
            <li key={`${r.lat},${r.lon}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(r)}
                className={`block w-full px-3 py-2 text-left ${
                  i === activeIndex
                    ? "bg-neutral-100 dark:bg-neutral-800"
                    : "hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                }`}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
