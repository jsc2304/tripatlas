"use server";
import { revalidatePath } from "next/cache";
import { and, asc, eq, isNull, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import {
  auditLog,
  classificationRules,
  driveTags,
  drives,
  tags,
} from "@tripatlas/db";
import { findMatchingRule, isoWeekday } from "@tripatlas/core";
import { db } from "../db";
import { validateSession } from "../auth/session";
import { APP_TIMEZONE } from "../config";

export interface RuleFormResult {
  ok: boolean;
  error?: string;
  ruleId?: number;
}

// Regel-Klassifizierung als Aktion: 'unclassified' ist keine sinnvolle Aktion.
const classificationActionSchema = z.enum(["private", "business", "commute"]);

/** Schema pro Request neu gebaut, da die Fehlermeldungen übersetzt werden. */
function buildRuleInputSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().trim().min(1, t("errors.nameRequired")).max(200),
    priority: z.number().int().min(-1000).max(1000),
    startPlaceId: z.number().int().positive().nullable(),
    endPlaceId: z.number().int().positive().nullable(),
    weekdays: z.array(z.number().int().min(1).max(7)),
    classification: classificationActionSchema.nullable(),
    tagId: z.number().int().positive().nullable(),
    purpose: z.string().trim().max(200).nullable(),
    customer: z.string().trim().max(200).nullable(),
    project: z.string().trim().max(200).nullable(),
    enabled: z.boolean(),
  });
}

type RuleInput = z.infer<ReturnType<typeof buildRuleInputSchema>>;

function nullableString(value: FormDataEntryValue | null): string | null {
  if (value == null) return null;
  const str = String(value).trim();
  return str === "" ? null : str;
}

function optionalId(value: FormDataEntryValue | null): number | null {
  const str = value == null ? "" : String(value).trim();
  if (str === "") return null;
  const n = Number(str);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseRuleForm(formData: FormData, t: (key: string) => string) {
  const weekdays = [...new Set(formData.getAll("weekdays").map((v) => Number(v)))]
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
    .sort((a, b) => a - b);
  const classificationRaw = String(formData.get("classification") ?? "").trim();

  return buildRuleInputSchema(t).safeParse({
    name: formData.get("name"),
    priority: Number(formData.get("priority") ?? 0),
    startPlaceId: optionalId(formData.get("startPlaceId")),
    endPlaceId: optionalId(formData.get("endPlaceId")),
    weekdays,
    classification: classificationRaw === "" ? null : classificationRaw,
    tagId: optionalId(formData.get("tagId")),
    purpose: nullableString(formData.get("purpose")),
    customer: nullableString(formData.get("customer")),
    project: nullableString(formData.get("project")),
    enabled: formData.get("enabled") != null,
  });
}

/**
 * Validiert die im Schema dokumentierte Regel: mindestens eine Bedingung UND
 * mindestens eine Aktion. Gibt eine Fehlermeldung zurück oder null (ok).
 */
function validateRule(data: RuleInput, t: (key: string) => string): string | null {
  const hasCondition =
    data.startPlaceId != null ||
    data.endPlaceId != null ||
    data.weekdays.length > 0;
  if (!hasCondition) {
    return t("errors.conditionRequired");
  }
  const hasAction =
    data.classification != null ||
    data.tagId != null ||
    data.purpose != null ||
    data.customer != null ||
    data.project != null;
  if (!hasAction) {
    return t("errors.actionRequired");
  }
  return null;
}

function ruleValues(data: RuleInput) {
  return {
    name: data.name,
    priority: data.priority,
    enabled: data.enabled,
    startPlaceId: data.startPlaceId,
    endPlaceId: data.endPlaceId,
    weekdays: data.weekdays.length > 0 ? data.weekdays : null,
    classification: data.classification,
    tagId: data.tagId,
    purpose: data.purpose,
    customer: data.customer,
    project: data.project,
  };
}

export async function createRule(
  _prev: RuleFormResult,
  formData: FormData,
): Promise<RuleFormResult> {
  const user = await validateSession();
  const t = await getTranslations("rules");
  if (!user) return { ok: false, error: t("errors.notAuthenticated") };

  const parsed = parseRuleForm(formData, t);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? t("errors.invalidInput") };
  }
  const invalid = validateRule(parsed.data, t);
  if (invalid) return { ok: false, error: invalid };

  const ruleId = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(classificationRules)
      .values(ruleValues(parsed.data))
      .returning({ id: classificationRules.id });
    const id = inserted[0]!.id;
    await tx.insert(auditLog).values({
      entityType: "classification_rule",
      entityId: id,
      field: "created",
      oldValue: null,
      newValue: parsed.data.name,
      changedBy: user.username,
    });
    return id;
  });

  revalidatePath("/rules");
  return { ok: true, ruleId };
}

const updateRuleSchema = z.object({ id: z.number().int().positive() });

export async function updateRule(
  _prev: RuleFormResult,
  formData: FormData,
): Promise<RuleFormResult> {
  const user = await validateSession();
  const t = await getTranslations("rules");
  if (!user) return { ok: false, error: t("errors.notAuthenticated") };

  const idParsed = updateRuleSchema.safeParse({ id: Number(formData.get("id")) });
  if (!idParsed.success) return { ok: false, error: t("errors.invalidRuleId") };

  const parsed = parseRuleForm(formData, t);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? t("errors.invalidInput") };
  }
  const invalid = validateRule(parsed.data, t);
  if (invalid) return { ok: false, error: invalid };

  const existing = await db
    .select({ id: classificationRules.id })
    .from(classificationRules)
    .where(eq(classificationRules.id, idParsed.data.id))
    .limit(1);
  if (!existing[0]) return { ok: false, error: t("errors.ruleNotFound") };

  await db.transaction(async (tx) => {
    await tx
      .update(classificationRules)
      .set({ ...ruleValues(parsed.data), updatedAt: new Date() })
      .where(eq(classificationRules.id, idParsed.data.id));
    await tx.insert(auditLog).values({
      entityType: "classification_rule",
      entityId: idParsed.data.id,
      field: "updated",
      oldValue: null,
      newValue: parsed.data.name,
      changedBy: user.username,
    });
  });

  revalidatePath("/rules");
  return { ok: true, ruleId: idParsed.data.id };
}

const ruleIdSchema = z.object({ id: z.number().int().positive() });

export async function deleteRule(id: number): Promise<void> {
  const user = await validateSession();
  const t = await getTranslations("rules");
  if (!user) throw new Error(t("errors.notAuthenticated"));

  const parsed = ruleIdSchema.parse({ id });

  const rows = await db
    .select({ name: classificationRules.name })
    .from(classificationRules)
    .where(eq(classificationRules.id, parsed.id))
    .limit(1);
  if (!rows[0]) return;

  await db.transaction(async (tx) => {
    await tx
      .delete(classificationRules)
      .where(eq(classificationRules.id, parsed.id));
    await tx.insert(auditLog).values({
      entityType: "classification_rule",
      entityId: parsed.id,
      field: "deleted",
      oldValue: rows[0]!.name,
      newValue: null,
      changedBy: user.username,
    });
  });

  revalidatePath("/rules");
}

const toggleSchema = z.object({
  id: z.number().int().positive(),
  enabled: z.boolean(),
});

export async function toggleRule(id: number, enabled: boolean): Promise<void> {
  const user = await validateSession();
  const t = await getTranslations("rules");
  if (!user) throw new Error(t("errors.notAuthenticated"));

  const parsed = toggleSchema.parse({ id, enabled });

  const rows = await db
    .select({ enabled: classificationRules.enabled })
    .from(classificationRules)
    .where(eq(classificationRules.id, parsed.id))
    .limit(1);
  const current = rows[0];
  if (!current || current.enabled === parsed.enabled) return;

  await db.transaction(async (tx) => {
    await tx
      .update(classificationRules)
      .set({ enabled: parsed.enabled, updatedAt: new Date() })
      .where(eq(classificationRules.id, parsed.id));
    await tx.insert(auditLog).values({
      entityType: "classification_rule",
      entityId: parsed.id,
      field: "enabled",
      oldValue: String(current.enabled),
      newValue: String(parsed.enabled),
      changedBy: user.username,
    });
  });

  revalidatePath("/rules");
}

const prioritySchema = z.object({
  id: z.number().int().positive(),
  priority: z.number().int().min(-1000).max(1000),
});

export async function setRulePriority(
  id: number,
  priority: number,
): Promise<void> {
  const user = await validateSession();
  const t = await getTranslations("rules");
  if (!user) throw new Error(t("errors.notAuthenticated"));

  const parsed = prioritySchema.parse({ id, priority });

  const rows = await db
    .select({ priority: classificationRules.priority })
    .from(classificationRules)
    .where(eq(classificationRules.id, parsed.id))
    .limit(1);
  const current = rows[0];
  if (!current || current.priority === parsed.priority) return;

  await db.transaction(async (tx) => {
    await tx
      .update(classificationRules)
      .set({ priority: parsed.priority, updatedAt: new Date() })
      .where(eq(classificationRules.id, parsed.id));
    await tx.insert(auditLog).values({
      entityType: "classification_rule",
      entityId: parsed.id,
      field: "priority",
      oldValue: String(current.priority),
      newValue: String(parsed.priority),
      changedBy: user.username,
    });
  });

  revalidatePath("/rules");
}

export interface ApplyRulesResult {
  applied: number;
}

type RuleClassification = "unclassified" | "private" | "business" | "commute";

/**
 * Wendet alle aktiven Regeln sofort auf ALLE unklassifizierten Drives an
 * (kein Batch-Limit — user-initiiert). Teilt die reine Engine mit dem Worker
 * über @tripatlas/core; die DB-Schreiblogik ist bewusst dünn dupliziert, weil
 * apps/web nicht aus apps/worker importieren darf (MVP-Konvention).
 * Provenance-Marker classifiedByRuleId + Audit changedBy=`regel:${name}`
 * sind identisch zum Worker, damit die Herkunft eindeutig bleibt.
 */
export async function applyRulesNow(): Promise<ApplyRulesResult> {
  const user = await validateSession();
  const t = await getTranslations("rules");
  if (!user) throw new Error(t("errors.notAuthenticated"));

  const rules = await db
    .select({
      id: classificationRules.id,
      name: classificationRules.name,
      priority: classificationRules.priority,
      startPlaceId: classificationRules.startPlaceId,
      endPlaceId: classificationRules.endPlaceId,
      weekdays: classificationRules.weekdays,
      classification: classificationRules.classification,
      tagId: classificationRules.tagId,
      tagName: tags.name,
      purpose: classificationRules.purpose,
      customer: classificationRules.customer,
      project: classificationRules.project,
    })
    .from(classificationRules)
    .leftJoin(tags, eq(classificationRules.tagId, tags.id))
    .where(eq(classificationRules.enabled, true))
    .orderBy(asc(classificationRules.priority), asc(classificationRules.id));
  if (rules.length === 0) return { applied: 0 };

  const candidates = await db
    .select({
      id: drives.id,
      startTime: drives.startTime,
      classification: drives.classification,
      startPlaceId: drives.startPlaceId,
      endPlaceId: drives.endPlaceId,
      purpose: drives.purpose,
      customer: drives.customer,
      project: drives.project,
    })
    .from(drives)
    .where(
      and(
        eq(drives.classification, "unclassified"),
        isNull(drives.classifiedByRuleId),
        isNotNull(drives.endTime),
      ),
    )
    .orderBy(asc(drives.id));
  if (candidates.length === 0) return { applied: 0 };

  let applied = 0;
  await db.transaction(async (tx) => {
    for (const drive of candidates) {
      const rule = findMatchingRule(
        {
          startPlaceId: drive.startPlaceId,
          endPlaceId: drive.endPlaceId,
          weekdayIso: isoWeekday(drive.startTime, APP_TIMEZONE),
        },
        rules,
      );
      if (!rule) continue;

      const patch: Record<string, unknown> = {
        classifiedByRuleId: rule.id,
        updatedAt: new Date(),
      };
      const audits: {
        field: string;
        oldValue: string | null;
        newValue: string | null;
      }[] = [];

      const driveClassification = drive.classification as RuleClassification;
      if (rule.classification && rule.classification !== driveClassification) {
        patch.classification = rule.classification;
        audits.push({
          field: "classification",
          oldValue: driveClassification,
          newValue: rule.classification,
        });
      }
      for (const field of ["purpose", "customer", "project"] as const) {
        const value = rule[field];
        if (value != null && drive[field] == null) {
          patch[field] = value;
          audits.push({ field, oldValue: null, newValue: value });
        }
      }

      await tx.update(drives).set(patch).where(eq(drives.id, drive.id));

      if (rule.tagId != null) {
        const inserted = await tx
          .insert(driveTags)
          .values({ driveId: drive.id, tagId: rule.tagId })
          .onConflictDoNothing()
          .returning({ driveId: driveTags.driveId });
        if (inserted.length > 0) {
          audits.push({
            field: "tags",
            oldValue: null,
            newValue: rule.tagName ?? String(rule.tagId),
          });
        }
      }

      if (audits.length > 0) {
        await tx.insert(auditLog).values(
          audits.map((a) => ({
            entityType: "drive",
            entityId: drive.id,
            field: a.field,
            oldValue: a.oldValue,
            newValue: a.newValue,
            changedBy: `regel:${rule.name}`,
          })),
        );
      }

      applied++;
    }
  });

  revalidatePath("/rules");
  revalidatePath("/");
  revalidatePath("/day/[date]", "page");
  revalidatePath("/drives/[id]", "page");

  return { applied };
}
