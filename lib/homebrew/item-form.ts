import { z } from "zod";

import { itemDataSchema, type ItemData } from "@/lib/schemas/content-types/item";

// Blank means unspecified; otherwise accept finite, nonnegative decimal values.
const optionalNumber = z.string().trim().transform((value, context) => {
  if (value === "") return null;
  const number = Number(value);
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) || !Number.isFinite(number) || number > Number.MAX_SAFE_INTEGER) {
    context.addIssue({ code: "custom", message: "Enter a finite, nonnegative decimal number." });
    return z.NEVER;
  }
  return number;
});

const fieldsSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100),
  equipment_category: z.string().trim().max(100),
  description: z.string().trim().max(20_000),
  cost_quantity: optionalNumber,
  cost_unit: z.string().trim().max(20),
  weight: optionalNumber,
}).superRefine((fields, context) => {
  if (fields.cost_quantity !== null && !fields.cost_unit) {
    context.addIssue({ code: "custom", path: ["cost_unit"], message: "Enter a cost unit with the quantity." });
  }
  if (fields.cost_quantity === null && fields.cost_unit) {
    context.addIssue({ code: "custom", path: ["cost_quantity"], message: "Enter a cost quantity with the unit." });
  }
});

export interface HomebrewItemFormValue {
  name: string;
  data: ItemData;
}

export type HomebrewItemFormParseResult =
  | { success: true; data: HomebrewItemFormValue }
  | { success: false; fieldErrors: Record<string, string[]> };

/** Accept only finite authoring controls; the server derives the private envelope. */
export function mapHomebrewItemFormData(formData: FormData): HomebrewItemFormParseResult {
  const fields = fieldsSchema.safeParse(Object.fromEntries(
    ["name", "equipment_category", "description", "cost_quantity", "cost_unit", "weight"]
      .map((key) => [key, String(formData.get(key) ?? "")]),
  ));
  if (!fields.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of fields.error.issues) {
      const key = String(issue.path[0] ?? "form");
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { success: false, fieldErrors };
  }
  const value = fields.data;
  return {
    success: true,
    data: {
      name: value.name,
      data: itemDataSchema.parse({
        equipment_category: value.equipment_category,
        description: value.description,
        cost: value.cost_quantity === null ? null : { quantity: value.cost_quantity, unit: value.cost_unit },
        weight: value.weight,
      }),
    },
  };
}
