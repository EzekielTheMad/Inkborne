import { z } from "zod";

import {
  magicItemDataSchema,
  type MagicItemData,
} from "@/lib/schemas/content-types/magic-item";
import { ITEM_RARITIES } from "@/lib/types/taxonomies";

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 20_000;
const MAX_EQUIPMENT_CATEGORY_LENGTH = 100;

const homebrewMagicItemFieldsSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(MAX_NAME_LENGTH),
  rarity: z.enum(ITEM_RARITIES),
  description: z
    .string()
    .trim()
    .min(1, "Description is required.")
    .max(MAX_DESCRIPTION_LENGTH),
  equipmentCategory: z
    .string()
    .trim()
    .max(MAX_EQUIPMENT_CATEGORY_LENGTH)
    .transform((value) => value || undefined),
  requiresAttunement: z.boolean(),
});

export interface HomebrewMagicItemFormValue {
  name: string;
  data: MagicItemData;
}

export type HomebrewMagicItemFormParseResult =
  | { success: true; data: HomebrewMagicItemFormValue }
  | { success: false; fieldErrors: Record<string, string[]> };

function checkbox(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  if (value == null) return false;
  return ["1", "true", "on", "yes"].includes(String(value).toLowerCase());
}

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  const formKeys: Record<string, string> = {
    equipmentCategory: "equipment_category",
    requiresAttunement: "requires_attunement",
  };

  for (const issue of error.issues) {
    const rawKey = String(issue.path[0] ?? "form");
    const key = formKeys[rawKey] ?? rawKey;
    (result[key] ??= []).push(issue.message);
  }

  return result;
}

/**
 * Converts the finite authoring controls into canonical magic-item data.
 * Identity, ownership, provenance, version, and effects are not accepted from
 * the browser and are derived by the server-side persistence boundary.
 */
export function mapHomebrewMagicItemFormData(
  formData: FormData,
): HomebrewMagicItemFormParseResult {
  const parsedFields = homebrewMagicItemFieldsSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    rarity: String(formData.get("rarity") ?? ""),
    description: String(formData.get("description") ?? ""),
    equipmentCategory: String(formData.get("equipment_category") ?? ""),
    requiresAttunement: checkbox(formData, "requires_attunement"),
  });

  if (!parsedFields.success) {
    return { success: false, fieldErrors: fieldErrors(parsedFields.error) };
  }

  const fields = parsedFields.data;
  const magicItem = magicItemDataSchema.safeParse({
    rarity: fields.rarity,
    description: fields.description,
    ...(fields.equipmentCategory
      ? { equipment_category: fields.equipmentCategory }
      : {}),
    requires_attunement: fields.requiresAttunement,
  });

  if (!magicItem.success) {
    return { success: false, fieldErrors: fieldErrors(magicItem.error) };
  }

  return {
    success: true,
    data: {
      name: fields.name,
      data: magicItem.data,
    },
  };
}
