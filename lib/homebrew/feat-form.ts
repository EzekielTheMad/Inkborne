import { z } from "zod";

import {
  featDataSchema,
  type FeatData,
} from "@/lib/schemas/content-types/feat";
import { effectSchema } from "@/lib/schemas/effects";
import type { Effect } from "@/lib/types/effects";

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 20_000;
const ABILITIES = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
] as const;
const ABILITY_FIELDS = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
] as const;

const optionalInteger = (minimum: number, maximum: number) =>
  z
    .union([z.literal(""), z.coerce.number().int().min(minimum).max(maximum)])
    .transform((value) => (value === "" ? undefined : value));

const homebrewFeatFieldsSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required.").max(MAX_NAME_LENGTH),
    description: z
      .string()
      .trim()
      .min(1, "Description is required.")
      .max(MAX_DESCRIPTION_LENGTH),
    prerequisiteAbility: z.union([z.enum(ABILITIES), z.literal("")]),
    prerequisiteMinimum: optionalInteger(1, 30),
    scores: z.tuple([
      optionalInteger(0, 5),
      optionalInteger(0, 5),
      optionalInteger(0, 5),
      optionalInteger(0, 5),
      optionalInteger(0, 5),
      optionalInteger(0, 5),
    ]),
    action: z.union([
      z.enum(["action", "bonus action", "reaction", "free"]),
      z.literal(""),
    ]),
    usages: optionalInteger(1, Number.MAX_SAFE_INTEGER),
    recovery: z.union([
      z.enum(["short rest", "long rest", "dawn", "day"]),
      z.literal(""),
    ]),
    extraAC: optionalInteger(-10, 10),
  })
  .superRefine((value, context) => {
    if (Boolean(value.prerequisiteAbility) !== Boolean(value.prerequisiteMinimum)) {
      context.addIssue({
        code: "custom",
        path: [value.prerequisiteAbility ? "prerequisiteMinimum" : "prerequisiteAbility"],
        message: "Choose an ability and minimum score together.",
      });
    }

    if (Boolean(value.usages) !== Boolean(value.recovery)) {
      context.addIssue({
        code: "custom",
        path: [value.usages ? "recovery" : "usages"],
        message: "Uses and recovery must be provided together.",
      });
    }
  });

export interface HomebrewFeatFormValue {
  name: string;
  data: FeatData;
  effects: Effect[];
}

export type HomebrewFeatFormParseResult =
  | { success: true; data: HomebrewFeatFormValue }
  | { success: false; fieldErrors: Record<string, string[]> };

const formKeys: Record<string, string> = {
  prerequisiteAbility: "prerequisite_ability",
  prerequisiteMinimum: "prerequisite_minimum",
  action: "action",
  usages: "usages",
  recovery: "recovery",
  extraAC: "extra_ac",
};

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const rawKey = String(issue.path[0] ?? "form");
    const key = rawKey === "scores"
      ? `ability_${ABILITY_FIELDS[Number(issue.path[1]) as number] ?? "scores"}`
      : formKeys[rawKey] ?? rawKey;
    (result[key] ??= []).push(issue.message);
  }

  return result;
}

function buildEffects(
  description: string,
  scores: readonly number[] | undefined,
  extraAC: number | undefined,
): Effect[] | null {
  const effects: Effect[] = [{ type: "narrative", text: description, tag: "Feat" }];

  if (scores) {
    for (const [index, score] of scores.entries()) {
      const ability = ABILITIES[index];
      if (ability && score !== 0) {
        effects.push({ type: "mechanical", stat: ability, op: "add", value: score });
      }
    }
  }

  if (extraAC !== undefined && extraAC !== 0) {
    effects.push({ type: "mechanical", stat: "armor_class", op: "add", value: extraAC });
  }

  return effects.every((effect) => effectSchema.safeParse(effect).success) ? effects : null;
}

/**
 * Converts named feat authoring controls into canonical feat data. The browser
 * never submits an envelope, arbitrary JSON, or effects: all of those values
 * are fixed or derived by the server-side caller.
 */
export function mapHomebrewFeatFormData(
  formData: FormData,
): HomebrewFeatFormParseResult {
  const parsedFields = homebrewFeatFieldsSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    prerequisiteAbility: String(formData.get("prerequisite_ability") ?? "")
      .trim()
      .toLowerCase(),
    prerequisiteMinimum: String(formData.get("prerequisite_minimum") ?? "").trim(),
    scores: ABILITY_FIELDS.map((ability) =>
      String(formData.get(`ability_${ability}`) ?? "").trim(),
    ),
    action: String(formData.get("action") ?? "").trim().toLowerCase(),
    usages: String(formData.get("usages") ?? "").trim(),
    recovery: String(formData.get("recovery") ?? "").trim().toLowerCase(),
    extraAC: String(formData.get("extra_ac") ?? "").trim(),
  });

  if (!parsedFields.success) {
    return { success: false, fieldErrors: fieldErrors(parsedFields.error) };
  }

  const fields = parsedFields.data;
  const scores = fields.scores.map((score) => score ?? 0) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const hasScores = scores.some((score) => score !== 0);
  const feat = featDataSchema.safeParse({
    description: fields.description,
    prerequisites: fields.prerequisiteAbility
      ? [{ stat: fields.prerequisiteAbility, op: "gte", value: fields.prerequisiteMinimum }]
      : [],
    ...(hasScores ? { scores } : {}),
    action: fields.action || null,
    ...(fields.usages !== undefined ? { usages: fields.usages } : {}),
    recovery: fields.recovery || null,
    ...(fields.extraAC !== undefined && fields.extraAC !== 0
      ? { extraAC: fields.extraAC }
      : {}),
  });

  if (!feat.success) {
    return { success: false, fieldErrors: fieldErrors(feat.error) };
  }

  const effects = buildEffects(feat.data.description, feat.data.scores, feat.data.extraAC);
  if (!effects) {
    return {
      success: false,
      fieldErrors: { form: ["This feat contains an unsupported derived effect."] },
    };
  }

  return {
    success: true,
    data: { name: fields.name, data: feat.data, effects },
  };
}
