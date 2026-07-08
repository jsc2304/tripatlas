"use server";
import { revalidatePath } from "next/cache";
import { eq, ne, and } from "drizzle-orm";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { auditLog, sessions, syncState, users, vehicles } from "@tripatlas/db";
import { db } from "../db";
import { validateSession } from "../auth/session";
import { hashPassword, verifyPassword } from "../auth/password";
import { SESSION_COOKIE } from "../config";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";

export interface ResyncResult {
  ok: boolean;
  error?: string;
}

/**
 * Resets all sync_state watermarks to NULL, forcing a full re-scan on the
 * worker's next tick (≤60s). The web app cannot import or invoke worker code
 * directly (separate deployable) — this is the MVP-simple way to trigger a
 * full resync from the UI.
 */
export async function resetSyncWatermarks(): Promise<ResyncResult> {
  const user = await validateSession();
  const t = await getTranslations("settings");
  if (!user) return { ok: false, error: t("errors.notAuthenticated") };

  await db.update(syncState).set({ watermarkTs: null });

  revalidatePath("/settings");
  return { ok: true };
}

export interface PasswordChangeResult {
  ok: boolean;
  error?: string;
}

/**
 * Changes the current user's password: verifies the current password with
 * argon2, hashes and stores the new one, and destroys all OTHER sessions
 * (keeps the current session alive so the user isn't logged out).
 */
export async function changePassword(
  _prev: PasswordChangeResult,
  formData: FormData,
): Promise<PasswordChangeResult> {
  const user = await validateSession();
  const t = await getTranslations("settings");
  if (!user) return { ok: false, error: t("errors.notAuthenticated") };

  const passwordChangeSchema = z
    .object({
      currentPassword: z.string().min(1, t("errors.currentPasswordRequired")),
      newPassword: z.string().min(8, t("errors.newPasswordMinLength")),
      newPasswordRepeat: z.string(),
    })
    .refine((v) => v.newPassword === v.newPasswordRepeat, {
      message: t("errors.passwordsMismatch"),
      path: ["newPasswordRepeat"],
    });

  const parsed = passwordChangeSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    newPasswordRepeat: formData.get("newPasswordRepeat"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? t("errors.invalidInput") };
  }

  const rows = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  const current = rows[0];
  if (!current) return { ok: false, error: t("errors.userNotFound") };

  const ok = await verifyPassword(current.passwordHash, parsed.data.currentPassword);
  if (!ok) return { ok: false, error: t("errors.currentPasswordWrong") };

  const newHash = await hashPassword(parsed.data.newPassword);

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const currentSessionId = token
    ? createHash("sha256").update(token).digest("hex")
    : null;

  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));

    // Destroy all OTHER sessions for this user; keep the current one alive.
    if (currentSessionId) {
      await tx
        .delete(sessions)
        .where(and(eq(sessions.userId, user.id), ne(sessions.id, currentSessionId)));
    } else {
      await tx.delete(sessions).where(eq(sessions.userId, user.id));
    }
  });

  return { ok: true };
}

const efficiencyOverrideSchema = z.object({
  vehicleId: z.coerce.number().int().positive(),
  // Eingabe in Wh/km (intuitiver), leer = Override entfernen. Plausibel 80–400.
  whPerKm: z
    .union([z.literal(""), z.coerce.number().min(80).max(400)])
    .transform((v) => (v === "" ? null : v)),
});

export interface EfficiencyOverrideResult {
  ok: boolean;
  error?: string;
}

/**
 * Setzt/entfernt den Effizienz-Fallback (Vision §15.3). Greift nur, solange
 * TeslaMate die Effizienz noch nicht aus Ladevorgängen gelernt hat. Resettet
 * die Drive-Watermark, damit der Worker alle Fahrten rückwirkend neu rechnet.
 */
export async function updateEfficiencyOverride(
  _prev: EfficiencyOverrideResult,
  formData: FormData,
): Promise<EfficiencyOverrideResult> {
  const user = await validateSession();
  const t = await getTranslations("settings");
  if (!user) return { ok: false, error: t("errors.notAuthenticated") };

  const parsed = efficiencyOverrideSchema.safeParse({
    vehicleId: formData.get("vehicleId"),
    whPerKm: formData.get("whPerKm") ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? t("errors.invalidEfficiencyValue"),
    };
  }

  const kwhPerKm = parsed.data.whPerKm != null ? parsed.data.whPerKm / 1000 : null;

  const before = await db
    .select({ old: vehicles.efficiencyOverrideKwhPerKm })
    .from(vehicles)
    .where(eq(vehicles.id, parsed.data.vehicleId));

  await db
    .update(vehicles)
    .set({ efficiencyOverrideKwhPerKm: kwhPerKm })
    .where(eq(vehicles.id, parsed.data.vehicleId));

  await db.insert(auditLog).values({
    entityType: "vehicle",
    entityId: parsed.data.vehicleId,
    field: "efficiency_override_kwh_per_km",
    oldValue: before[0]?.old != null ? String(before[0].old) : null,
    newValue: kwhPerKm != null ? String(kwhPerKm) : null,
    changedBy: user.username,
  });

  // Rückwirkende Neuberechnung durch den Worker anstoßen.
  await db
    .update(syncState)
    .set({ watermarkTs: null })
    .where(and(eq(syncState.source, "teslamate"), eq(syncState.entity, "drives")));

  revalidatePath("/settings");
  return { ok: true };
}
