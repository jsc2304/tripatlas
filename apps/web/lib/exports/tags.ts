import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { driveTags, tags } from "@tripatlas/db";
import { db } from "../db";

/**
 * Loads tag *names* (not full TagLite objects — that's what `ReportDrive.tags`
 * wants) for a set of drives in a single joined query, grouped by drive id.
 */
export async function loadTagNamesForDrives(
  driveIds: number[],
): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>();
  if (driveIds.length === 0) return map;

  const rows = await db
    .select({ driveId: driveTags.driveId, name: tags.name })
    .from(driveTags)
    .innerJoin(tags, eq(driveTags.tagId, tags.id))
    .where(inArray(driveTags.driveId, driveIds))
    .orderBy(asc(tags.name));

  for (const r of rows) {
    const list = map.get(r.driveId) ?? [];
    list.push(r.name);
    map.set(r.driveId, list);
  }
  return map;
}
