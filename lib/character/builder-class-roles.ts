import { z } from "zod";
import { effectSchema } from "@/lib/schemas/effects";
import { boundedClassRoleJson, classRoleRevisionSchema } from "./class-role-effects-schema";
import type { Effect } from "@/lib/types/effects";
import type { CharacterChoices } from "@/lib/types/character";

const object = z.record(z.string(), z.unknown());
const rawEffects = z.array(object).max(256).refine(value => z.array(effectSchema).safeParse(value).success);
const source = z.strictObject({ occurrence_id: z.uuid(), controller_ref_id: z.uuid(), content_id: z.uuid(),
  content_version: z.number().int().positive(), role: z.enum(["original", "secondary"]),
  raw_effects: rawEffects, evaluation_effects: rawEffects, raw_data: object, evaluation_data: object });
const projection = z.strictObject({ status: z.literal("available"), contract_version: z.literal(1), character_id: z.uuid(),
  system_id: z.uuid(), action_revision: classRoleRevisionSchema, original_occurrence_id: z.uuid(),
  source_order: z.array(z.uuid()).max(4096), class_sources: z.array(source).min(1).max(20) });

/** Separate server-read evidence. Immutable content snapshots stay unchanged. */
export type BuilderClassRole = z.infer<typeof source> & { action_revision: string };
export const builderClassRoleSchema = source.extend({ action_revision: classRoleRevisionSchema }).refine(boundedClassRoleJson);
export interface BuilderClassRoleRef {
  id?: string; character_id?: string; content_id?: string; content_version?: number;
  class_role?: BuilderClassRole;
  content_definitions?: { id?: string; slug?: string; version?: number; content_type?: string;
    data?: Record<string, unknown>; effects?: Effect[] } | null;
}
export type BuilderClassRoles = { status: "unavailable" } | { status: "available"; action_revision: string; original_occurrence_id: string };

const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
  : value !== null && typeof value === "object" ? `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}` : JSON.stringify(value) ?? "undefined";

/** Parse the owner/session-checked SQL projection and pair it with exact loaded
 * source tuples and the same observed parent revision. This never establishes
 * a role from array position, a mutable catalog row, or a caller selection. */
export function attachBuilderClassRoles<T extends BuilderClassRoleRef>(refs: T[], raw: unknown, parent: {
  id: string; system_id: string; action_revision: string; choices: CharacterChoices;
}): { refs: T[]; classRoles: BuilderClassRoles } {
  const unavailable = { refs, classRoles: { status: "unavailable" as const } };
  if (!boundedClassRoleJson(raw)) return unavailable;
  const parsed = projection.safeParse(raw);
  if (!parsed.success) return unavailable;
  const value = parsed.data, classes = parent.choices.classes ?? [], pins = refs.filter(ref => ref.content_definitions?.content_type === "class");
  if (value.character_id !== parent.id || value.system_id !== parent.system_id || value.action_revision !== parent.action_revision
    || value.source_order.length !== refs.length || new Set(value.source_order).size !== refs.length
    || refs.some(ref => !ref.id || !value.source_order.includes(ref.id) || ref.character_id !== parent.id)
    || classes.length !== pins.length || classes.length !== value.class_sources.length
    || new Set(classes.map(cls => cls.slug)).size !== classes.length
    || new Set(classes.map(cls => cls.occurrence_id)).size !== classes.length
    || new Set(value.class_sources.map(row => row.occurrence_id)).size !== classes.length
    || new Set(value.class_sources.map(row => row.controller_ref_id)).size !== pins.length
    || value.class_sources.filter(row => row.role === "original" && row.occurrence_id === value.original_occurrence_id).length !== 1
    || value.class_sources.some(row => row.role === "original" && row.occurrence_id !== value.original_occurrence_id)) return unavailable;
  for (const row of value.class_sources) {
    const pin = pins.find(ref => ref.id === row.controller_ref_id), definition = pin?.content_definitions;
    const choice = classes.find(cls => cls.occurrence_id === row.occurrence_id);
    if (!pin || !definition || !choice || choice.slug !== definition.slug || pin.content_id !== row.content_id
      || pin.content_version !== row.content_version || definition.id !== row.content_id || definition.version !== row.content_version
      || canonical(definition.effects ?? []) !== canonical(row.raw_effects) || canonical(definition.data ?? {}) !== canonical(row.raw_data)) return unavailable;
  }
  const byId = new Map(value.class_sources.map(row => [row.controller_ref_id, row]));
  // Preserve the database producer's explicit order, including nonclass refs.
  const ordered = value.source_order.map(id => refs.find(ref => ref.id === id)!);
  return { refs: ordered.map(ref => byId.has(ref.id!) ? { ...ref,
    class_role: { ...byId.get(ref.id!)!, action_revision: value.action_revision } } : ref),
  classRoles: { status: "available", action_revision: value.action_revision, original_occurrence_id: value.original_occurrence_id } };
}

/** Projection metadata is accepted only for its exact immutable pin and saved
 * occurrence. A missing multiclass role never admits full starting grants. */
export function classRoleForRef(ref: BuilderClassRoleRef, choices: CharacterChoices): BuilderClassRole | undefined {
  const role = ref.class_role, definition = ref.content_definitions;
  return role && definition?.content_type === "class" && ref.id === role.controller_ref_id && ref.content_id === role.content_id
    && ref.content_version === role.content_version && definition.id === role.content_id && definition.version === role.content_version
    && choices.classes?.some(cls => cls.slug === definition.slug && cls.occurrence_id === role.occurrence_id)
    && canonical(definition.effects ?? []) === canonical(role.raw_effects) && canonical(definition.data ?? {}) === canonical(role.raw_data) ? role : undefined;
}

export function classRoleEvaluationRef<T extends BuilderClassRoleRef>(ref: T, choices: CharacterChoices): T {
  if (ref.content_definitions?.content_type !== "class") return ref;
  const role = classRoleForRef(ref, choices);
  if (role) return { ...ref, content_definitions: { ...ref.content_definitions,
    effects: role.evaluation_effects as unknown as Effect[], data: role.evaluation_data } };
  // Existing single-class saves retain the earlier supported reader. Enrolled
  // multiclass source roles require complete native evidence.
  if ((choices.classes?.length ?? 0) > 1) return { ...ref, content_definitions: { ...ref.content_definitions,
    effects: [], data: { ...ref.content_definitions.data, starting_proficiencies: [], skills: [], toolProfs: [],
      armor_proficiencies: [], weapon_proficiencies: [], saving_throws: [] } } };
  return ref;
}

export function originalClassOccurrence(refs: readonly BuilderClassRoleRef[], choices: CharacterChoices): string | undefined {
  const roles = refs.flatMap(ref => { const role = classRoleForRef(ref, choices); return role ? [role] : []; });
  return roles.length === choices.classes?.length && roles.filter(role => role.role === "original").length === 1
    ? roles.find(role => role.role === "original")!.occurrence_id : undefined;
}
