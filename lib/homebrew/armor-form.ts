import { z } from "zod";

import { armorDataSchema, type ArmorData } from "@/lib/schemas/content-types/armor";
import { ARMOR_CATEGORIES } from "@/lib/types/taxonomies";

export interface HomebrewArmorFormValue { name: string; data: ArmorData }
export type HomebrewArmorFormParseResult =
  | { success: true; data: HomebrewArmorFormValue }
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
const optionalInteger = optionalNumber.refine((value) => value === null || Number.isSafeInteger(value), "Enter a whole number.");

const fieldsSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100),
  armor_category: z.enum(ARMOR_CATEGORIES),
  cost_quantity: optionalNumber,
  cost_unit: z.string().trim().max(20),
  weight: optionalNumber,
  armor_class_base: optionalInteger.refine((value) => value !== null, "Base armor class is required."),
  dex_bonus: z.boolean(),
  max_bonus: optionalInteger,
  str_minimum: optionalInteger,
  stealth_disadvantage: z.boolean(),
}).superRefine((fields, context) => {
  function issue(key: string, message: string) { context.addIssue({ code: "custom", path: [key], message }); }
  if (fields.cost_quantity !== null && !fields.cost_unit) issue("cost_unit", "Enter a cost unit with the quantity.");
  if (fields.cost_quantity === null && fields.cost_unit) issue("cost_quantity", "Enter a cost quantity with the unit.");
  if (!fields.dex_bonus && fields.max_bonus !== null) issue("max_bonus", "Clear the Dexterity cap or enable the Dexterity bonus.");
});

function checkbox(formData: FormData, key: string) {
  return ["on", "true", "1", "yes"].includes(String(formData.get(key) ?? "").toLowerCase());
}

/** Author only named fields into the existing nested armor schema. */
export function mapHomebrewArmorFormData(formData: FormData): HomebrewArmorFormParseResult {
  const keys = ["name", "armor_category", "cost_quantity", "cost_unit", "weight", "armor_class_base", "max_bonus", "str_minimum"];
  const parsed = fieldsSchema.safeParse({
    ...Object.fromEntries(keys.map((key) => [key, String(formData.get(key) ?? "")])),
    dex_bonus: checkbox(formData, "dex_bonus"),
    stealth_disadvantage: checkbox(formData, "stealth_disadvantage"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) (fieldErrors[String(issue.path[0] ?? "form")] ??= []).push(issue.message);
    return { success: false, fieldErrors };
  }
  const fields = parsed.data;
  return { success: true, data: { name: fields.name, data: armorDataSchema.parse({
    armor_category: fields.armor_category,
    cost: fields.cost_quantity === null ? null : { quantity: fields.cost_quantity, unit: fields.cost_unit },
    weight: fields.weight,
    armor_class: { base: fields.armor_class_base, dex_bonus: fields.dex_bonus, max_bonus: fields.max_bonus },
    str_minimum: fields.str_minimum ?? 0,
    stealth_disadvantage: fields.stealth_disadvantage,
  }) } };
}
