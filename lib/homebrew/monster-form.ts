import { z } from "zod";
import { monsterDataSchema, type MonsterData } from "@/lib/schemas/content-types/monster";

export const MONSTER_TRANSPORT_MAX_BYTES = 131_072;
export const MONSTER_EDITABLE_FIELDS = [
  "size", "creature_type", "alignment", "description", "armor_class", "hit_points", "speed", "ability_scores",
  "saving_throws", "skills", "senses", "senses_notes", "passive_perception", "languages", "languages_notes",
  "challenge", "damage_vulnerabilities", "damage_resistances", "damage_immunities", "damage_notes",
  "condition_immunities", "traits", "actions", "bonus_actions", "reactions", "legendary_actions", "lair_actions",
] as const;
export type MonsterEditableField = (typeof MONSTER_EDITABLE_FIELDS)[number];
export type MonsterFormState = { status: "idle" | "error" | "conflict"; message?: string; fieldErrors?: Record<string, string[]> };
export interface MonsterFormValue { name: string; data: MonsterData; id?: string; expectedVersion?: number; changedFields: MonsterEditableField[] }
type FormResult = { success: true; value: MonsterFormValue } | { success: false; fieldErrors: Record<string, string[]> };
export const monsterNameSchema = z.string().min(1).max(100).refine((value) => value.trim().length > 0, "Name is required.");

/** Compare JSON structurally, retaining significant array order and absence. */
export function monsterJsonEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right)
    && left.length === right.length && left.every((value, index) => monsterJsonEqual(value, right[index]));
  if (left && right && typeof left === "object" && typeof right === "object") {
    const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && monsterJsonEqual(a[key], b[key]));
  }
  return false;
}

export function changedMonsterFields(before: MonsterData, after: Record<string, unknown>): MonsterEditableField[] {
  return MONSTER_EDITABLE_FIELDS.filter((key) => !monsterJsonEqual(before[key], after[key]));
}

/** Relevant control bytes are counted cumulatively BEFORE either JSON parse.
 * Additional envelope claims are never used; React's action metadata is ignored. */
export function mapHomebrewMonsterFormData(form: FormData, mode: "create" | "edit"): FormResult {
  const keys = ["name", "monster_data", "changed_fields", "id", "expected_version"];
  const required = mode === "edit" ? keys : ["name", "monster_data"];
  const values: Record<string, string> = {};
  const fieldErrors: Record<string, string[]> = {};
  for (const key of keys) {
    const all = form.getAll(key);
    if (all.length > 1 || (all.length === 1 && typeof all[0] !== "string") || (required.includes(key) && all.length !== 1)) {
      fieldErrors[key] = ["Submit exactly one text value for this control."];
    } else values[key] = typeof all[0] === "string" ? all[0] : "";
  }
  if (Object.keys(fieldErrors).length) return { success: false, fieldErrors };
  const bytes = keys.reduce((sum, key) => sum + new TextEncoder().encode(values[key]).byteLength, 0);
  if (bytes > MONSTER_TRANSPORT_MAX_BYTES) return { success: false, fieldErrors: { form: ["The combined controls exceed the 128 KiB UTF-8 limit."] } };
  const name = monsterNameSchema.safeParse(values.name);
  if (!name.success) fieldErrors.name = name.error.issues.slice(0, 3).map((issue) => issue.message.slice(0, 200));
  let raw: unknown;
  try { raw = JSON.parse(values.monster_data); } catch { fieldErrors.monster_data = ["Monster data could not be read."]; }
  const data = monsterDataSchema.safeParse(raw);
  if (!data.success) for (const issue of data.error.issues) {
    const errors = fieldErrors[String(issue.path[0] ?? "monster_data")] ??= [];
    if (errors.length < 3) errors.push(issue.message.slice(0, 200));
  }
  let changedFields: MonsterEditableField[] = [], id: string | undefined, expectedVersion: number | undefined;
  if (mode === "edit") {
    const identity = z.object({ id: z.string().uuid(), version: z.string().regex(/^[1-9]\d{0,9}$/).transform(Number).pipe(z.number().int().min(1).max(2_147_483_647)) })
      .safeParse({ id: values.id, version: values.expected_version });
    if (!identity.success) fieldErrors.id = ["The monster identifier or version is invalid."];
    else { id = identity.data.id; expectedVersion = identity.data.version; }
    let intent: unknown;
    try { intent = JSON.parse(values.changed_fields); } catch { fieldErrors.changed_fields = ["Edit intent could not be read."]; }
    const changed = z.array(z.enum(MONSTER_EDITABLE_FIELDS)).max(MONSTER_EDITABLE_FIELDS.length)
      .refine((list) => new Set(list).size === list.length, "Each changed group must be declared once.").safeParse(intent);
    if (!changed.success) fieldErrors.changed_fields = ["Choose only unique editable groups."];
    else changedFields = changed.data;
  }
  if (Object.keys(fieldErrors).length || !name.success || !data.success) return { success: false, fieldErrors };
  return { success: true, value: { name: name.data, data: data.data, changedFields, id, expectedVersion } };
}

/** Raw groups, not stripped parser output, are used for unchanged data. */
export function mergeMonsterEdit(raw: unknown, draft: MonsterData, intent: MonsterEditableField[]): MonsterData {
  monsterDataSchema.parse(raw);
  monsterDataSchema.parse(draft);
  if (intent.length !== new Set(intent).size || intent.some((key) => !MONSTER_EDITABLE_FIELDS.includes(key))) throw new Error("Invalid edit intent.");
  const before = raw as MonsterData;
  const changed = new Set(intent);
  const merged = { ...before };
  for (const key of MONSTER_EDITABLE_FIELDS) {
    if (!changed.has(key)) {
      if (!monsterJsonEqual(before[key], draft[key])) throw new Error("A modified group is missing its edit intent.");
    } else if (Object.hasOwn(draft, key)) Object.assign(merged, { [key]: draft[key] });
    else delete merged[key];
  }
  monsterDataSchema.parse(merged);
  return merged;
}
