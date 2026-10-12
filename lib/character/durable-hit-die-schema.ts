import { z } from "zod";
import { effectSchema } from "@/lib/schemas/effects";
import { activeEffectSchema } from "@/lib/schemas/active-effects";
import { systemSchemaDefinitionSchema } from "@/lib/schemas/system";
import { getContentTypeSchema } from "@/lib/schemas/content-types";

export const HIT_DIE_CONTRACT_VERSION = 1 as const;
export const MAX_ACTION_REVISION = "9223372036854775807" as const;
const MAX_REVISION = BigInt(MAX_ACTION_REVISION);
export const actionRevisionSchema = z.string().regex(/^(0|[1-9][0-9]*)$/).max(19)
  .refine(value => /^(0|[1-9][0-9]*)$/.test(value) && value.length <= 19 && BigInt(value) <= MAX_REVISION, "Revision exceeds PostgreSQL bigint");
export const instantSchema = z.iso.datetime({ precision: 3 });
const jsonObject = z.record(z.string(), z.json());
export const hpRuleSchema = z.enum(["free_choice", "average_only", "rolled_only", "max_first_level_each_class", "max_for_all"]);
const slugSchema = z.string().min(1).max(200);
export const hitDieRequestSchema = z.strictObject({
  contract_version: z.literal(HIT_DIE_CONTRACT_VERSION),
  character_id: z.uuid(),
  operation_id: z.uuid(),
  command: z.literal("spend_hit_die"),
  class_slug: slugSchema,
  expected_revision: actionRevisionSchema,
  dependency_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
});
export type HitDieRequest = z.infer<typeof hitDieRequestSchema>;

// Validate existing effects without dropping source fields from fingerprints.
const effectsSchema = z.array(jsonObject).superRefine((effects, context) => {
  if (!z.array(effectSchema).safeParse(effects).success) {
    context.addIssue({ code: "custom", message: "Invalid resolved effects" });
  }
});
const definitionSchema = z.strictObject({
  id: z.uuid(), version: z.number().int().positive(), system_id: z.uuid(),
  content_type: z.enum(["class", "subclass", "race", "subrace", "trait", "language", "proficiency", "feature", "feat", "background", "spell", "weapon", "armor", "item", "magic_item"]),
  slug: slugSchema, name: z.string().min(1), data: jsonObject, effects: effectsSchema,
  source: z.enum(["srd", "homebrew", "imported"]), scope: z.enum(["platform", "personal", "shared"]),
  owner_id: z.uuid().nullable(),
}).superRefine((definition, context) => {
  if (!getContentTypeSchema(definition.content_type)?.safeParse(definition.data).success) {
    context.addIssue({ code: "custom", message: "Resolved content data is unreadable" });
  }
});
const pinSchema = z.strictObject({
  id: z.uuid(), character_id: z.uuid(), content_id: z.uuid(), content_version: z.number().int().positive(),
  context: jsonObject, choice_source: z.string().nullable(), resolved: definitionSchema,
});
const classesSchema = z.array(z.strictObject({
  slug: slugSchema, level: z.number().int().min(1).max(20), subclass: slugSchema.optional(),
})).min(1);
const choicesSchema = z.object({
  classes: classesSchema,
  hp_rolls: z.record(z.string(), z.strictObject({ method: z.enum(["average", "rolled", "manual"]), value: z.number().int().positive() })),
}).catchall(z.json());
const stateSchema = jsonObject.superRefine((state, context) => {
  const parsed = z.object({
    current_hp: z.number().int().nonnegative(),
    hit_dice_spent: z.record(z.string(), z.number().int().nonnegative()),
    death_saves: z.strictObject({ successes: z.number().int().min(0).max(3), failures: z.number().int().min(0).max(3) }).optional(),
    active_effects: z.array(activeEffectSchema).optional(),
  }).safeParse(state);
  if (!parsed.success) context.addIssue({ code: "custom", message: "Explicit valid HP, spent dice and active-effect state required" });
});
const systemRulesSchema = jsonObject.superRefine((rules, context) => {
  if (!systemSchemaDefinitionSchema.safeParse(rules).success ||
    (rules.hp_rule !== undefined && !hpRuleSchema.safeParse(rules.hp_rule).success)) {
    context.addIssue({ code: "custom", message: "Invalid system rules" });
  }
});
const inventorySchema = z.strictObject({
  id: z.uuid(), character_id: z.uuid(), content_id: z.uuid().nullable(), content_version: z.number().int().positive().nullable(),
  content_type: slugSchema, equipped: z.boolean(), attuned: z.boolean(), quantity: z.number().int().nonnegative(),
  sort_order: z.number().int(), custom_data: jsonObject.nullable(), resolved: definitionSchema.nullable(),
});

/** Service-internal complete DTO, not browser authority or a PostgREST schema.
 * Access/grant rows are opaque JSON here: their authority/locking is a future
 * resolver responsibility. Presence does not certify freshness or permission. */
export const hitDieSnapshotSchema = z.strictObject({
  contract_version: z.literal(HIT_DIE_CONTRACT_VERSION),
  character: z.strictObject({
    id: z.uuid(), owner_id: z.uuid(), system_id: z.uuid(), campaign_id: z.uuid().nullable(),
    archived: z.boolean(), revision: actionRevisionSchema, level: z.number().int().min(1).max(20),
    base_stats: z.record(z.string(), z.number().finite()), choices: choicesSchema, state: stateSchema,
  }),
  system: z.strictObject({ id: z.uuid(), slug: z.literal("dnd-5e-2014"), schema_definition: systemRulesSchema, expression_context: jsonObject }),
  campaign: z.strictObject({ id: z.uuid(), hp_rule: hpRuleSchema.nullable() }).nullable(),
  pins: z.array(pinSchema), inventory: z.array(inventorySchema),
  feature_grants: z.array(jsonObject), spell_grants: z.array(jsonObject), spells: z.array(jsonObject), access_rows: z.array(jsonObject),
}).superRefine((snapshot, context) => {
  const fail = (message: string) => context.addIssue({ code: "custom", message });
  const character = snapshot.character;
  if (character.system_id !== snapshot.system.id || character.campaign_id !== (snapshot.campaign?.id ?? null)) fail("Character dependency identity mismatch");
  if (!Object.hasOwn(character.base_stats, "constitution")) fail("Constitution baseline unresolved");
  const classSlugs = character.choices.classes.map(entry => entry.slug);
  if (new Set(classSlugs).size !== classSlugs.length || character.choices.classes.reduce((sum, entry) => sum + entry.level, 0) !== character.level) fail("Ambiguous or mismatched class levels");
  if (new Set(snapshot.pins.map(pin => pin.id)).size !== snapshot.pins.length) fail("Duplicate pin identity");
  for (const pin of snapshot.pins) {
    if (pin.character_id !== character.id || pin.content_id !== pin.resolved.id || pin.content_version !== pin.resolved.version || pin.resolved.system_id !== character.system_id) fail("Resolved pin identity/version mismatch");
    if (pin.resolved.content_type === "class" && !classSlugs.includes(pin.resolved.slug)) fail("Unselected class pin");
  }
  for (const cls of character.choices.classes) {
    const matching = snapshot.pins.filter(pin => pin.resolved.content_type === "class" && pin.resolved.slug === cls.slug);
    if (matching.length !== 1 || !z.number().int().min(1).max(1000).safeParse(matching[0]?.resolved.data.hit_die).success) fail("Class pin or explicit hit die unresolved/ambiguous");
    const spent = character.state.hit_dice_spent;
    if (spent === null || typeof spent !== "object" || Array.isArray(spent) || !Object.hasOwn(spent, cls.slug)) fail("Class spent count unresolved");
  }
  for (const [key, record] of Object.entries(character.choices.hp_rolls ?? {})) {
    const cls = character.choices.classes.find(entry => key.startsWith(`${entry.slug}-`) && /^[1-9][0-9]*$/.test(key.slice(entry.slug.length + 1)));
    const level = cls ? Number(key.slice(cls.slug.length + 1)) : 0;
    const die = snapshot.pins.find(pin => pin.resolved.content_type === "class" && pin.resolved.slug === cls?.slug)?.resolved.data.hit_die;
    if (!cls || level > cls.level || typeof die !== "number" || record.value > die) fail("HP history does not match pinned class levels/die");
  }
  if (new Set(snapshot.inventory.map(item => item.id)).size !== snapshot.inventory.length) fail("Duplicate inventory identity");
  for (const item of snapshot.inventory) {
    if (item.character_id !== character.id) fail("Inventory character mismatch");
    if (item.content_id === null) {
      if (item.content_version !== null || item.resolved !== null) fail("Custom inventory has forged source");
    } else if (!item.resolved || item.content_id !== item.resolved.id || item.content_version !== item.resolved.version || item.resolved.system_id !== character.system_id || item.content_type !== item.resolved.content_type) fail("Inventory source unresolved/mismatched");
  }
});
export type HitDieSnapshot = z.infer<typeof hitDieSnapshotSchema>;

const rollSchema = z.strictObject({
  request: z.strictObject({ kind: z.literal("hit_die"), label: z.string().min(1), expression: z.string().min(1), meta: jsonObject }),
  groups: z.array(z.strictObject({ sides: z.number().int().positive(), rolls: z.array(z.number().int().positive()).length(1), kept: z.array(z.number().int().positive()).length(1) })).length(1),
  modifier: z.number().int(), total: z.number().int(), rolled_at: instantSchema,
});
export const hitDiePlanResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("disabled") }),
  z.strictObject({ status: z.literal("rejected"), reason: z.enum(["invalid_snapshot", "invalid_request", "identity_changed", "stale_snapshot", "unavailable", "full_hp", "no_dice", "invalid_mechanics", "expired_plan"]) }),
  z.strictObject({
    status: z.literal("planned"), request: hitDieRequestSchema, canonical_intent: z.string(),
    dependency_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    baseline_constitution: z.number().int(), live_constitution: z.number().int(), max_hp: z.number().int().positive(),
    evaluated_at: instantSchema, acceptance_checked_at: instantSchema, valid_until: instantSchema.nullable(),
    roll: rollSchema,
    patch: z.strictObject({ current_hp: z.number().int().nonnegative(), hit_dice_spent: z.record(z.string(), z.number().int().nonnegative()), death_saves: z.strictObject({ successes: z.literal(0), failures: z.literal(0) }).optional() }),
  }),
]).superRefine((result, context) => {
  if (result.status !== "planned") return;
  const group = result.roll.groups[0];
  const face = group.rolls[0];
  const modifier = Math.floor((result.live_constitution - 10) / 2);
  const suffix = modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : "";
  if (face > group.sides || group.kept[0] !== face || result.roll.modifier !== modifier || result.roll.total !== face + modifier ||
    result.roll.request.expression !== `1d${group.sides}${suffix}` || result.roll.request.meta.class_slug !== result.request.class_slug ||
    result.roll.request.meta.con_mod !== modifier || result.roll.rolled_at !== result.evaluated_at || result.dependency_fingerprint !== result.request.dependency_fingerprint ||
    result.patch.current_hp > result.max_hp || Date.parse(result.acceptance_checked_at) < Date.parse(result.evaluated_at) ||
    (result.valid_until !== null && (Date.parse(result.valid_until) <= Date.parse(result.acceptance_checked_at)))) {
    context.addIssue({ code: "custom", message: "Inconsistent hit-die candidate result" });
  }
});
export type HitDiePlanResult = z.infer<typeof hitDiePlanResultSchema>;
