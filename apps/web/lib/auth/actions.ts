"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { users } from "@tripatlas/db";
import { db } from "../db";
import { hashPassword, verifyPassword } from "./password";
import { createSession, destroySession } from "./session";

const ADMIN_USERNAME = "admin";

// In-memory rate limit: max 5 failed attempts per 15 minutes. Keyed by a
// constant (single-user app). Module-level Map survives across requests within
// a server process.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const failedAttempts = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const hits = (failedAttempts.get(key) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  failedAttempts.set(key, hits);
  return hits.length >= RATE_LIMIT_MAX;
}

function recordFailure(key: string): void {
  const hits = failedAttempts.get(key) ?? [];
  hits.push(Date.now());
  failedAttempts.set(key, hits);
}

function clearFailures(key: string): void {
  failedAttempts.delete(key);
}

/** Returns true when no user has been created yet (bootstrap state). */
export async function usersTableIsEmpty(): Promise<boolean> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users);
  return (rows[0]?.count ?? 0) === 0;
}

/**
 * Seeds the single admin user from INITIAL_ADMIN_PASSWORD if set and the users
 * table is empty. Idempotent. Returns true if a user now exists via this env.
 */
export async function maybeSeedFromEnv(): Promise<boolean> {
  const initial = process.env.INITIAL_ADMIN_PASSWORD;
  if (!initial || initial.length < 8) return false;
  if (!(await usersTableIsEmpty())) return false;
  const passwordHash = await hashPassword(initial);
  await db
    .insert(users)
    .values({ username: ADMIN_USERNAME, passwordHash })
    .onConflictDoNothing();
  return true;
}

type AuthT = Awaited<ReturnType<typeof getTranslations>>;

function passwordSchema(t: AuthT) {
  return z.string().min(8, t("passwordMinLength"));
}

// Bootstrap braucht ein zweites "Passwort wiederholen"-Feld: Passwortmanager
// haben das einzelne Feld beim Ersteinrichten teils falsch befüllt. Serverseitig
// hier gegengeprüft, clientseitig zusätzlich in LoginForm.tsx (freundlicher
// Fehler vor Submit).
function bootstrapPasswordSchema(t: AuthT) {
  return z
    .object({
      password: passwordSchema(t),
      passwordRepeat: z.string(),
    })
    .refine((v) => v.password === v.passwordRepeat, {
      message: t("passwordMismatch"),
      path: ["passwordRepeat"],
    });
}

export interface AuthResult {
  error?: string;
}

/**
 * Bootstrap action: creates the single admin user with the chosen password,
 * then logs in. Only valid while the users table is empty.
 */
export async function bootstrapAdmin(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const t = await getTranslations("auth");

  if (!(await usersTableIsEmpty())) {
    return { error: t("userAlreadyExists") };
  }

  const parsed = bootstrapPasswordSchema(t).safeParse({
    password: formData.get("password"),
    passwordRepeat: formData.get("passwordRepeat"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("invalidPassword") };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const inserted = await db
    .insert(users)
    .values({ username: ADMIN_USERNAME, passwordHash })
    .onConflictDoNothing()
    .returning({ id: users.id });

  const userId = inserted[0]?.id;
  if (!userId) {
    return { error: t("userCreationFailed") };
  }

  await createSession(userId);
  redirect("/");
}

/**
 * Normal login: password-only (username fixed to 'admin'). Rate-limited.
 */
export async function login(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const t = await getTranslations("auth");

  const rateKey = ADMIN_USERNAME;
  if (isRateLimited(rateKey)) {
    return { error: t("tooManyAttempts") };
  }

  const parsed = passwordSchema(t).safeParse(formData.get("password"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("invalidPassword") };
  }

  const rows = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.username, ADMIN_USERNAME))
    .limit(1);

  const user = rows[0];
  const ok = user
    ? await verifyPassword(user.passwordHash, parsed.data)
    : false;

  if (!ok || !user) {
    recordFailure(rateKey);
    return { error: t("wrongPassword") };
  }

  clearFailures(rateKey);
  await createSession(user.id);
  redirect("/");
}

/** Logout: destroys the session and returns to the login page. */
export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
