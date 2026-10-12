import { z } from "zod";
import { npcDataSchema, type NpcData } from "@/lib/schemas/content-types/npc";

export const NPC_VERSION_MAX = 2_147_483_647;
export const npcVersionSchema = z.number().int().min(1).max(NPC_VERSION_MAX);
export const npcNameSchema = z.string().min(1).max(120).refine(value => value.trim().length > 0, "Name must contain text.");
export const NPC_EDITABLE_FIELDS = ["description", "occupation", "personality", "relationships"] as const;
export type NpcEditableField = typeof NPC_EDITABLE_FIELDS[number];
const feedback = z.strictObject({ status: z.enum(["idle", "error", "conflict", "uncertain"]), message: z.string().max(1_000).optional(),
  fieldErrors: z.record(z.string().max(100), z.array(z.string().max(200)).max(3)).refine(value => Object.keys(value).length <= 100).optional() });
export const npcActionStateSchema = z.union([feedback,
  z.strictObject({ status: z.literal("saved"), id: z.uuid(), version: npcVersionSchema, operation: z.enum(["create", "edit"]) }),
  z.strictObject({ status: z.literal("unchanged"), id: z.uuid(), version: npcVersionSchema, message: z.literal("No changes to save.") }),
]);
export type NpcActionState = z.infer<typeof npcActionStateSchema>;
export function npcUncertainty(mode: "create" | "edit"): NpcActionState {
  return { status: "uncertain", message: mode === "create"
    ? "The create could not be confirmed. Your draft is kept. Check Homebrew before creating again; this NPC may already have saved."
    : "The save could not be confirmed. Your draft is kept. Reload this NPC before saving again." };
}
export function npcJsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => npcJsonEqual(value, b[index]));
  if (a && b && typeof a === "object" && typeof b === "object") {
    const left = a as Record<string, unknown>, right = b as Record<string, unknown>, keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && npcJsonEqual(left[key], right[key]));
  }
  return false;
}
export function changedNpcFields(before: NpcData, after: NpcData): NpcEditableField[] {
  return NPC_EDITABLE_FIELDS.filter(key => !npcJsonEqual(before[key], after[key]));
}
type Mapped = { success: true; value: { name: string; data: NpcData; id?: string; expectedVersion?: number; changedFields: NpcEditableField[] } }
  | { success: false; fieldErrors: Record<string, string[]> };
export function mapNpcForm(form: FormData, mode: "create" | "edit"): Mapped {
  const keys = mode === "create" ? ["name", "npc_data"] : ["name", "npc_data", "id", "expected_version", "changed_fields"];
  const fields: Record<string, string> = {}, fieldErrors: Record<string, string[]> = {};
  for (const key of keys) {
    const all = form.getAll(key);
    if (all.length !== 1 || typeof all[0] !== "string") fieldErrors[key] = ["Submit exactly one text value."];
    else fields[key] = all[0];
  }
  if (Object.keys(fieldErrors).length) return { success: false, fieldErrors };
  if (keys.reduce((sum, key) => sum + new TextEncoder().encode(fields[key]).byteLength, 0) > 131_072) return { success: false, fieldErrors: { form: ["Combined controls exceed 128 KiB."] } };
  const name = npcNameSchema.safeParse(fields.name);
  if (!name.success) fieldErrors.name = ["Enter a nonblank name of at most 120 characters."];
  let raw: unknown;
  try { raw = JSON.parse(fields.npc_data); } catch { fieldErrors.npc_data = ["NPC control data is unreadable."]; }
  const parsed = npcDataSchema.safeParse(raw);
  if (!parsed.success) for (const issue of parsed.error.issues) {
    const path = issue.path.join(".") || "npc_data";
    // Edit identity and intent diagnostics are appended below. Reserve their
    // two keys so our own feedback never exceeds the strict action-state cap.
    if (Object.keys(fieldErrors).length >= (mode === "edit" ? 98 : 100) && !fieldErrors[path]) continue;
    const errors = fieldErrors[path] ??= []; if (errors.length < 3) errors.push(issue.message.slice(0, 200));
  }
  let id: string | undefined, expectedVersion: number | undefined, changedFields: NpcEditableField[] = [];
  if (mode === "edit") {
    const identity = z.object({ id: z.uuid(), version: z.string().regex(/^[1-9]\d{0,9}$/).transform(Number).pipe(npcVersionSchema) }).safeParse({ id: fields.id, version: fields.expected_version });
    if (!identity.success) fieldErrors.id = ["Invalid NPC identifier or version."]; else { id = identity.data.id; expectedVersion = identity.data.version; }
    let intent: unknown; try { intent = JSON.parse(fields.changed_fields); } catch { /* finite validation below */ }
    const changed = z.array(z.enum(NPC_EDITABLE_FIELDS)).max(4).refine(value => new Set(value).size === value.length).safeParse(intent);
    if (!changed.success) fieldErrors.changed_fields = ["Submit unique supported edit groups."]; else changedFields = changed.data;
  }
  if (Object.keys(fieldErrors).length || !name.success || !parsed.success) return { success: false, fieldErrors };
  // Validation only: do not serialize parser defaults/stripped clones into writes.
  return { success: true, value: { name: name.data, data: raw as NpcData, id, expectedVersion, changedFields } };
}
export function mergeNpcEdit(raw: unknown, draft: NpcData, intent: NpcEditableField[]): NpcData {
  npcDataSchema.parse(raw); npcDataSchema.parse(draft);
  if (intent.length !== new Set(intent).size || intent.some(key => !NPC_EDITABLE_FIELDS.includes(key))) throw Error("Invalid NPC edit intent");
  const original = raw as NpcData, merged = { ...original };
  for (const key of NPC_EDITABLE_FIELDS) {
    if (!intent.includes(key)) { if (!npcJsonEqual(original[key], draft[key])) throw Error("Undeclared NPC edit"); }
    else if (Object.hasOwn(draft, key)) Object.assign(merged, { [key]: draft[key] }); else delete merged[key];
  }
  npcDataSchema.parse(merged); return merged;
}
export function acceptNpcResponse(raw: unknown, mode: "create" | "edit", expected?: { id: string; version: number }): NpcActionState {
  const parsed = npcActionStateSchema.safeParse(raw); if (!parsed.success) return npcUncertainty(mode);
  const state = parsed.data;
  if (state.status === "idle") return npcUncertainty(mode);
  if (state.status === "saved" && (state.operation !== mode || (mode === "create" ? state.version !== 1 : !expected || state.id !== expected.id || state.version !== expected.version + 1))) return npcUncertainty(mode);
  if (state.status === "unchanged" && (mode !== "edit" || !expected || state.id !== expected.id || state.version !== expected.version)) return npcUncertainty(mode);
  if (state.status !== "saved" && state.status !== "unchanged" && (!state.message?.trim() || (mode === "create" && state.status === "conflict"))) return npcUncertainty(mode);
  return state;
}
