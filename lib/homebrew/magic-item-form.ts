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

export const MAGIC_ITEM_VERSION_MAX = 2_147_483_647;
export const magicItemVersionSchema = z.number().int().min(1).max(MAGIC_ITEM_VERSION_MAX);
const feedbackSchema = z.record(z.string().max(200), z.array(z.string().max(200)).min(1).max(3))
  .refine(value => Object.keys(value).length <= 100);
const message = z.string().trim().min(1).max(1000);
export const magicItemActionStateSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("idle"), message: z.string().max(1000).optional() }),
  z.strictObject({ status: z.literal("error"), message, fieldErrors: feedbackSchema.optional() }),
  z.strictObject({ status: z.literal("conflict"), message }),
  z.strictObject({ status: z.literal("uncertain"), message }),
  z.strictObject({ status: z.literal("saved"), id: z.uuid(), version: magicItemVersionSchema,
    operation: z.enum(["create", "edit"]), message: message.optional() }),
  z.strictObject({ status: z.literal("unchanged"), id: z.uuid(), version: magicItemVersionSchema, message }),
]);
export type MagicItemActionState = z.infer<typeof magicItemActionStateSchema>;
export function magicItemUncertainty(mode: "create" | "edit"): MagicItemActionState {
  return { status: "uncertain", message: mode === "create"
    ? "The create result could not be confirmed. Your draft is kept. Check your owned Homebrew before attempting another create; the first attempt may have saved."
    : "The edit result could not be confirmed. Your draft is kept. Reload before another save; the attempted version may have saved." };
}
export function acceptMagicItemResponse(raw: unknown, mode: "create" | "edit", id?: string, version?: number): MagicItemActionState {
  const parsed = magicItemActionStateSchema.safeParse(raw);
  if (!parsed.success || parsed.data.status === "idle") return magicItemUncertainty(mode);
  const state = parsed.data;
  if (state.status === "saved" && (state.operation !== mode || (mode === "create" ? state.version !== 1
    : state.id !== id || !magicItemVersionSchema.safeParse(version).success || version === MAGIC_ITEM_VERSION_MAX || state.version !== version! + 1))) return magicItemUncertainty(mode);
  if (state.status === "unchanged" && (mode !== "edit" || state.id !== id || state.version !== version)) return magicItemUncertainty(mode);
  return state;
}
function text(form: FormData, key: string, optional = false): string | undefined {
  const entries = form.getAll(key);
  if (!entries.length) return optional ? "" : undefined;
  return entries.length === 1 && typeof entries[0] === "string" ? entries[0] : undefined;
}
export function mapMagicItemEditIdentity(form: FormData): { id: string; expectedVersion: number } | null {
  const id = text(form, "id"), raw = text(form, "expected_version");
  if (!z.uuid().safeParse(id).success || !raw || !/^[1-9]\d{0,9}$/.test(raw)) return null;
  const version = magicItemVersionSchema.safeParse(Number(raw));
  return version.success ? { id: id!, expectedVersion: version.data } : null;
}

/** Validation is separate from serialization: untouched raw keys/presence survive edits. */
export function mergeMagicItemEdit(originalName: string, raw: Record<string, unknown>, draft: HomebrewMagicItemFormValue) {
  const original = magicItemDataSchema.parse(raw);
  // Refuse unsupported authoring controls rather than truncating a legacy value.
  homebrewMagicItemFieldsSchema.parse({ name: originalName, rarity: original.rarity, description: original.description,
    equipmentCategory: original.equipment_category ?? "", requiresAttunement: original.requires_attunement });
  const data = { ...raw };
  if (original.rarity !== draft.data.rarity) data.rarity = draft.data.rarity;
  if (original.description.trim() !== draft.data.description) data.description = draft.data.description;
  if ((original.equipment_category ?? "").trim() !== (draft.data.equipment_category ?? "")) {
    if (draft.data.equipment_category === undefined) delete data.equipment_category;
    else data.equipment_category = draft.data.equipment_category;
  }
  if (original.requires_attunement !== draft.data.requires_attunement) data.requires_attunement = draft.data.requires_attunement;
  return { name: originalName.trim() === draft.name ? originalName : draft.name, data };
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
    if (!(key in result) && Object.keys(result).length >= 100) continue;
    const messages = result[key] ??= [];
    if (messages.length < 3) messages.push(issue.message.slice(0, 200));
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
  const attunement = text(formData, "requires_attunement", true)?.toLowerCase();
  const parsedFields = homebrewMagicItemFieldsSchema.safeParse({
    name: text(formData, "name"),
    rarity: text(formData, "rarity"),
    description: text(formData, "description"),
    equipmentCategory: text(formData, "equipment_category", true),
    requiresAttunement: attunement !== undefined && ["", "0", "false", "off", "no", "1", "true", "on", "yes"].includes(attunement)
      ? ["1", "true", "on", "yes"].includes(attunement) : undefined,
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
