"use client";
import dynamic from "next/dynamic";
import type { RoutePointTuple } from "../../../../lib/driveRoute";

// Leaflet touches window/document at import time, so the map must never be
// part of the server-rendered bundle (same pattern as places/PlaceForm.tsx).
// `ssr: false` is only allowed inside a Client Component in Next.js 15, so
// this tiny wrapper exists solely to host the dynamic() call for the
// server-component page.tsx.
const DriveMap = dynamic(() => import("./DriveMap").then((m) => m.DriveMap), {
  ssr: false,
  loading: () => (
    <div className="h-64 w-full animate-pulse rounded-lg border border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 sm:h-[360px]" />
  ),
});

export function DriveMapLoader({ points }: { points: RoutePointTuple[] }) {
  return <DriveMap points={points} />;
}
