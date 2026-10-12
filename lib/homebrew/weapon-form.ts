import { z } from "zod";

import { parseDiceExpression } from "@/lib/dice/parser";
import { weaponDataSchema, type WeaponData } from "@/lib/schemas/content-types/weapon";
import { DAMAGE_TYPES, WEAPON_CATEGORIES, WEAPON_PROPERTIES, WEAPON_RANGE_TYPES } from "@/lib/types/taxonomies";

export type HomebrewWeaponCoreData = Pick<WeaponData,
  "weapon_category" | "weapon_range" | "cost" | "weight" | "damage" | "range" | "properties" | "two_handed_damage">;
export interface HomebrewWeaponFormValue { name: string; data: HomebrewWeaponCoreData }
export type HomebrewWeaponFormParseResult =
  | { success: true; data: HomebrewWeaponFormValue }
  | { success: false; fieldErrors: Record<string, string[]> };

const optionalNumber = z.string().trim().max(30).transform((value, context) => {
  if (!value) return null;
  const number = Number(value);
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) || !Number.isFinite(number) || number > Number.MAX_SAFE_INTEGER) {
    context.addIssue({ code: "custom", message: "Enter a finite, nonnegative number." });
    return z.NEVER;
  }
  return number;
});

const dice = z.string().trim().max(100).refine((value) => {
  if (value.length > 100) return false;
  if (!value) return true; // Requiredness/pair consistency is handled below.
  try {
    const parsed = parseDiceExpression(value);
    return parsed.terms.every((term) => term.type !== "modifier" || Number.isSafeInteger(term.value));
  } catch { return false; }
}, "Enter a valid damage expression, such as 1d8.");

const fieldsSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100),
  weapon_category: z.enum(WEAPON_CATEGORIES),
  weapon_range: z.enum(WEAPON_RANGE_TYPES),
  cost_quantity: optionalNumber,
  cost_unit: z.string().trim().max(20),
  weight: optionalNumber,
  damage_dice: dice,
  damage_type: z.enum(DAMAGE_TYPES),
  range_normal: optionalNumber,
  range_long: optionalNumber,
  properties: z.array(z.enum(WEAPON_PROPERTIES)).max(WEAPON_PROPERTIES.length),
  two_handed_damage_dice: dice,
  two_handed_damage_type: z.union([z.enum(DAMAGE_TYPES), z.literal("")]),
}).superRefine((fields, context) => {
  function issue(key: string, message: string) { context.addIssue({ code: "custom", path: [key], message }); }
  if (!fields.damage_dice) issue("damage_dice", "Damage is required for this weapon form.");
  if (fields.cost_quantity !== null && !fields.cost_unit) issue("cost_unit", "Enter a cost unit with the quantity.");
  if (fields.cost_quantity === null && fields.cost_unit) issue("cost_quantity", "Enter a cost quantity with the unit.");
  if (fields.range_normal === 0) issue("range_normal", "Range must be greater than zero.");
  if (fields.range_long === 0) issue("range_long", "Range must be greater than zero.");
  if (fields.range_normal === null && (fields.range_long !== null || fields.weapon_range === "Ranged" || fields.properties.includes("thrown"))) {
    issue("range_normal", "Enter a normal range for a ranged or thrown weapon, or when specifying long range.");
  }
  if (fields.range_normal !== null && fields.range_long !== null && fields.range_long < fields.range_normal) issue("range_long", "Long range cannot be shorter than normal range.");
  if (fields.two_handed_damage_dice && !fields.two_handed_damage_type) issue("two_handed_damage_type", "Choose a damage type with the two-handed expression.");
  if (!fields.two_handed_damage_dice && fields.two_handed_damage_type) issue("two_handed_damage_dice", "Enter a two-handed damage expression or clear its type.");
  if (new Set(fields.properties).size !== fields.properties.length) issue("properties", "Choose each property only once.");
});

/** Only core controls are accepted. Extension defaults apply at create, while
 * edits merge this core subset onto the owned row at the persistence boundary. */
export function mapHomebrewWeaponFormData(formData: FormData): HomebrewWeaponFormParseResult {
  const keys = ["name", "weapon_category", "weapon_range", "cost_quantity", "cost_unit", "weight", "damage_dice", "damage_type",
    "range_normal", "range_long", "two_handed_damage_dice", "two_handed_damage_type"];
  const parsed = fieldsSchema.safeParse({
    ...Object.fromEntries(keys.map((key) => [key, String(formData.get(key) ?? "")])),
    properties: formData.getAll("properties").map(String),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) (fieldErrors[String(issue.path[0] ?? "form")] ??= []).push(issue.message);
    return { success: false, fieldErrors };
  }
  const fields = parsed.data;
  const data: HomebrewWeaponCoreData = {
    weapon_category: fields.weapon_category,
    weapon_range: fields.weapon_range,
    cost: fields.cost_quantity === null ? null : { quantity: fields.cost_quantity, unit: fields.cost_unit },
    weight: fields.weight,
    damage: { dice: fields.damage_dice, type: fields.damage_type },
    range: fields.range_normal === null ? null : { normal: fields.range_normal, ...(fields.range_long === null ? {} : { long: fields.range_long }) },
    properties: fields.properties,
    two_handed_damage: fields.two_handed_damage_dice && fields.two_handed_damage_type
      ? { dice: fields.two_handed_damage_dice, type: fields.two_handed_damage_type } : null,
  };
  // Keep the canonical schema as the final creation/persistence contract.
  weaponDataSchema.parse(data);
  return { success: true, data: { name: fields.name, data } };
}
