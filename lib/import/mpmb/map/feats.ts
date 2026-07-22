import { effectSchema, statConditionSchema } from "@/lib/schemas/effects";
import { featDataSchema } from "@/lib/schemas/content-types/feat";
import {
  ACTION_TYPES,
  RECOVERY_TYPES,
  addModSchema,
  calcChangesSchema,
  languageProfsSchema,
  savetxtSchema,
  speedSchema,
  toolProfsSchema,
  visionEntrySchema,
} from "@/lib/schemas/content-types/mechanical";
import type { FeatData } from "@/lib/schemas/content-types/feat";
import type { Effect } from "@/lib/types/effects";

import type { MpmbParsedEntry } from "../types";
import {
  ABILITY_NAMES,
  hasBlockingIssues,
  isRecord,
  issue,
  normalizeAbility,
  normalizeSlug,
  normalizeString,
  normalizeStringList,
  readStaticText,
  reportUnknownFields,
} from "./normalize";
import { resolveMpmbSourceRefs } from "./sources";
import type {
  MpmbItemMapper,
  MpmbMappedItem,
  MpmbMappingIssue,
} from "./types";

const FEAT_FIELDS = new Set([
  "action",
  "addMod",
  "additional",
  "additionalText",
  "armorOptions",
  "armorProfs",
  "calcChanges",
  "calculate",
  "changeeval",
  "choiceDependencies",
  "choices",
  "companionCallback",
  "creaturesAdd",
  "description",
  "descriptionFull",
  "dmgres",
  "eval",
  "extraAC",
  "extraLimitedFeatures",
  "extraTimes",
  "extrachoices",
  "languageProfs",
  "name",
  "prereqeval",
  "prerequisite",
  "prerequisites",
  "recovery",
  "removeeval",
  "scores",
  "scoresMaximum",
  "scorestxt",
  "scoretxt",
  "selfChoosing",
  "savetxt",
  "skills",
  "skillstxt",
  "source",
  "speed",
  "spellcastingAbility",
  "spellcastingBonus",
  "spellcastingExtra",
  "spellcastingList",
  "toolProfs",
  "usages",
  "usagescalc",
  "vision",
  "weaponOptions",
  "weaponProfs",
]);

const NOT_AUTOMATED_FIELDS = [
  "additional",
  "additionalText",
  "armorOptions",
  "calculate",
  "changeeval",
  "choiceDependencies",
  "choices",
  "companionCallback",
  "creaturesAdd",
  "eval",
  "extraTimes",
  "extrachoices",
  "removeeval",
  "selfChoosing",
  "spellcastingExtra",
  "spellcastingList",
  "usagescalc",
  "weaponOptions",
] as const;

const ACTION_ALIASES = new Map<string, (typeof ACTION_TYPES)[number]>([
  ["action", "action"],
  ["bonus", "bonus action"],
  ["bonus action", "bonus action"],
  ["reaction", "reaction"],
  ["free", "free"],
  ["free action", "free"],
]);

const RECOVERY_VALUES = new Set<string>(RECOVERY_TYPES);
const ABILITY_SET = new Set<string>(ABILITY_NAMES);

/** Map one statically parsed MPMB FeatsList entry into a review candidate. */
export const mapMpmbFeat: MpmbItemMapper = (entry, context) => {
  const issues: MpmbMappingIssue[] = [];

  // Unknown top-level properties are always reported before Zod is consulted.
  reportUnknownFields(entry, FEAT_FIELDS, issues);

  const name = normalizeString(entry.data.name);
  if (!name) {
    issues.push(
      issue(
        entry,
        "feat.name.required",
        "blocking",
        "missing_required",
        "name",
        "A feat needs a non-empty name",
      ),
    );
  }

  const slug = normalizeSlug(entry.key) || (name ? normalizeSlug(name) : "");
  if (!slug) {
    issues.push(
      issue(
        entry,
        "feat.slug.required",
        "blocking",
        "missing_required",
        "key",
        "A feat needs a registry key or name that can produce a trustworthy slug",
      ),
    );
  }

  if (entry.registry !== "FeatsList") {
    issues.push(
      issue(
        entry,
        "feat.registry.invalid",
        "blocking",
        "invalid_value",
        "registry",
        "The feat mapper only accepts FeatsList entries",
      ),
    );
  }

  const { refs: sourceRefs, issues: sourceIssues } = resolveMpmbSourceRefs(
    entry,
    entry.data.source,
    context.sourcesByKey,
  );
  issues.push(...sourceIssues);

  const description = readDescription(entry, issues);
  const prerequisites = readPrerequisites(entry, issues);
  const scores = readAbilityScores(entry, "scores", issues);
  const scoresMaximum = readAbilityScores(entry, "scoresMaximum", issues);
  const scorestxt = readAliasedText(entry, "scorestxt", "scoretxt", issues);
  const action = readAction(entry, issues);
  const usages = readUsages(entry, issues);
  const recovery = readRecovery(entry, issues);
  const speed = readStrictObject(entry, "speed", speedSchema.strict(), issues);
  const vision = readVision(entry, issues);
  const dmgres = readStringArray(entry, "dmgres", issues);
  const savetxt = readSavetxt(entry, issues);
  const skills = readStringArray(entry, "skills", issues);
  const skillstxt = readOptionalText(entry, "skillstxt", issues);
  const weaponProfs = readStringArray(entry, "weaponProfs", issues);
  const armorProfs = readStringArray(entry, "armorProfs", issues);
  const toolProfs = readToolProfs(entry, issues);
  const languageProfs = readLanguageProfs(entry, issues);
  const extraAC = readExtraAc(entry, issues);
  const spellcastingAbility = readSpellcastingAbility(entry, issues);
  const spellcastingBonus = readAdvanced(
    entry,
    "spellcastingBonus",
    featDataSchema.shape.spellcastingBonus,
    issues,
    true,
  );
  const extraLimitedFeatures = readAdvanced(
    entry,
    "extraLimitedFeatures",
    featDataSchema.shape.extraLimitedFeatures,
    issues,
  );
  const calcChanges = readAdvanced(
    entry,
    "calcChanges",
    calcChangesSchema,
    issues,
  );
  const addMod = readAdvanced(entry, "addMod", addModSchema, issues);

  reportNotAutomatedFields(entry, issues);
  reportPrerequisiteEvaluator(entry, issues);

  const rawData: Record<string, unknown> = {
    ...(description ? { description } : {}),
    prerequisites,
    ...(scores ? { scores } : {}),
    ...(scoresMaximum ? { scoresMaximum } : {}),
    ...(scorestxt ? { scorestxt } : {}),
    action,
    ...(usages === undefined ? {} : { usages }),
    recovery,
    ...(speed ? { speed } : {}),
    vision,
    dmgres,
    ...(savetxt ? { savetxt } : {}),
    skills,
    ...(skillstxt ? { skillstxt } : {}),
    weaponProfs,
    armorProfs,
    toolProfs,
    languageProfs,
    ...(extraAC === undefined ? {} : { extraAC }),
    spellcastingBonus,
    ...(spellcastingAbility ? { spellcastingAbility } : {}),
    extraLimitedFeatures,
    calcChanges,
    addMod,
    source_refs: sourceRefs,
  };

  const effects = buildEffects(description, scores, extraAC);
  const parsedData = featDataSchema.safeParse(rawData);
  let data: FeatData | null = null;
  if (parsedData.success) {
    data = parsedData.data;
  } else {
    for (const zodIssue of parsedData.error.issues) {
      issues.push(
        issue(
          entry,
          `feat.schema.${zodIssue.path.join(".") || "root"}`,
          "blocking",
          "schema_violation",
          zodIssue.path.join(".") || "data",
          zodIssue.message,
        ),
      );
    }
  }

  let effectsAreValid = true;
  for (const [index, effect] of effects.entries()) {
    const parsedEffect = effectSchema.safeParse(effect);
    if (!parsedEffect.success) {
      effectsAreValid = false;
      for (const zodIssue of parsedEffect.error.issues) {
        const suffix = zodIssue.path.length > 0 ? `.${zodIssue.path.join(".")}` : "";
        issues.push(
          issue(
            entry,
            `feat.effect.schema.${index}${suffix}`,
            "blocking",
            "schema_violation",
            `effects.${index}${suffix}`,
            zodIssue.message,
          ),
        );
      }
    }
  }

  const hasIdentity = Boolean(name && slug);
  const blocked = hasBlockingIssues(issues);
  const candidate =
    hasIdentity && data && effectsAreValid
      ? {
          content_type: "feat" as const,
          slug,
          name: name as string,
          data,
          effects,
        }
      : null;

  return {
    registry: "FeatsList",
    sourceKey: entry.key,
    contentType: "feat",
    candidate,
    status: !hasIdentity ? "unsupported" : blocked ? "needs_info" : "valid",
    sourceRefs,
    location: { ...entry.location },
    issues,
  } satisfies MpmbMappedItem;
};

function readDescription(
  entry: MpmbParsedEntry,
  issues: MpmbMappingIssue[],
): string | null {
  const full = readStaticText(entry.data.descriptionFull);
  const short = readStaticText(entry.data.description);
  const description = full ?? short;
  if (description) return description;

  const supplied = entry.data.descriptionFull !== undefined || entry.data.description !== undefined;
  issues.push(
    issue(
      entry,
      supplied ? "feat.description.invalid" : "feat.description.required",
      "blocking",
      supplied ? "invalid_value" : "missing_required",
      supplied && entry.data.descriptionFull !== undefined
        ? "descriptionFull"
        : "description",
      "A feat needs a non-empty static description",
    ),
  );
  return null;
}

function readPrerequisites(
  entry: MpmbParsedEntry,
  issues: MpmbMappingIssue[],
): Array<{ stat: string; op: "gte"; value: number }> {
  const structured = entry.data.prerequisites;
  const prose = entry.data.prerequisite;

  if (structured !== undefined && prose !== undefined) {
    issues.push(
      issue(
        entry,
        "feat.prerequisite.ambiguous",
        "blocking",
        "invalid_value",
        "prerequisites",
        "Use either prerequisite or prerequisites, not both",
      ),
    );
    return [];
  }

  if (structured !== undefined) {
    if (!Array.isArray(structured) || structured.length > 1) {
      issues.push(
        issue(
          entry,
          "feat.prerequisite.compound",
          "blocking",
          "not_automated",
          "prerequisites",
          "Only one exact ability-score prerequisite can be imported automatically",
        ),
      );
      return [];
    }
    if (structured.length === 0) return [];
    const parsed = statConditionSchema.strict().safeParse(structured[0]);
    if (
      parsed.success &&
      ABILITY_SET.has(parsed.data.stat) &&
      parsed.data.op === "gte"
    ) {
      return [{ ...parsed.data, op: "gte" }];
    }
    issues.push(
      issue(
        entry,
        "feat.prerequisite.unsupported",
        "blocking",
        "not_automated",
        "prerequisites",
        "Only one { stat: ability, op: 'gte', value: number } prerequisite is supported",
      ),
    );
    return [];
  }

  if (prose === undefined || prose === null || prose === "") return [];
  const text = normalizeString(prose);
  if (!text) {
    issues.push(
      issue(
        entry,
        "feat.prerequisite.invalid",
        "blocking",
        "invalid_value",
        "prerequisite",
        "Prerequisite must be a static string",
      ),
    );
    return [];
  }

  const match = text.match(
    /^(strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha)(?: score)?(?: of)?\s+(\d+(?:\.\d+)?)\s*(?:or higher|\+)?[.;]?$/i,
  );
  if (match) {
    const ability = normalizeAbility(match[1]);
    const threshold = Number(match[2]);
    if (ability && Number.isFinite(threshold)) {
      return [{ stat: ability, op: "gte", value: threshold }];
    }
  }

  issues.push(
    issue(
      entry,
      /\b(?:and|or)\b|[,;/]/i.test(text)
        ? "feat.prerequisite.compound"
        : "feat.prerequisite.unsupported",
      "blocking",
      "not_automated",
      "prerequisite",
      "Only an exact single-ability prerequisite such as 'Strength 13 or higher' can be imported automatically",
    ),
  );
  return [];
}

function readAbilityScores(
  entry: MpmbParsedEntry,
  key: "scores" | "scoresMaximum",
  issues: MpmbMappingIssue[],
): [number, number, number, number, number, number] | undefined {
  const value = entry.data[key];
  if (value === undefined) return undefined;
  if (
    Array.isArray(value) &&
    value.length === 6 &&
    value.every((score) => typeof score === "number" && Number.isInteger(score))
  ) {
    return [...value] as [number, number, number, number, number, number];
  }
  issues.push(
    issue(
      entry,
      value instanceof Array && value.length === 7
        ? `feat.${key}.seventh_ability_unsupported`
        : `feat.${key}.invalid`,
      "blocking",
      value instanceof Array && value.length === 7
        ? "not_automated"
        : "invalid_value",
      key,
      value instanceof Array && value.length === 7
        ? `${key} contains MPMB's optional seventh ability and cannot be truncated safely`
        : `${key} must contain exactly six integer values in STR, DEX, CON, INT, WIS, CHA order`,
    ),
  );
  return undefined;
}

function readAliasedText(
  entry: MpmbParsedEntry,
  preferredKey: string,
  aliasKey: string,
  issues: MpmbMappingIssue[],
): string | undefined {
  const preferred = entry.data[preferredKey];
  const alias = entry.data[aliasKey];
  if (preferred !== undefined && alias !== undefined && preferred !== alias) {
    issues.push(
      issue(
        entry,
        `feat.${preferredKey}.ambiguous_alias`,
        "warning",
        "lossy_normalization",
        preferredKey,
        `${preferredKey} takes precedence over the MPMB ${aliasKey} alias`,
      ),
    );
  }
  return readOptionalText(entry, preferred !== undefined ? preferredKey : aliasKey, issues);
}

function readOptionalText(
  entry: MpmbParsedEntry,
  key: string,
  issues: MpmbMappingIssue[],
): string | undefined {
  const value = entry.data[key];
  if (value === undefined) return undefined;
  const text = normalizeString(value);
  if (text) return text;
  issues.push(
    issue(
      entry,
      `feat.${key}.invalid`,
      "warning",
      "invalid_value",
      key,
      `${key} must be a non-empty string when supplied`,
    ),
  );
  return undefined;
}

function readAction(
  entry: MpmbParsedEntry,
  issues: MpmbMappingIssue[],
): (typeof ACTION_TYPES)[number] | null {
  const value = entry.data.action;
  if (value === undefined || value === null || value === "") return null;

  let actionValue: unknown = value;
  if (Array.isArray(value)) {
    if (
      value.length < 1 ||
      value.length > 2 ||
      typeof value[0] !== "string" ||
      (value.length === 2 && typeof value[1] !== "string")
    ) {
      return invalidAction(entry, issues);
    }
    actionValue = value[0];
    const label = value[1];
    if (typeof label === "string" && label.trim()) {
      issues.push(
        issue(
          entry,
          "feat.action.label_lossy",
          "warning",
          "lossy_normalization",
          "action.1",
          "The action label is not represented by the feat schema; the action type was retained",
        ),
      );
    }
  }

  if (typeof actionValue === "string") {
    const action = ACTION_ALIASES.get(actionValue.trim().toLowerCase());
    if (action) return action;
  }
  return invalidAction(entry, issues);
}

function invalidAction(
  entry: MpmbParsedEntry,
  issues: MpmbMappingIssue[],
): null {
  issues.push(
    issue(
      entry,
      "feat.action.invalid",
      "blocking",
      "invalid_value",
      "action",
      "Action must be a supported string or [action, label] tuple",
    ),
  );
  return null;
}

function readUsages(
  entry: MpmbParsedEntry,
  issues: MpmbMappingIssue[],
): number | Array<number | null> | undefined {
  const value = entry.data.usages;
  if (value === undefined) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    Array.isArray(value) &&
    value.length === 20 &&
    value.every(
      (item) => item === null || (typeof item === "number" && Number.isFinite(item)),
    )
  ) {
    return [...value] as Array<number | null>;
  }
  issues.push(
    issue(
      entry,
      "feat.usages.not_automated",
      "warning",
      "not_automated",
      "usages",
      "Usages must be a static number or a 20-level number/null array; dynamic usage formulas were not imported",
    ),
  );
  return undefined;
}

function readRecovery(
  entry: MpmbParsedEntry,
  issues: MpmbMappingIssue[],
): (typeof RECOVERY_TYPES)[number] | null {
  const value = entry.data.recovery;
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (RECOVERY_VALUES.has(normalized)) {
      return normalized as (typeof RECOVERY_TYPES)[number];
    }
  }
  issues.push(
    issue(
      entry,
      "feat.recovery.invalid",
      "blocking",
      "invalid_value",
      "recovery",
      "Recovery must be short rest, long rest, dawn, or day",
    ),
  );
  return null;
}

function readStrictObject<T>(
  entry: MpmbParsedEntry,
  key: string,
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
  issues: MpmbMappingIssue[],
): T | undefined {
  const value = entry.data[key];
  if (value === undefined) return undefined;
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  issues.push(
    issue(
      entry,
      `feat.${key}.not_automated`,
      "warning",
      "not_automated",
      key,
      `${key} is not in the safe schema-supported shape and was not imported`,
    ),
  );
  return undefined;
}

function readVision(
  entry: MpmbParsedEntry,
  issues: MpmbMappingIssue[],
): Array<{ type: "darkvision" | "blindsight" | "truesight" | "tremorsense"; range: number }> {
  const value = entry.data.vision;
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    reportUnsupportedShape(entry, "vision", issues);
    return [];
  }

  const result: Array<{
    type: "darkvision" | "blindsight" | "truesight" | "tremorsense";
    range: number;
  }> = [];
  for (const [index, candidate] of value.entries()) {
    const normalized = Array.isArray(candidate) && candidate.length === 2
      ? { type: typeof candidate[0] === "string" ? candidate[0].trim().toLowerCase() : candidate[0], range: candidate[1] }
      : candidate;
    const parsed = visionEntrySchema.strict().safeParse(normalized);
    if (parsed.success) {
      result.push(parsed.data);
    } else {
      issues.push(
        issue(
          entry,
          `feat.vision.${index}.not_automated`,
          "warning",
          "not_automated",
          `vision.${index}`,
          "This vision entry is dynamic or unsupported and was not imported",
        ),
      );
    }
  }
  return result;
}

function readStringArray(
  entry: MpmbParsedEntry,
  key: string,
  issues: MpmbMappingIssue[],
): string[] {
  const value = entry.data[key];
  if (value === undefined) return [];
  const normalized = normalizeStringList(value);
  if (normalized) return normalized;
  reportUnsupportedShape(entry, key, issues);
  return [];
}

function readSavetxt(
  entry: MpmbParsedEntry,
  issues: MpmbMappingIssue[],
): { adv_vs: string[]; immune: string[] } | undefined {
  const value = entry.data.savetxt;
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    reportUnsupportedShape(entry, "savetxt", issues);
    return undefined;
  }
  const extraKeys = Object.keys(value).filter((key) => key !== "adv_vs" && key !== "immune");
  if (extraKeys.length > 0) {
    issues.push(
      issue(
        entry,
        "feat.savetxt.extra_fields",
        "warning",
        "lossy_normalization",
        "savetxt",
        `Unsupported savetxt fields were not imported: ${extraKeys.sort().join(", ")}`,
      ),
    );
  }
  const normalized = {
    adv_vs: normalizeStringList(value.adv_vs ?? []) ?? null,
    immune: normalizeStringList(value.immune ?? []) ?? null,
  };
  if (!normalized.adv_vs || !normalized.immune) {
    reportUnsupportedShape(entry, "savetxt", issues);
    return undefined;
  }
  const parsed = savetxtSchema.safeParse(normalized);
  return parsed.success ? parsed.data : undefined;
}

function readToolProfs(
  entry: MpmbParsedEntry,
  issues: MpmbMappingIssue[],
): Array<string | { choose: number; from: string | string[] }> {
  const value = entry.data.toolProfs;
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    reportUnsupportedShape(entry, "toolProfs", issues);
    return [];
  }

  const result: Array<string | { choose: number; from: string | string[] }> = [];
  for (const [index, candidate] of value.entries()) {
    if (typeof candidate === "string") {
      const tool = normalizeString(candidate)?.toLowerCase();
      if (tool) result.push(tool);
      else reportUnsupportedTuple(entry, "toolProfs", index, issues);
      continue;
    }
    if (Array.isArray(candidate) && candidate.length === 2) {
      const tool = normalizeString(candidate[0])?.toLowerCase();
      if (tool && typeof candidate[1] === "number" && Number.isInteger(candidate[1]) && candidate[1] > 0) {
        result.push({ choose: candidate[1], from: tool });
        continue;
      }
      if (tool && typeof candidate[1] === "string" && /^[a-z]{3}$/i.test(candidate[1].trim())) {
        result.push(tool);
        issues.push(
          issue(
            entry,
            `feat.toolProfs.${index}.ability_lossy`,
            "warning",
            "lossy_normalization",
            `toolProfs.${index}.1`,
            "The MPMB tool ability association is not represented by the feat schema; the proficiency was retained",
          ),
        );
        continue;
      }
    }
    const parsed = toolProfsSchema.safeParse([candidate]);
    if (parsed.success) {
      result.push(parsed.data[0]);
    } else {
      reportUnsupportedTuple(entry, "toolProfs", index, issues);
    }
  }
  return result;
}

function readLanguageProfs(
  entry: MpmbParsedEntry,
  issues: MpmbMappingIssue[],
): Array<string | { choose: number; from: "any" | string[] }> {
  const value = entry.data.languageProfs;
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    reportUnsupportedShape(entry, "languageProfs", issues);
    return [];
  }

  const result: Array<string | { choose: number; from: "any" | string[] }> = [];
  for (const [index, candidate] of value.entries()) {
    if (typeof candidate === "string") {
      const language = normalizeString(candidate)?.toLowerCase();
      if (language) result.push(language);
      else reportUnsupportedTuple(entry, "languageProfs", index, issues);
      continue;
    }
    if (typeof candidate === "number" && Number.isInteger(candidate) && candidate > 0) {
      result.push({ choose: candidate, from: "any" });
      continue;
    }
    const parsed = languageProfsSchema.safeParse([candidate]);
    if (parsed.success) result.push(parsed.data[0]);
    else reportUnsupportedTuple(entry, "languageProfs", index, issues);
  }
  return result;
}

function readExtraAc(
  entry: MpmbParsedEntry,
  issues: MpmbMappingIssue[],
): number | undefined {
  const value = entry.data.extraAC;
  if (value === undefined) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    isRecord(value) &&
    Object.keys(value).length === 1 &&
    typeof value.mod === "number" &&
    Number.isFinite(value.mod)
  ) {
    return value.mod;
  }
  issues.push(
    issue(
      entry,
      "feat.extraAC.not_automated",
      "warning",
      "not_automated",
      "extraAC",
      "Only an unconditional numeric AC bonus (or { mod: number }) can be imported automatically",
    ),
  );
  return undefined;
}

function readSpellcastingAbility(
  entry: MpmbParsedEntry,
  issues: MpmbMappingIssue[],
): string | undefined {
  const value = entry.data.spellcastingAbility;
  if (value === undefined) return undefined;
  const ability = normalizeAbility(value);
  if (ability) return ability;
  issues.push(
    issue(
      entry,
      "feat.spellcastingAbility.invalid",
      "blocking",
      "invalid_value",
      "spellcastingAbility",
      "Spellcasting ability must identify one of the six standard abilities",
    ),
  );
  return undefined;
}

function readAdvanced<T>(
  entry: MpmbParsedEntry,
  key: string,
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
  issues: MpmbMappingIssue[],
  allowSingleton = false,
): T {
  const absent = schema.safeParse(undefined);
  const value = entry.data[key];
  if (value === undefined) {
    if (absent.success) return absent.data;
    throw new Error(`Schema for ${key} must define an absent default`);
  }

  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  if (allowSingleton) {
    const singleton = schema.safeParse([value]);
    if (singleton.success) return singleton.data;
  }
  issues.push(
    issue(
      entry,
      `feat.${key}.not_automated`,
      "warning",
      "not_automated",
      key,
      `${key} is not already in the destination schema shape and was not imported`,
    ),
  );
  if (absent.success) return absent.data;
  throw new Error(`Schema for ${key} must define an absent default`);
}

function reportNotAutomatedFields(
  entry: MpmbParsedEntry,
  issues: MpmbMappingIssue[],
): void {
  for (const key of NOT_AUTOMATED_FIELDS) {
    if (entry.data[key] === undefined) continue;
    issues.push(
      issue(
        entry,
        `feat.${key}.not_automated`,
        "warning",
        "not_automated",
        key,
        `MPMB field ${key} contains unsupported mechanics and was not imported`,
      ),
    );
  }
}

function reportPrerequisiteEvaluator(
  entry: MpmbParsedEntry,
  issues: MpmbMappingIssue[],
): void {
  if (entry.data.prereqeval === undefined) return;
  issues.push(
    issue(
      entry,
      "feat.prereqeval.not_automated",
      entry.data.prerequisite === undefined && entry.data.prerequisites === undefined
        ? "blocking"
        : "warning",
      "not_automated",
      "prereqeval",
      "Executable prerequisite evaluation is not run; provide an exact static ability prerequisite for automatic import",
    ),
  );
}

function reportUnsupportedShape(
  entry: MpmbParsedEntry,
  key: string,
  issues: MpmbMappingIssue[],
): void {
  issues.push(
    issue(
      entry,
      `feat.${key}.not_automated`,
      "warning",
      "not_automated",
      key,
      `${key} is not in a safe supported shape and was not imported`,
    ),
  );
}

function reportUnsupportedTuple(
  entry: MpmbParsedEntry,
  key: string,
  index: number,
  issues: MpmbMappingIssue[],
): void {
  issues.push(
    issue(
      entry,
      `feat.${key}.${index}.not_automated`,
      "warning",
      "not_automated",
      `${key}.${index}`,
      `This ${key} entry is not in a safe supported shape and was not imported`,
    ),
  );
}

function buildEffects(
  description: string | null,
  scores: readonly number[] | undefined,
  extraAC: number | undefined,
): Effect[] {
  const effects: Effect[] = [];
  if (description) {
    effects.push({ type: "narrative", text: description, tag: "Feat" });
  }
  if (scores) {
    for (const [index, score] of scores.entries()) {
      const ability = ABILITY_NAMES[index];
      if (ability && score !== 0) {
        effects.push({ type: "mechanical", stat: ability, op: "add", value: score });
      }
    }
  }
  if (extraAC !== undefined && extraAC !== 0) {
    effects.push({ type: "mechanical", stat: "armor_class", op: "add", value: extraAC });
  }
  return effects;
}
