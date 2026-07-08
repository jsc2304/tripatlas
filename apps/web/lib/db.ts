import "server-only";
import { createDb, type Db } from "@tripatlas/db";

/**
 * Server-only singleton database handle.
 *
 * Next.js may re-evaluate modules across HMR reloads and route bundles, so the
 * connection is cached on `globalThis` to avoid exhausting the Postgres
 * connection pool during development.
 */
const globalForDb = globalThis as unknown as { __tripatlasDb?: Db };

export const db: Db =
  globalForDb.__tripatlasDb ?? createDb(process.env.DATABASE_URL!);

if (process.env.NODE_ENV !== "production") {
  globalForDb.__tripatlasDb = db;
}
