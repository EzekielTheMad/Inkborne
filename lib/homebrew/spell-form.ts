import { z } from "zod";

import { parseDiceExpression } from "@/lib/dice/parser";
import {
  spellDataSchema,
  type SpellData,
} from "@/lib/schemas/content-types/spell";
import { DAMAGE_TYPES, MAGIC_SCHOOLS } from "@/lib/types/taxonomies";

const MAX_NAME_LENGTH = 100;
const MAX_SHORT_TEXT_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 20_000;

const optionalTrimmedString = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .transform((value) => value || undefined);

const optionalDiceExpression = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .superRefine((value, context) => {
    if (!value) return;

    try {
      parseDiceExpression(value.replace(/\bMOD\b/gi, "0"));
    } catch {
      context.addIssue({
        code: "custom",
        message: "Enter a valid dice expression, such as 2d6+3.",
      });
    }
  });

const homebrewSpellFieldsSchema = z.object({
  systemId: z.union([z.string().uuid(), z.literal("")]),
  name: z.string().trim().min(1, "Name is required.").max(MAX_NAME_LENGTH),
  level: z.coerce.number().int().min(0).max(9),
  school: z.enum(MAGIC_SCHOOLS),
  castingTime: z
    .string()
    .trim()
    .min(1, "Casting time is required.")
    .max(MAX_SHORT_TEXT_LENGTH),
  range: z
    .string()
    .trim()
    .min(1, "Range is required.")
    .max(MAX_SHORT_TEXT_LENGTH),
  components: z.array(z.enum(["V", "S", "M"])).min(1).max(3),
  material: optionalTrimmedString(2_000),
  duration: z
    .string()
    .trim()
    .min(1, "Duration is required.")
    .max(MAX_SHORT_TEXT_LENGTH),
  concentration: z.boolean(),
  ritual: z.boolean(),
  description: z
    .string()
    .trim()
    .min(1, "Description is required.")
    .max(MAX_DESCRIPTION_LENGTH),
  higherLevel: optionalTrimmedString(MAX_DESCRIPTION_LENGTH),
  attackType: z.union([z.enum(["melee", "ranged"]), z.literal("")]),
  damageType: z.union([z.enum(DAMAGE_TYPES), z.literal("")]),
  damageDice: optionalDiceExpression,
  healingDice: optionalDiceExpression,
  saveType: optionalTrimmedString(100),
  saveSuccess: z.enum(["half", "none", "other"]),
  areaType: z.union([
    z.enum(["sphere", "cone", "cylinder", "line", "cube"]),
    z.literal(""),
  ]),
  areaSize: z.union([z.coerce.number().positive(), z.literal("")]),
  classes: z.array(z.string().trim().min(1).max(100)).min(1).max(50),
}).superRefine((value, context) => {
  if (Boolean(value.areaType) === (value.areaSize === "")) {
    context.addIssue({
      code: "custom",
      path: [value.areaType ? "areaSize" : "areaType"],
      message: "Area type and size must be provided together.",
    });
  }

  if (value.components.includes("M") && !value.material) {
    context.addIssue({
      code: "custom",
      path: ["material"],
      message: "Describe the material component.",
    });
  }

  if (value.damageType && !value.damageDice) {
    context.addIssue({
      code: "custom",
      path: ["damageDice"],
      message: "Enter damage dice when a damage type is selected.",
    });
  }
});

export interface HomebrewSpellFormValue {
  /** Optional UI context only. The server resolves the canonical system. */
  systemId?: string;
  name: string;
  data: SpellData;
}

export type HomebrewSpellFormParseResult =
  | { success: true; data: HomebrewSpellFormValue }
  | { success: false; fieldErrors: Record<string, string[]> };

function strings(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function checkbox(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  if (value == null) return false;
  return ["1", "true", "on", "yes"].includes(String(value).toLowerCase());
}

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  const formKeys: Record<string, string> = {
    systemId: "system_id",
    castingTime: "casting_time",
    higherLevel: "higher_level",
    attackType: "attack_type",
    damageType: "damage_type",
    damageDice: "damage_dice",
    healingDice: "healing_dice",
    saveType: "save_type",
    saveSuccess: "save_success",
    areaType: "area_type",
    areaSize: "area_size",
  };

  for (const issue of error.issues) {
    const rawKey = String(issue.path[0] ?? "form");
    const key = formKeys[rawKey] ?? rawKey;
    (result[key] ??= []).push(issue.message);
  }

  return result;
}

function spellFieldName(path: PropertyKey[]): string {
  switch (path[0]) {
    case "casting_time":
      return "casting_time";
    case "higher_level":
      return "higher_level";
    case "attack_type":
      return "attack_type";
    case "damage":
      return path[1] === "type" ? "damage_type" : "damage_dice";
    case "heal_at_slot_level":
      return "healing_dice";
    case "dc":
      return path[1] === "success" ? "save_success" : "save_type";
    case "area_of_effect":
      return path[1] === "size" ? "area_size" : "area_type";
    default:
      return String(path[0] ?? "form");
  }
}

function spellFieldErrors(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = spellFieldName(issue.path);
    (result[key] ??= []).push(issue.message);
  }

  return result;
}

/**
 * Convert the authored form into the canonical spell payload. No JSON fields
 * are accepted from the browser: nested damage/healing/DC data is assembled
 * here, dice strings are parsed, and the final boundary is spellDataSchema.
 */
export function mapHomebrewSpellFormData(
  formData: FormData,
): HomebrewSpellFormParseResult {
  const parsedFields = homebrewSpellFieldsSchema.safeParse({
    systemId: String(formData.get("system_id") ?? "").trim(),
    name: String(formData.get("name") ?? ""),
    level: formData.get("level"),
    school: String(formData.get("school") ?? ""),
    castingTime: String(formData.get("casting_time") ?? ""),
    range: String(formData.get("range") ?? ""),
    components: unique(strings(formData, "components").map((value) => value.toUpperCase())),
    material: String(formData.get("material") ?? ""),
    duration: String(formData.get("duration") ?? ""),
    concentration: checkbox(formData, "concentration"),
    ritual: checkbox(formData, "ritual"),
    description: String(formData.get("description") ?? ""),
    higherLevel: String(formData.get("higher_level") ?? ""),
    attackType: String(formData.get("attack_type") ?? "").trim().toLowerCase(),
    damageType: String(formData.get("damage_type") ?? "").trim().toLowerCase(),
    damageDice: String(formData.get("damage_dice") ?? ""),
    healingDice: String(formData.get("healing_dice") ?? ""),
    saveType: String(formData.get("save_type") ?? ""),
    saveSuccess: String(formData.get("save_success") ?? "none").trim().toLowerCase(),
    areaType: String(formData.get("area_type") ?? "").trim().toLowerCase(),
    areaSize: String(formData.get("area_size") ?? "").trim(),
    classes: unique(strings(formData, "classes").map((value) => value.toLowerCase())),
  });

  if (!parsedFields.success) {
    return { success: false, fieldErrors: fieldErrors(parsedFields.error) };
  }

  const fields = parsedFields.data;
  // The first authoring cut captures one base expression. Cantrips use key 1
  // so the casting helpers have a valid minimum tier to select.
  const scaleKey = String(Math.max(1, fields.level));
  const spell = spellDataSchema.safeParse({
    level: fields.level,
    school: fields.school,
    casting_time: fields.castingTime,
    range: fields.range,
    components: fields.components,
    ...(fields.components.includes("M") && fields.material
      ? { material: fields.material }
      : {}),
    duration: fields.duration,
    concentration: fields.concentration,
    ritual: fields.ritual,
    description: fields.description,
    ...(fields.higherLevel ? { higher_level: fields.higherLevel } : {}),
    attack_type: fields.attackType || null,
    damage: fields.damageDice
      ? {
          type: fields.damageType || null,
          dice_at_slot_level: { [scaleKey]: fields.damageDice },
        }
      : null,
    heal_at_slot_level: fields.healingDice
      ? { [scaleKey]: fields.healingDice }
      : null,
    dc: fields.saveType
      ? { type: fields.saveType, success: fields.saveSuccess }
      : null,
    area_of_effect: fields.areaType
      ? { type: fields.areaType, size: fields.areaSize }
      : null,
    classes: fields.classes,
    subclasses: [],
    dependencies: [],
  });

  if (!spell.success) {
    return { success: false, fieldErrors: spellFieldErrors(spell.error) };
  }

  return {
    success: true,
    data: {
      systemId: fields.systemId || undefined,
      name: fields.name,
      data: spell.data,
    },
  };
}
