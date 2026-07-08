"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { tags } from "@tripatlas/db";
import { db } from "../db";
import { validateSession } from "../auth/session";
import { TAG_COLOR_PRESETS } from "../tagColors";

export interface TagFormResult {
  ok: boolean;
  error?: string;
}

type Translator = Awaited<ReturnType<typeof getTranslations>>;

// Built per-request (not module-level constants) since the validation
// messages come from next-intl's `getTranslations`, only available inside an
// async request/action context.
function buildNameSchema(t: Translator) {
  return z.string().trim().min(1, t("errors.nameRequired")).max(100);
}
function buildColorSchema(t: Translator) {
  return z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, t("errors.invalidColor"));
}

function nullableString(value: FormDataEntryValue | null): string | null {
  if (value == null) return null;
  const str = String(value).trim();
  return str === "" ? null : str;
}

/**
 * Creates a new tag (metadata only — no audit logging; tags themselves are
 * not user-owned drive data, only their assignments are).
 */
export async function createTag(
  _prev: TagFormResult,
  formData: FormData,
): Promise<TagFormResult> {
  const t = await getTranslations("tags");
  const user = await validateSession();
  if (!user) return { ok: false, error: t("errors.notAuthenticated") };

  const nameParsed = buildNameSchema(t).safeParse(formData.get("name"));
  if (!nameParsed.success) {
    return { ok: false, error: nameParsed.error.issues[0]?.message ?? t("errors.invalidName") };
  }
  const colorRaw = nullableString(formData.get("color")) ?? TAG_COLOR_PRESETS[0];
  const colorParsed = buildColorSchema(t).safeParse(colorRaw);
  const color = colorParsed.success ? colorParsed.data : TAG_COLOR_PRESETS[0];
  const category = nullableString(formData.get("category"));

  const existing = await db
    .select({ id: tags.id })
    .from(tags)
    .where(eq(tags.name, nameParsed.data))
    .limit(1);
  if (existing[0]) {
    return { ok: false, error: t("errors.nameTaken") };
  }

  await db.insert(tags).values({ name: nameParsed.data, color, category });

  revalidatePath("/tags");
  return { ok: true };
}

/** Renames a tag. */
export async function renameTag(tagId: number, name: string): Promise<void> {
  const t = await getTranslations("tags");
  const user = await validateSession();
  if (!user) throw new Error(t("errors.notAuthenticated"));

  const renameSchema = z.object({
    tagId: z.number().int().positive(),
    name: buildNameSchema(t),
  });
  const parsed = renameSchema.parse({ tagId, name });

  const existing = await db
    .select({ id: tags.id })
    .from(tags)
    .where(eq(tags.name, parsed.name))
    .limit(1);
  if (existing[0] && existing[0].id !== parsed.tagId) {
    throw new Error(t("errors.nameTaken"));
  }

  await db
    .update(tags)
    .set({ name: parsed.name, updatedAt: new Date() })
    .where(eq(tags.id, parsed.tagId));

  revalidatePath("/tags");
}

/** Sets a tag's color. */
export async function setTagColor(tagId: number, color: string): Promise<void> {
  const t = await getTranslations("tags");
  const user = await validateSession();
  if (!user) throw new Error(t("errors.notAuthenticated"));

  const colorUpdateSchema = z.object({
    tagId: z.number().int().positive(),
    color: buildColorSchema(t),
  });
  const parsed = colorUpdateSchema.parse({ tagId, color });

  await db
    .update(tags)
    .set({ color: parsed.color, updatedAt: new Date() })
    .where(eq(tags.id, parsed.tagId));

  revalidatePath("/tags");
}

const categorySchema = z.object({
  tagId: z.number().int().positive(),
  category: z.string().trim().max(100).nullable(),
});

/** Sets a tag's category (free text, may be cleared to null). */
export async function setTagCategory(
  tagId: number,
  category: string | null,
): Promise<void> {
  const t = await getTranslations("tags");
  const user = await validateSession();
  if (!user) throw new Error(t("errors.notAuthenticated"));

  const parsed = categorySchema.parse({
    tagId,
    category: category?.trim() === "" ? null : category,
  });

  await db
    .update(tags)
    .set({ category: parsed.category, updatedAt: new Date() })
    .where(eq(tags.id, parsed.tagId));

  revalidatePath("/tags");
}

const deleteSchema = z.object({ tagId: z.number().int().positive() });

/** Deletes a tag. Assignments cascade via FK (drive_tags, charge_session_tags). */
export async function deleteTag(tagId: number): Promise<void> {
  const t = await getTranslations("tags");
  const user = await validateSession();
  if (!user) throw new Error(t("errors.notAuthenticated"));

  const parsed = deleteSchema.parse({ tagId });

  await db.delete(tags).where(eq(tags.id, parsed.tagId));

  revalidatePath("/tags");
  revalidatePath("/day/[date]", "page");
}
