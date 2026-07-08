import "server-only";
import { desc, eq } from "drizzle-orm";
import { softwareUpdates } from "@tripatlas/db";
import { db } from "./db";

export interface SoftwareUpdateRow {
  id: number;
  version: string | null;
  startTime: Date;
  endTime: Date | null;
}

/**
 * Software-Update-Historie eines Fahrzeugs, neueste zuerst — für die
 * Settings-Timeline. Kleine Tabelle (ein paar Dutzend Zeilen pro Fahrzeug im
 * MVP), kein Limit nötig.
 */
export async function getSoftwareUpdates(
  vehicleId: number,
): Promise<SoftwareUpdateRow[]> {
  return db
    .select({
      id: softwareUpdates.id,
      version: softwareUpdates.version,
      startTime: softwareUpdates.startTime,
      endTime: softwareUpdates.endTime,
    })
    .from(softwareUpdates)
    .where(eq(softwareUpdates.vehicleId, vehicleId))
    .orderBy(desc(softwareUpdates.startTime));
}
