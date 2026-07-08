import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { requireEnv } from "./env.js";

/**
 * One-shot migration runner for production. Runs drizzle-orm's migrator
 * against the compiled `drizzle/` SQL folder that ships in the worker image —
 * no drizzle-kit (and no dev dependencies) required at runtime.
 *
 * Used by the `migrate` service in docker-compose.yml:
 *   node dist/migrate.js
 */
async function main(): Promise<void> {
  const url = requireEnv("DATABASE_URL");
  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  console.log("[tripatlas-migrate] running migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[tripatlas-migrate] done.");

  await client.end();
  process.exit(0);
}

void main().catch((err) => {
  console.error("[tripatlas-migrate] failed:", err);
  process.exit(1);
});
