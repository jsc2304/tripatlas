import { gt } from "drizzle-orm";
import { createDb, syncState } from "@tripatlas/db";
import { createTeslamateClient, probeTeslamateSchema } from "./teslamate/client.js";
import { runSyncCycle } from "./sync/cycle.js";
import { rematchPlaces } from "./sync/rematch.js";
import { importTessie } from "./import/tessie.js";
import { requireEnv } from "./env.js";

const USAGE = `Tripatlas Worker CLI

  pnpm --filter @tripatlas/worker cli resync [--from YYYY-MM-DD]
      Setzt die Sync-Watermarks zurück (optional auf ein Datum) und läuft
      einen kompletten Zyklus. Annotationen bleiben erhalten (Upsert).

  pnpm --filter @tripatlas/worker cli rematch-places
      Rechnet alle Place-Zuordnungen neu (nach Place-Änderungen).
      Gelockte Zuordnungen bleiben unangetastet.

  pnpm --filter @tripatlas/worker cli import-tessie <dir> [--vehicle-id N]
      Importiert Tessie-Roh-Telemetrie (CSV-Export) und rekonstruiert daraus
      Fahrten und Ladevorgänge (source='tessie'). Idempotent per Upsert.
`;

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  const db = createDb(requireEnv("DATABASE_URL"));

  switch (command) {
    case "resync": {
      const tm = createTeslamateClient(requireEnv("TESLAMATE_DATABASE_URL"));
      await probeTeslamateSchema(tm);

      const fromIdx = args.indexOf("--from");
      if (fromIdx >= 0) {
        const from = new Date(`${args[fromIdx + 1]}T00:00:00Z`);
        if (Number.isNaN(from.getTime())) {
          console.error(`Ungültiges Datum: ${args[fromIdx + 1]}`);
          process.exit(1);
        }
        // Watermark nur zurücksetzen, wenn sie hinter dem Datum liegt — vorwärts nie.
        await db
          .update(syncState)
          .set({ watermarkTs: from })
          .where(gt(syncState.watermarkTs, from));
        console.log(`Watermarks auf ${from.toISOString()} zurückgesetzt.`);
      } else {
        await db.update(syncState).set({ watermarkTs: null });
        console.log("Alle Watermarks zurückgesetzt (voller Re-Sync).");
      }

      await runSyncCycle(db, tm);
      break;
    }

    case "rematch-places": {
      const result = await rematchPlaces(db);
      console.log(
        `Rematch fertig: ${result.drivesUpdated} drive(s), ` +
          `${result.chargesUpdated} charge(s), ${result.parksUpdated} park(s) aktualisiert.`,
      );
      break;
    }

    case "import-tessie": {
      let dir: string | undefined;
      for (let i = 0; i < args.length; i += 1) {
        const arg = args[i]!;
        if (arg === "--vehicle-id") {
          i += 1;
          continue;
        }
        if (!arg.startsWith("--")) {
          dir = arg;
          break;
        }
      }
      if (dir == null) {
        console.error("Verzeichnis fehlt: import-tessie <dir> [--vehicle-id N]");
        process.exit(1);
      }
      const vidIdx = args.indexOf("--vehicle-id");
      let vehicleId: number | undefined;
      if (vidIdx >= 0) {
        vehicleId = Number(args[vidIdx + 1]);
        if (!Number.isInteger(vehicleId)) {
          console.error(`Ungültige --vehicle-id: ${args[vidIdx + 1]}`);
          process.exit(1);
        }
      }
      await importTessie(db, dir, { vehicleId });
      break;
    }

    default:
      console.log(USAGE);
      process.exit(command ? 1 : 0);
  }

  process.exit(0);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
