import { monsterDataSchema, MONSTER_ABILITIES, MONSTER_MOVEMENT_MODES } from "@/lib/schemas/content-types/monster";
import { CREATURE_SIZES, DAMAGE_TYPES, VISION_TYPES } from "@/lib/types/taxonomies";

/** UI descriptors cover only the accepted v1 fields. Canonical validation stays
 * authoritative; these labels and bounds describe ordinary structured controls. */
export interface MonsterControl {
  kind: "text" | "integer" | "select" | "boolean" | "object" | "list";
  label: string; optional?: boolean; max?: number; min?: number; multiline?: boolean;
  options?: readonly string[]; fields?: Record<string, MonsterControl>; item?: MonsterControl;
}
const text = (label: string, max: number, optional = false, multiline = false): MonsterControl => ({ kind: "text", label, max, optional, multiline });
const integer = (label: string, min: number, max: number, optional = false): MonsterControl => ({ kind: "integer", label, min, max, optional });
const select = (label: string, options: readonly string[], optional = false): MonsterControl => ({ kind: "select", label, options, optional });
const object = (label: string, fields: Record<string, MonsterControl>, optional = false): MonsterControl => ({ kind: "object", label, fields, optional });
const list = (label: string, item: MonsterControl, max: number, optional = true): MonsterControl => ({ kind: "list", label, item, max, optional });
const bonus = (label: string, optional = false) => integer(label, -100, 100, optional);
const distance = (label: string, optional = false) => integer(label, 0, 10_000, optional);
const named = { name: text("Entry name", 120), description: text("Entry description", 4_000, false, true) };
const rule = {
  ...named,
  attack: object("Attack", {
    kind: select("Attack kind", ["melee", "ranged", "melee_or_ranged"]),
    attack_type: select("Attack type", ["weapon", "spell"]), bonus: bonus("Attack bonus"),
    reach: distance("Reach (ft.)", true),
    range: object("Range", { normal: integer("Normal range (ft.)", 1, 10_000), long: integer("Long range (ft.)", 1, 10_000, true) }, true),
    target: text("Target", 200, true),
  }, true),
  saving_throw: object("Saving throw", { ability: select("Save ability", MONSTER_ABILITIES), dc: integer("Save DC", 0, 100), on_success: text("On success", 500, true, true) }, true),
  damage: list("Damage", object("Damage entry", { type: select("Damage type", DAMAGE_TYPES), average: integer("Damage average", 0, 1_000_000, true), roll_text: text("Damage roll text", 120, true), notes: text("Damage notes", 500, true) }), 8),
};
export const MONSTER_CONTROLS: Record<string, MonsterControl> = {
  size: select("Size", CREATURE_SIZES), creature_type: text("Creature type", 80),
  alignment: text("Alignment", 120, true), description: text("Description", 8_000, true, true),
  armor_class: object("Armor class", { value: integer("Declared AC", 0, 100), notes: text("AC notes", 500, true) }),
  hit_points: object("Hit points", { average: integer("Declared HP average", 1, 1_000_000), dice_text: text("HP dice text", 120, true) }),
  speed: object("Movement", {
    ...Object.fromEntries(MONSTER_MOVEMENT_MODES.map((key) => [key, distance(`${key[0].toUpperCase()}${key.slice(1)} (ft.)`, true)])),
    hover: { kind: "boolean", label: "Hover", optional: true }, notes: text("Speed notes", 500, true),
  }),
  ability_scores: object("Abilities", Object.fromEntries(MONSTER_ABILITIES.map((key) => [key, integer(`${key[0].toUpperCase()}${key.slice(1)} score`, 1, 30)]))),
  saving_throws: object("Declared saves", Object.fromEntries(MONSTER_ABILITIES.map((key) => [key, bonus(`${key[0].toUpperCase()}${key.slice(1)} save bonus`, true)])), true),
  skills: list("Skills", object("Skill", { name: text("Skill name", 80), bonus: bonus("Skill bonus") }), 30),
  senses: list("Senses", object("Sense", { type: select("Sense type", VISION_TYPES), range: distance("Sense range (ft.)"), notes: text("Sense notes", 500, true) }), 8),
  senses_notes: text("Senses notes", 500, true), passive_perception: integer("Passive perception", 0, 100, true),
  languages: list("Languages", text("Language", 120), 30), languages_notes: text("Language notes", 500, true),
  challenge: object("Challenge", { rating: text("Challenge rating", 40), experience_points: integer("Experience points", 0, 10_000_000, true) }, true),
  damage_vulnerabilities: list("Damage vulnerabilities", select("Vulnerability", DAMAGE_TYPES), 13),
  damage_resistances: list("Damage resistances", select("Resistance", DAMAGE_TYPES), 13),
  damage_immunities: list("Damage immunities", select("Immunity", DAMAGE_TYPES), 13),
  damage_notes: text("Conditional damage defenses", 1_000, true, true), condition_immunities: list("Condition immunities", text("Condition", 80), 30),
  traits: list("Traits", object("Trait", named), 30),
  actions: list("Actions", object("Action", rule), 30), bonus_actions: list("Bonus actions", object("Bonus action", rule), 30), reactions: list("Reactions", object("Reaction", rule), 30),
  legendary_actions: object("Legendary actions", {
    description: text("Legendary description", 4_000, true, true), actions_per_round: integer("Actions per round", 1, 20, true),
    entries: list("Legendary entries", object("Legendary entry", { ...rule, cost: integer("Legendary cost", 1, 20, true) }), 30, false),
  }, true),
  lair_actions: object("Lair actions", {
    description: text("Lair description", 4_000, true, true), initiative_count: integer("Lair initiative", 0, 100, true),
    entries: list("Lair entries", object("Lair entry", rule), 30, false),
  }, true),
};

export type MonsterDraft = string | { [key: string]: MonsterDraft | undefined } | MonsterDraftRow[];
export interface MonsterDraftRow { id: string; value: MonsterDraft }
export type MonsterDraftObject = { [key: string]: MonsterDraft | undefined };

export function newMonsterDraft(control: MonsterControl): MonsterDraft {
  if (control.kind === "list") return [];
  if (control.kind === "object") return Object.fromEntries(Object.entries(control.fields!).map(([key, field]) => [key, field.optional ? undefined : newMonsterDraft(field)]));
  return "";
}

function fromValue(control: MonsterControl, value: unknown, path: string): MonsterDraft | undefined {
  if (value === undefined) return control.optional ? undefined : newMonsterDraft(control);
  if (control.kind === "list") return (value as unknown[]).map((entry, index) => ({ id: `${path}-${index}`, value: fromValue(control.item!, entry, `${path}-${index}`)! }));
  if (control.kind === "object") return Object.fromEntries(Object.entries(control.fields!).map(([key, field]) => [key, fromValue(field, (value as Record<string, unknown>)[key], `${path}-${key}`)]));
  return String(value);
}

export function monsterDataToDraft(data?: unknown): MonsterDraftObject {
  // Refuse unsupported records rather than discard unknown fields in this DTO.
  if (data !== undefined) monsterDataSchema.parse(data);
  return Object.fromEntries(Object.entries(MONSTER_CONTROLS).map(([key, control]) => [key, fromValue(control, (data as Record<string, unknown> | undefined)?.[key], key)]));
}

function toValue(control: MonsterControl, draft: MonsterDraft | undefined): unknown {
  if (draft === undefined) return undefined;
  if (control.kind === "list") return (draft as MonsterDraftRow[]).map((row) => toValue(control.item!, row.value));
  if (control.kind === "object") return Object.fromEntries(Object.entries(control.fields!).flatMap(([key, field]) => {
    const value = toValue(field, (draft as MonsterDraftObject)[key]);
    return value === undefined ? [] : [[key, value]];
  }));
  if (draft === "" && control.optional) return undefined;
  if (control.kind === "boolean") return draft === "true" ? true : draft === "false" ? false : draft;
  if (control.kind === "integer") {
    const number = Number(draft);
    return typeof draft === "string" && /^-?\d+$/.test(draft) && Number.isSafeInteger(number) ? number : draft;
  }
  return draft;
}

export function monsterDraftToData(draft: MonsterDraftObject): Record<string, unknown> {
  return { schema_version: 1, ...Object.fromEntries(Object.entries(MONSTER_CONTROLS).flatMap(([key, control]) => {
    const value = toValue(control, draft[key]);
    return value === undefined ? [] : [[key, value]];
  })) };
}
