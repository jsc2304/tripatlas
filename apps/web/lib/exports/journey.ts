import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { chargeSessions, drives, journeyItems, journeys, routePoints } from "@tripatlas/db";
import {
  resolvePlaceLabel,
  type JourneyInfo,
  type JourneyReportCharge,
  type JourneyReportDrive,
  type JourneyType,
  type ReportMeta,
} from "@tripatlas/core";
import { db } from "../db";
import { loadMeta, loadPlaceNames } from "./data";
import { loadTagNamesForDrives } from "./tags";
import type { GpxTrack } from "./gpx";

/** Active (non-excluded) `journey_items` split by item type, for a journey. */
async function loadActiveJourneyItemIds(
  journeyId: number,
): Promise<{ driveIds: number[]; chargeIds: number[] }> {
  const memberships = await db
    .select({ itemType: journeyItems.itemType, itemId: journeyItems.itemId })
    .from(journeyItems)
    .where(and(eq(journeyItems.journeyId, journeyId), eq(journeyItems.excluded, false)));

  return {
    driveIds: memberships.filter((m) => m.itemType === "drive").map((m) => m.itemId),
    chargeIds: memberships.filter((m) => m.itemType === "charge").map((m) => m.itemId),
  };
}

export interface JourneyExportData {
  journey: JourneyInfo;
  drives: JourneyReportDrive[];
  charges: JourneyReportCharge[];
  meta: ReportMeta;
}

/**
 * Loads a journey plus its active (non-excluded) drives and charge sessions,
 * mapped to the pure input shapes `buildJourneyReport` (core) expects.
 * Mirrors `getJourneyDetail` in lib/journeys.ts, but resolves the fuller
 * drive fields (odometer, classification, purpose/customer/project/notes,
 * tags) that the CSV/PDF renderers need and the UI timeline doesn't.
 * Returns null if the journey doesn't exist.
 */
export async function loadJourneyReportData(id: number): Promise<JourneyExportData | null> {
  const journeyRows = await db.select().from(journeys).where(eq(journeys.id, id)).limit(1);
  const journey = journeyRows[0];
  if (!journey) return null;

  const { driveIds, chargeIds } = await loadActiveJourneyItemIds(id);

  const [driveRows, chargeRows, meta] = await Promise.all([
    driveIds.length > 0
      ? db
          .select()
          .from(drives)
          .where(inArray(drives.id, driveIds))
          .orderBy(asc(drives.startTime))
      : Promise.resolve([]),
    chargeIds.length > 0
      ? db
          .select({
            id: chargeSessions.id,
            startTime: chargeSessions.startTime,
            endTime: chargeSessions.endTime,
            durationSeconds: chargeSessions.durationSeconds,
            energyAddedKwh: chargeSessions.energyAddedKwh,
            startSoc: chargeSessions.startSoc,
            endSoc: chargeSessions.endSoc,
            maxPowerKw: chargeSessions.maxPowerKw,
            chargerType: chargeSessions.chargerType,
            cost: chargeSessions.cost,
            currency: chargeSessions.currency,
            address: chargeSessions.address,
            placeId: chargeSessions.placeId,
          })
          .from(chargeSessions)
          .where(inArray(chargeSessions.id, chargeIds))
          .orderBy(asc(chargeSessions.startTime))
      : Promise.resolve([]),
    loadMeta(),
  ]);

  const placeIds = new Set<number>();
  for (const d of driveRows) {
    if (d.startPlaceId != null) placeIds.add(d.startPlaceId);
    if (d.endPlaceId != null) placeIds.add(d.endPlaceId);
  }
  for (const c of chargeRows) {
    if (c.placeId != null) placeIds.add(c.placeId);
  }

  const [placeNameById, tagsByDriveId] = await Promise.all([
    loadPlaceNames([...placeIds]),
    loadTagNamesForDrives(driveRows.map((d) => d.id)),
  ]);

  const journeyDrives: JourneyReportDrive[] = driveRows.map((d) => ({
    id: d.id,
    startTime: d.startTime,
    endTime: d.endTime,
    startPlaceName: d.startPlaceId != null ? placeNameById.get(d.startPlaceId) ?? null : null,
    endPlaceName: d.endPlaceId != null ? placeNameById.get(d.endPlaceId) ?? null : null,
    startAddress: d.startAddress,
    endAddress: d.endAddress,
    startLat: d.startLat,
    startLon: d.startLon,
    endLat: d.endLat,
    endLon: d.endLon,
    startOdometerKm: d.startOdometerKm,
    endOdometerKm: d.endOdometerKm,
    distanceKm: d.distanceKm,
    durationSeconds: d.durationSeconds,
    consumedEnergyKwh: d.consumedEnergyKwh,
    energyIsEstimated: d.energyIsEstimated,
    avgConsumptionWhKm: d.avgConsumptionWhKm,
    classification: d.classification,
    purpose: d.purpose,
    customer: d.customer,
    project: d.project,
    notes: d.notes,
    tags: tagsByDriveId.get(d.id) ?? [],
    startSoc: d.startSoc,
    endSoc: d.endSoc,
    ascentM: d.ascentM,
    descentM: d.descentM,
  }));

  const journeyCharges: JourneyReportCharge[] = chargeRows.map((c) => ({
    id: c.id,
    startTime: c.startTime,
    endTime: c.endTime,
    durationSeconds: c.durationSeconds,
    energyAddedKwh: c.energyAddedKwh,
    startSoc: c.startSoc,
    endSoc: c.endSoc,
    maxPowerKw: c.maxPowerKw,
    chargerType: c.chargerType,
    cost: c.cost,
    currency: c.currency,
    placeName: c.placeId != null ? placeNameById.get(c.placeId) ?? null : null,
    address: c.address,
  }));

  const journeyInfo: JourneyInfo = {
    name: journey.name,
    type: journey.type as JourneyType,
    startTime: journey.startTime,
    endTime: journey.endTime,
    description: journey.description,
  };

  return { journey: journeyInfo, drives: journeyDrives, charges: journeyCharges, meta };
}

export interface JourneyGpxData {
  journeyName: string;
  /** One track per drive with recorded route points, in chronological order. */
  tracks: GpxTrack[];
}

/**
 * Loads full-resolution GPX tracks (lat/lon/ele/time) for all active drives
 * of a journey, one `<trk>` per drive. Unlike the JourneyMap data (see
 * `getJourneyRouteTracks` in lib/journeys.ts, downsampled to ~300 points/drive
 * for browser transfer) this keeps every recorded point — the GPX file is
 * downloaded once, not shipped into the DOM. Returns null if the journey
 * doesn't exist; `tracks` is empty if no drive has route data.
 */
export async function loadJourneyGpxTracks(id: number): Promise<JourneyGpxData | null> {
  const journeyRows = await db
    .select({ name: journeys.name })
    .from(journeys)
    .where(eq(journeys.id, id))
    .limit(1);
  const journey = journeyRows[0];
  if (!journey) return null;

  const { driveIds } = await loadActiveJourneyItemIds(id);
  if (driveIds.length === 0) return { journeyName: journey.name, tracks: [] };

  const driveRows = await db
    .select({
      id: drives.id,
      startPlaceId: drives.startPlaceId,
      startAddress: drives.startAddress,
      startLat: drives.startLat,
      startLon: drives.startLon,
      endPlaceId: drives.endPlaceId,
      endAddress: drives.endAddress,
      endLat: drives.endLat,
      endLon: drives.endLon,
    })
    .from(drives)
    .where(inArray(drives.id, driveIds))
    .orderBy(asc(drives.startTime));

  const placeIds = new Set<number>();
  for (const d of driveRows) {
    if (d.startPlaceId != null) placeIds.add(d.startPlaceId);
    if (d.endPlaceId != null) placeIds.add(d.endPlaceId);
  }

  const [placeNameById, pointRows] = await Promise.all([
    loadPlaceNames([...placeIds]),
    db
      .select({
        driveId: routePoints.driveId,
        lat: routePoints.lat,
        lon: routePoints.lon,
        ele: routePoints.elevationM,
        ts: routePoints.ts,
      })
      .from(routePoints)
      .where(inArray(routePoints.driveId, driveIds))
      .orderBy(asc(routePoints.driveId), asc(routePoints.ts)),
  ]);

  const pointsByDrive = new Map<number, GpxTrack["points"]>();
  for (const p of pointRows) {
    const list = pointsByDrive.get(p.driveId) ?? [];
    list.push({ lat: p.lat, lon: p.lon, ele: p.ele, time: p.ts });
    pointsByDrive.set(p.driveId, list);
  }

  const tracks: GpxTrack[] = [];
  for (const d of driveRows) {
    const points = pointsByDrive.get(d.id);
    if (!points || points.length === 0) continue;
    const name = `${resolvePlaceLabel(
      d.startPlaceId != null ? placeNameById.get(d.startPlaceId) ?? null : null,
      d.startAddress,
      d.startLat,
      d.startLon,
    )} → ${resolvePlaceLabel(
      d.endPlaceId != null ? placeNameById.get(d.endPlaceId) ?? null : null,
      d.endAddress,
      d.endLat,
      d.endLon,
    )}`;
    tracks.push({ name, points });
  }

  return { journeyName: journey.name, tracks };
}
