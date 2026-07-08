"use server";
import postgres from "postgres";
import { getTranslations } from "next-intl/server";
import { validateSession } from "../auth/session";

export interface TeslamateTestResult {
  ok: boolean;
  message: string;
}

/**
 * Optionaler read-only Verbindungstest gegen TESLAMATE_DATABASE_URL im
 * Web-Container (Settings → Diagnose). Im Normalbetrieb liest nur der Worker
 * die TeslaMate-DB — dieser Test ist rein zur Fehlersuche gedacht, deshalb
 * kurzer Timeout und genau eine read-only Zähl-Query.
 */
export async function testTeslamateConnection(): Promise<TeslamateTestResult> {
  const user = await validateSession();
  const t = await getTranslations("settings");
  if (!user) return { ok: false, message: t("errors.notAuthenticated") };

  const url = process.env.TESLAMATE_DATABASE_URL;
  if (!url) {
    return {
      ok: false,
      message: t("diagnostics.teslamateTest.envNotSetMessage"),
    };
  }

  let sql: postgres.Sql | undefined;
  try {
    sql = postgres(url, {
      max: 1,
      connect_timeout: 5,
      idle_timeout: 5,
      connection: { default_transaction_read_only: true },
    });
    const rows = await sql<{ count: number }[]>`select count(*)::int as count from drives`;
    const count = rows[0]?.count ?? 0;
    return {
      ok: true,
      message: t("diagnostics.teslamateTest.successMessage", {
        count: count.toLocaleString("de-DE"),
      }),
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : t("diagnostics.teslamateTest.unknownConnectionError"),
    };
  } finally {
    if (sql) await sql.end({ timeout: 1 });
  }
}
