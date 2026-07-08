import { and, eq } from "drizzle-orm";
import { syncState, type Db } from "@tripatlas/db";

export async function getWatermark(
  db: Db,
  source: string,
  entity: string,
): Promise<Date | null> {
  const rows = await db
    .select({ watermarkTs: syncState.watermarkTs })
    .from(syncState)
    .where(and(eq(syncState.source, source), eq(syncState.entity, entity)));
  return rows[0]?.watermarkTs ?? null;
}

export interface SyncRunResult {
  watermarkTs?: Date | null;
  status: "ok" | "error";
  error?: string;
  rowsUpserted: number;
}

export async function recordSyncRun(
  db: Db,
  source: string,
  entity: string,
  result: SyncRunResult,
): Promise<void> {
  const now = new Date();
  const values = {
    source,
    entity,
    lastRunAt: now,
    lastStatus: result.status,
    lastError: result.error ?? null,
    rowsUpserted: result.rowsUpserted,
    ...(result.status === "ok" ? { lastSuccessAt: now } : {}),
    // Watermark nur bei Erfolg und nur vorwärts bewegen
    ...(result.status === "ok" && result.watermarkTs !== undefined
      ? { watermarkTs: result.watermarkTs }
      : {}),
  };
  await db
    .insert(syncState)
    .values(values)
    .onConflictDoUpdate({
      target: [syncState.source, syncState.entity],
      set: values,
    });
}
