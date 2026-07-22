import { z } from "zod";

import {
  backgroundDataSchema,
  type BackgroundData,
} from "@/lib/schemas/content-types/background";
import { effectSchema } from "@/lib/schemas/effects";
import type { Effect } from "@/lib/types/effects";

const MAX_NAME_LENGTH = 100;
const MAX_FEATURE_DESCRIPTION_LENGTH = 20_000;
const MAX_EQUIPMENT_LENGTH = 10_000;
const MAX_NARRATIVE_LENGTH = 2_000;
const MAX_ALIGNMENT_LENGTH = 100;
const MAX_LIST_ITEM_LENGTH = 100;
const MAX_NARRATIVE_ITEMS = 20;
const MAX_TOOL_PROFICIENCIES = 20;
const MAX_FIXED_LANGUAGES = 20;
const MAX_LANGUAGE_CHOICES = 10;
const MAX_GOLD = 1_000_000;

const SKILLS = [
  "acrobatics",
  "animal-handling",
  "arcana",
  "athletics",
  "deception",
  "history",
  "insight",
  "intimidation",
  "investigation",
  "medicine",
  "nature",
  "perception",
  "performance",
  "persuasion",
  "religion",
  "sleight-of-hand",
  "stealth",
  "survival",
] as const;

const optionalNonnegativeInteger = (maximum: number) =>
  z
    .union([z.literal(""), z.coerce.number().int().min(0).max(maximum)])
    .transform((value) => (value === "" ? undefined : value));

const optionalPositiveInteger = (maximum: number) =>
  z
    .union([z.literal(""), z.coerce.number().int().min(0).max(maximum)])
    .transform((value) => (value === "" || value === 0 ? undefined : value));

const idealFieldsSchema = z.object({
  text: z.string().trim().min(1, "Ideal text is required.").max(MAX_NARRATIVE_LENGTH),
  alignment: z.string().trim().max(MAX_ALIGNMENT_LENGTH),
});

const homebrewBackgroundFieldsSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(MAX_NAME_LENGTH),
  featureName: z
    .string()
    .trim()
    .min(1, "Feature name is required.")
    .max(MAX_NAME_LENGTH),
  featureDescription: z
    .string()
    .trim()
    .min(1, "Feature description is required.")
    .max(MAX_FEATURE_DESCRIPTION_LENGTH),
  skills: z.array(z.enum(SKILLS)).max(SKILLS.length),
  toolProfs: z
    .array(z.string().trim().min(1).max(MAX_LIST_ITEM_LENGTH))
    .max(MAX_TOOL_PROFICIENCIES),
  fixedLanguages: z
    .array(z.string().trim().min(1).max(MAX_LIST_ITEM_LENGTH))
    .max(MAX_FIXED_LANGUAGES),
  languageChoiceCount: optionalPositiveInteger(MAX_LANGUAGE_CHOICES),
  gold: optionalNonnegativeInteger(MAX_GOLD),
  equipment: z.string().trim().max(MAX_EQUIPMENT_LENGTH),
  personalityTraits: z
    .array(z.string().trim().min(1).max(MAX_NARRATIVE_LENGTH))
    .max(MAX_NARRATIVE_ITEMS),
  ideals: z.array(idealFieldsSchema).max(MAX_NARRATIVE_ITEMS),
  bonds: z
    .array(z.string().trim().min(1).max(MAX_NARRATIVE_LENGTH))
    .max(MAX_NARRATIVE_ITEMS),
  flaws: z
    .array(z.string().trim().min(1).max(MAX_NARRATIVE_LENGTH))
    .max(MAX_NARRATIVE_ITEMS),
});

export interface HomebrewBackgroundFormValue {
  name: string;
  data: BackgroundData;
  effects: Effect[];
}

export type HomebrewBackgroundFormParseResult =
  | { success: true; data: HomebrewBackgroundFormValue }
  | { success: false; fieldErrors: Record<string, string[]> };

function slug(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = slug(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function uniqueProse(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const rawValue of values) {
    const value = rawValue.trim();
    const key = value.toLocaleLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }

  return result;
}

function selectableValues(formData: FormData, key: string): string[] {
  return unique(
    formData
      .getAll(key)
      .flatMap((value) => String(value).split(/[\r\n,]+/))
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function proseValues(formData: FormData, key: string): string[] {
  return uniqueProse(
    formData
      .getAll(key)
      .flatMap((value) => String(value).split(/\r?\n/))
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function idealValues(formData: FormData): Array<{ text: string; alignment: string }> {
  return proseValues(formData, "ideals").map((value) => {
    const separator = value.indexOf("|");
    if (separator < 0) return { text: value, alignment: "" };

    return {
      text: value.slice(0, separator).trim(),
      alignment: value.slice(separator + 1).trim(),
    };
  });
}

const formKeys: Record<string, string> = {
  featureName: "feature_name",
  featureDescription: "feature_description",
  toolProfs: "tool_profs",
  fixedLanguages: "fixed_languages",
  languageChoiceCount: "language_choice_count",
  personalityTraits: "personality_traits",
};

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const rawKey = String(issue.path[0] ?? "form");
    const key = formKeys[rawKey] ?? rawKey;
    (result[key] ??= []).push(issue.message);
  }

  return result;
}

function backgroundFieldName(path: PropertyKey[]): string {
  if (path[0] === "feature") {
    return path[1] === "name" ? "feature_name" : "feature_description";
  }
  if (path[0] === "languageProfs") return "fixed_languages";
  if (path[0] === "toolProfs") return "tool_profs";
  if (path[0] === "personality_traits") return "personality_traits";
  return String(path[0] ?? "form");
}

function backgroundFieldErrors(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = backgroundFieldName(issue.path);
    (result[key] ??= []).push(issue.message);
  }

  return result;
}

function buildEffects(
  name: string,
  data: BackgroundData,
): Effect[] | null {
  const effects: Effect[] = [
    {
      type: "narrative",
      text: `${data.feature.name}: ${data.feature.description}`,
      tag: "Background Feature",
    },
    ...data.skills.map((skill): Effect => ({
      type: "grant",
      stat: skill,
      value: "proficient",
    })),
    ...data.toolProfs
      .filter((tool): tool is string => typeof tool === "string")
      .map((tool): Effect => ({ type: "grant", stat: tool, value: "proficient" })),
    ...data.languageProfs
      .filter((language): language is string => typeof language === "string")
      .map((language): Effect => ({
        type: "grant",
        stat: language,
        value: "proficient",
      })),
  ];

  const languageChoice = data.languageProfs.find(
    (language): language is { choose: number; from: "any" | string[] } =>
      typeof language !== "string",
  );
  if (languageChoice) {
    effects.push({
      type: "choice",
      choose: languageChoice.choose,
      from: languageChoice.from,
      grant_type: "language",
      choice_id: `background-${slug(name) || "custom"}-languages`,
    });
  }

  const parsed = z.array(effectSchema).safeParse(effects);
  return parsed.success ? parsed.data : null;
}

/**
 * Converts finite, named background authoring controls into canonical data and
 * effects. Nested data, scopes, ownership, and effects are never accepted from
 * the browser; the server constructs and validates the complete payload here.
 */
export function mapHomebrewBackgroundFormData(
  formData: FormData,
): HomebrewBackgroundFormParseResult {
  const parsedFields = homebrewBackgroundFieldsSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    featureName: String(formData.get("feature_name") ?? ""),
    featureDescription: String(formData.get("feature_description") ?? ""),
    skills: selectableValues(formData, "skills"),
    toolProfs: selectableValues(formData, "tool_profs"),
    fixedLanguages: selectableValues(formData, "fixed_languages"),
    languageChoiceCount: String(formData.get("language_choice_count") ?? "").trim(),
    gold: String(formData.get("gold") ?? "").trim(),
    equipment: String(formData.get("equipment") ?? ""),
    personalityTraits: proseValues(formData, "personality_traits"),
    ideals: idealValues(formData),
    bonds: proseValues(formData, "bonds"),
    flaws: proseValues(formData, "flaws"),
  });

  if (!parsedFields.success) {
    return { success: false, fieldErrors: fieldErrors(parsedFields.error) };
  }

  const fields = parsedFields.data;
  const background = backgroundDataSchema.safeParse({
    feature: {
      name: fields.featureName,
      description: fields.featureDescription,
    },
    personality_traits: fields.personalityTraits,
    ideals: fields.ideals,
    bonds: fields.bonds,
    flaws: fields.flaws,
    skills: fields.skills,
    ...(fields.gold !== undefined ? { gold: fields.gold } : {}),
    languageProfs: [
      ...fields.fixedLanguages,
      ...(fields.languageChoiceCount
        ? [{ choose: fields.languageChoiceCount, from: "any" as const }]
        : []),
    ],
    toolProfs: fields.toolProfs,
    equipment: fields.equipment,
    variant: null,
    source_refs: [],
  });

  if (!background.success) {
    return {
      success: false,
      fieldErrors: backgroundFieldErrors(background.error),
    };
  }

  const effects = buildEffects(fields.name, background.data);
  if (!effects) {
    return {
      success: false,
      fieldErrors: { form: ["This background contains an unsupported derived effect."] },
    };
  }

  return {
    success: true,
    data: {
      name: fields.name,
      data: background.data,
      effects,
    },
  };
}
