import { z } from "zod";
import { CREATURE_SIZES, DAMAGE_TYPES, VISION_TYPES } from "@/lib/types/taxonomies";

export const MONSTER_PAYLOAD_MAX_BYTES = 65_536;
export const MONSTER_ABILITIES = [
  "strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma",
] as const;
export const MONSTER_MOVEMENT_MODES = ["walk", "fly", "swim", "climb", "burrow", "encumbered"] as const;

const text = (maximum: number) => z.string().min(1).max(maximum)
  .refine((value) => value.trim().length > 0, "Text must contain a non-whitespace character");
const integer = (minimum: number, maximum: number) => z.number().int().min(minimum).max(maximum);
const score = () => integer(1, 30);
const bonus = () => integer(-100, 100);
const distance = () => integer(0, 10_000);

const abilityScoresSchema = z.strictObject({
  strength: score(), dexterity: score(), constitution: score(),
  intelligence: score(), wisdom: score(), charisma: score(),
});
const savingThrowsSchema = z.strictObject({
  strength: bonus().optional(), dexterity: bonus().optional(), constitution: bonus().optional(),
  intelligence: bonus().optional(), wisdom: bonus().optional(), charisma: bonus().optional(),
}).refine((value) => MONSTER_ABILITIES.some((ability) => value[ability] !== undefined), "Declare at least one saving throw");

const movementSchema = z.strictObject({
  walk: distance().optional(), fly: distance().optional(), swim: distance().optional(),
  climb: distance().optional(), burrow: distance().optional(), encumbered: distance().optional(),
  hover: z.boolean().optional(), notes: text(500).optional(),
}).superRefine((value, context) => {
  if (!MONSTER_MOVEMENT_MODES.some((mode) => value[mode] !== undefined)) {
    context.addIssue({ code: "custom", message: "Declare at least one movement mode" });
  }
  if (value.hover !== undefined && value.fly === undefined) {
    context.addIssue({ code: "custom", path: ["hover"], message: "Hover requires a declared fly speed" });
  }
});

const attackSchema = z.strictObject({
  kind: z.enum(["melee", "ranged", "melee_or_ranged"]),
  attack_type: z.enum(["weapon", "spell"]),
  bonus: bonus(),
  reach: distance().optional(),
  range: z.strictObject({ normal: integer(1, 10_000), long: integer(1, 10_000).optional() }).optional(),
  target: text(200).optional(),
}).superRefine((value, context) => {
  if (value.kind !== "ranged" && value.reach === undefined) {
    context.addIssue({ code: "custom", path: ["reach"], message: "Melee attacks require declared reach" });
  }
  if (value.kind !== "melee" && value.range === undefined) {
    context.addIssue({ code: "custom", path: ["range"], message: "Ranged attacks require declared range" });
  }
  if (value.kind === "melee" && value.range !== undefined) {
    context.addIssue({ code: "custom", path: ["range"], message: "A melee-only attack cannot declare range" });
  }
  if (value.kind === "ranged" && value.reach !== undefined) {
    context.addIssue({ code: "custom", path: ["reach"], message: "A ranged-only attack cannot declare reach" });
  }
  if (value.range?.long !== undefined && value.range.long < value.range.normal) {
    context.addIssue({ code: "custom", path: ["range", "long"], message: "Long range cannot be shorter than normal range" });
  }
});

const damageSchema = z.strictObject({
  type: z.enum(DAMAGE_TYPES), average: integer(0, 1_000_000).optional(),
  roll_text: text(120).optional(), notes: text(500).optional(),
}).refine((value) => value.average !== undefined || value.roll_text !== undefined, "Declare damage average or display roll text");

const namedEntryShape = { name: text(120), description: text(4_000) };
const ruleEntryShape = {
  ...namedEntryShape,
  attack: attackSchema.optional(),
  saving_throw: z.strictObject({
    ability: z.enum(MONSTER_ABILITIES), dc: integer(0, 100), on_success: text(500).optional(),
  }).optional(),
  damage: z.array(damageSchema).min(1).max(8).optional(),
};
const namedEntrySchema = z.strictObject(namedEntryShape);
const ruleEntrySchema = z.strictObject(ruleEntryShape);
const legendaryEntrySchema = z.strictObject({ ...ruleEntryShape, cost: integer(1, 20).optional() });
const legendarySchema = z.strictObject({
  description: text(4_000).optional(), actions_per_round: integer(1, 20).optional(),
  entries: z.array(legendaryEntrySchema).min(1).max(30),
}).superRefine((value, context) => {
  const count = value.actions_per_round;
  if (count === undefined) return;
  value.entries.forEach((entry, index) => {
    if (entry.cost !== undefined && entry.cost > count) {
      context.addIssue({ code: "custom", path: ["entries", index, "cost"], message: "Cost cannot exceed the declared actions per round" });
    }
  });
});
const damageTypes = () => z.array(z.enum(DAMAGE_TYPES)).max(13).optional();

/** Format-one declared stat block. No defaults, coercion, formula evaluation or gameplay state. */
export const monsterDataSchema = z.strictObject({
  schema_version: z.literal(1),
  size: z.enum(CREATURE_SIZES),
  creature_type: text(80), alignment: text(120).optional(), description: text(8_000).optional(),
  armor_class: z.strictObject({ value: integer(0, 100), notes: text(500).optional() }),
  hit_points: z.strictObject({ average: integer(1, 1_000_000), dice_text: text(120).optional() }),
  speed: movementSchema,
  ability_scores: abilityScoresSchema,
  saving_throws: savingThrowsSchema.optional(),
  skills: z.array(z.strictObject({ name: text(80), bonus: bonus() })).max(30).optional(),
  senses: z.array(z.strictObject({ type: z.enum(VISION_TYPES), range: distance(), notes: text(500).optional() })).max(8).optional(),
  senses_notes: text(500).optional(), passive_perception: integer(0, 100).optional(),
  languages: z.array(text(120)).max(30).optional(), languages_notes: text(500).optional(),
  challenge: z.strictObject({ rating: text(40), experience_points: integer(0, 10_000_000).optional() }).optional(),
  damage_vulnerabilities: damageTypes(), damage_resistances: damageTypes(), damage_immunities: damageTypes(),
  damage_notes: text(1_000).optional(), condition_immunities: z.array(text(80)).max(30).optional(),
  traits: z.array(namedEntrySchema).max(30).optional(),
  actions: z.array(ruleEntrySchema).max(30).optional(),
  bonus_actions: z.array(ruleEntrySchema).max(30).optional(),
  reactions: z.array(ruleEntrySchema).max(30).optional(),
  legendary_actions: legendarySchema.optional(),
  lair_actions: z.strictObject({
    description: text(4_000).optional(), initiative_count: integer(0, 100).optional(),
    entries: z.array(ruleEntrySchema).min(1).max(30),
  }).optional(),
}).superRefine((value, context) => {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MONSTER_PAYLOAD_MAX_BYTES) {
    context.addIssue({ code: "custom", message: "Monster data exceeds the 64 KiB UTF-8 payload budget" });
  }
});

export type MonsterData = z.infer<typeof monsterDataSchema>;
export type MonsterRuleEntry = z.infer<typeof ruleEntrySchema>;
