"use client";
import dynamic from "next/dynamic";

// Leaflet fasst window/document beim Import an, daher darf die Karte nie Teil des
// server-gerenderten Bundles sein (Muster drives/[id]/DriveMapLoader.tsx).
// `ssr: false` ist in Next.js 15 nur in Client-Komponenten erlaubt — dieser
// dünne Wrapper hostet den dynamic()-Aufruf.
const PlannerMap = dynamic(
  () => import("./PlannerMap").then((m) => m.PlannerMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 w-full animate-pulse rounded-lg border border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 sm:h-[360px]" />
    ),
  },
);

export function PlannerMapLoader({
  geometry,
}: {
  geometry: [number, number][];
}) {
  return <PlannerMap geometry={geometry} />;
}
