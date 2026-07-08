"use client";
import dynamic from "next/dynamic";

const ChargeMap = dynamic(() => import("./ChargeMap").then((m) => m.ChargeMap), {
  ssr: false,
  loading: () => (
    <div className="h-48 w-full animate-pulse rounded-lg border border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 sm:h-56" />
  ),
});

export function ChargeMapLoader({ lat, lon }: { lat: number; lon: number }) {
  return <ChargeMap lat={lat} lon={lon} />;
}
