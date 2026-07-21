import { spellDataSchema, type SpellData } from "@/lib/schemas/content-types/spell";

import type { MpmbParsedEntry } from "../types";
import {
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
  MpmbItemMappingContext,
  MpmbMappedItem,
  MpmbMappingIssue,
  MpmbSpellCandidate,
} from "./types";

const SPELL_FIELDS = new Set([
  "name",
  "source",
  "level",
  "school",
  "time",
  "range",
  "components",
  "compMaterial",
  "duration",
  "concentration",
  "ritual",
  "description",
  "descriptionFull",
  "higher_level",
  "classes",
  "subclasses",
  "dependencies",
  "attackType",
  "attack_type",
  "save",
  "damage",
  "heal_at_slot_level",
  "dc",
  "area_of_effect",
  "descriptionCantripDie",
]);

const SCHOOL_ALIASES = new Map<string, SpellData["school"]>([
  ["abjur", "abjuration"],
  ["abjuration", "abjuration"],
  ["conj", "conjuration"],
  ["conjuration", "conjuration"],
  ["div", "divination"],
  ["divination", "divination"],
  ["ench", "enchantment"],
  ["enchantment", "enchantment"],
  ["evoc", "evocation"],
  ["evocation", "evocation"],
  ["illus", "illusion"],
  ["illusion", "illusion"],
  ["necro", "necromancy"],
  ["necromancy", "necromancy"],
  ["trans", "transmutation"],
  ["transmutation", "transmutation"],
]);

export function mapMpmbSpell(
  entry: MpmbParsedEntry,
  context: MpmbItemMappingContext,
): MpmbMappedItem {
  const issues: MpmbMappingIssue[] = [];
  const sourceResult = resolveMpmbSourceRefs(
    entry,
    entry.data.source,
    context.sourcesByKey,
  );
  issues.push(...sourceResult.issues);

  const slug = normalizeSlug(entry.key);
  const name = normalizeString(entry.data.name);
  if (!slug || !name) {
    if (!slug) {
      issues.push(
        issue(
          entry,
          "spell.slug.required",
          "blocking",
          "missing_required",
          "key",
          "The MPMB spell key cannot produce a stable Inkborne slug",
        ),
      );
    }
    if (!name) {
      issues.push(
        issue(
          entry,
          "spell.name.required",
          "blocking",
          "missing_required",
          "name",
          "Spells need a non-empty name",
        ),
      );
    }
    reportUnknownFields(entry, SPELL_FIELDS, issues);
    return mappedSpell(entry, null, "unsupported", sourceResult.refs, issues);
  }

  const description =
    readStaticText(entry.data.description) ??
    readStaticText(entry.data.descriptionFull);
  const descriptionFull = readStaticText(entry.data.descriptionFull);
  const level = readSpellLevel(entry, issues);
  const school = readSpellSchool(entry, issues);
  const castingTime = readRequiredString(entry, "time", issues);
  const range = readRequiredString(entry, "range", issues);
  const duration = readRequiredString(entry, "duration", issues);
  const components = readComponents(entry, issues);
  const material = normalizeString(entry.data.compMaterial);
  const concentration = readConcentration(entry, duration, issues);
  const ritual = readBoolean(entry, "ritual", false, issues);

  if (!description) {
    issues.push(
      issue(
        entry,
        "spell.description.required",
        "blocking",
        "missing_required",
        "description",
        "Spells need a static description or descriptionFull value",
      ),
    );
  }
  if (components.includes("M") && !material) {
    issues.push(
      issue(
        entry,
        "spell.material.required",
        "blocking",
        "missing_required",
        "compMaterial",
        "A spell with an M component needs its material component text",
      ),
    );
  } else if (material && !components.includes("M")) {
    issues.push(
      issue(
        entry,
        "spell.material.without_component",
        "warning",
        "lossy_normalization",
        "compMaterial",
        "Material text was supplied without an M component",
      ),
    );
  }

  const classes = readSlugList(entry, "classes", issues);
  const subclasses = readSlugList(entry, "subclasses", issues);
  const dependencies = readSlugList(entry, "dependencies", issues);
  const attackType = readAttackType(entry, issues);
  const damage = readStructuredField(
    entry,
    "damage",
    spellDataSchema.shape.damage,
    null,
    issues,
  );
  const healAtSlotLevel = readStructuredField(
    entry,
    "heal_at_slot_level",
    spellDataSchema.shape.heal_at_slot_level,
    null,
    issues,
  );
  const areaOfEffect = readStructuredField(
    entry,
    "area_of_effect",
    spellDataSchema.shape.area_of_effect,
    null,
    issues,
  );
  const dc = readSpellDc(entry, issues);
  const cantripDie = readCantripDie(entry, issues);
  reportUnknownFields(entry, SPELL_FIELDS, issues);

  const rawData = {
    level,
    school,
    casting_time: castingTime,
    range,
    components,
    ...(material ? { material } : {}),
    duration,
    concentration,
    ritual,
    description,
    ...(descriptionFull ? { descriptionFull } : {}),
    ...(readStaticText(entry.data.higher_level)
      ? { higher_level: readStaticText(entry.data.higher_level) }
      : {}),
    attack_type: attackType,
    damage,
    heal_at_slot_level: healAtSlotLevel,
    dc,
    area_of_effect: areaOfEffect,
    classes,
    subclasses,
    ...(cantripDie ? { descriptionCantripDie: cantripDie } : {}),
    dependencies,
  };

  const parsed = spellDataSchema.safeParse(rawData);
  if (!parsed.success) {
    for (const schemaIssue of parsed.error.issues) {
      issues.push(
        issue(
          entry,
          "spell.schema.invalid",
          "blocking",
          "schema_violation",
          schemaIssue.path.join("."),
          schemaIssue.message,
        ),
      );
    }
  }

  const candidate: MpmbSpellCandidate | null = parsed.success
    ? {
        content_type: "spell",
        slug,
        name,
        data: parsed.data,
        effects: [],
      }
    : null;
  const status =
    candidate && !hasBlockingIssues(issues) ? "valid" : "needs_info";
  return mappedSpell(entry, candidate, status, sourceResult.refs, issues);
}

function mappedSpell(
  entry: MpmbParsedEntry,
  candidate: MpmbSpellCandidate | null,
  status: MpmbMappedItem["status"],
  sourceRefs: MpmbMappedItem["sourceRefs"],
  issues: MpmbMappingIssue[],
): MpmbMappedItem {
  return {
    registry: "SpellsList",
    sourceKey: entry.key,
    contentType: "spell",
    candidate,
    status,
    sourceRefs,
    location: entry.location,
    issues,
  };
}

function readSpellLevel(
  entry: MpmbParsedEntry,
  issues: MpmbMappingIssue[],
): number | undefined {
  const value = entry.data.level;
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 9) {
    return value;
  }
  issues.push(
    issue(
      entry,
      "spell.level.invalid",
      "blocking",
      value === undefined ? "missing_required" : "invalid_value",
      "level",
      "Spell level must be an integer from 0 through 9",
    ),
  );
  return undefined;
}

function readSpellSchool(
  entry: MpmbParsedEntry,
  issues: MpmbMappingIssue[],
): SpellData["school"] | undefined {
  const value = normalizeString(entry.data.school)?.toLowerCase();
  const school = value ? SCHOOL_ALIASES.get(value) : undefined;
  if (school) return school;
  issues.push(
    issue(
      entry,
      "spell.school.invalid",
      "blocking",
      value === undefined ? "missing_required" : "invalid_value",
      "school",
      "Spell school must be a supported full name or MPMB abbreviation",
    ),
  );
  return undefined;
}

function readRequiredString(
  entry: MpmbParsedEntry,
  key: string,
  issues: MpmbMappingIssue[],
): string | undefined {
  const value = normalizeString(entry.data[key]);
  if (value) return key === "time" ? normalizeCastingTime(value) : value;
  issues.push(
    issue(
      entry,
      `spell.${key}.required`,
      "blocking",
      "missing_required",
      key,
      `Spell ${key} must be a non-empty string`,
    ),
  );
  return undefined;
}

function normalizeCastingTime(value: string): string {
  const normalized = value.trim().toLowerCase();
  const aliases: Record<string, string> = {
    "1 a": "1 action",
    "1 ba": "1 bonus action",
    "1 rea": "1 reaction",
  };
  return aliases[normalized] ?? value;
}

function readComponents(
  entry: MpmbParsedEntry,
  issues: MpmbMappingIssue[],
): Array<"V" | "S" | "M"> {
  const raw = entry.data.components;
  const tokens = typeof raw === "string"
    ? raw.split(/[\s,]+/)
    : Array.isArray(raw)
      ? raw
      : null;
  const stringTokens =
    tokens && tokens.every((token) => typeof token === "string")
      ? tokens as string[]
      : null;
  if (
    !stringTokens ||
    stringTokens.some(
      (token) => !["V", "S", "M"].includes(token.trim().toUpperCase()),
    )
  ) {
    issues.push(
      issue(
        entry,
        "spell.components.invalid",
        "blocking",
        raw === undefined ? "missing_required" : "invalid_value",
        "components",
        "Components must contain only V, S, and M",
      ),
    );
    return [];
  }
  return [...new Set(stringTokens.map((token) => token.trim().toUpperCase()))] as Array<
    "V" | "S" | "M"
  >;
}

function readConcentration(
  entry: MpmbParsedEntry,
  duration: string | undefined,
  issues: MpmbMappingIssue[],
): boolean {
  if (entry.data.concentration === undefined) {
    return duration ? /^(?:conc\.?|concentration)\b/i.test(duration) : false;
  }
  return readBoolean(entry, "concentration", false, issues);
}

function readBoolean(
  entry: MpmbParsedEntry,
  key: string,
  fallback: boolean,
  issues: MpmbMappingIssue[],
): boolean {
  const value = entry.data[key];
  if (value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  issues.push(
    issue(
      entry,
      `spell.${key}.invalid`,
      "blocking",
      "invalid_value",
      key,
      `Spell ${key} must be a boolean when supplied`,
    ),
  );
  return fallback;
}

function readSlugList(
  entry: MpmbParsedEntry,
  key: string,
  issues: MpmbMappingIssue[],
): string[] {
  if (entry.data[key] === undefined) return [];
  const values = normalizeStringList(entry.data[key]);
  if (values) return values.map(normalizeSlug).filter(Boolean);
  issues.push(
    issue(
      entry,
      `spell.${key}.invalid`,
      "blocking",
      "invalid_value",
      key,
      `Spell ${key} must be a string or array of strings`,
    ),
  );
  return [];
}

function readAttackType(
  entry: MpmbParsedEntry,
  issues: MpmbMappingIssue[],
): "melee" | "ranged" | null {
  const raw = entry.data.attack_type ?? entry.data.attackType;
  if (raw === undefined || raw === null) return null;
  const value = normalizeString(raw)?.toLowerCase();
  if (value === "melee" || value === "ranged") return value;
  issues.push(
    issue(
      entry,
      "spell.attack_type.invalid",
      "warning",
      "not_automated",
      "attackType",
      "Only melee or ranged spell attack types can be automated",
    ),
  );
  return null;
}

function readSpellDc(
  entry: MpmbParsedEntry,
  issues: MpmbMappingIssue[],
): SpellData["dc"] {
  if (entry.data.dc !== undefined) {
    return readStructuredField(
      entry,
      "dc",
      spellDataSchema.shape.dc,
      null,
      issues,
    );
  }
  if (entry.data.save === undefined) return null;
  const ability = normalizeAbility(entry.data.save);
  issues.push(
    issue(
      entry,
      ability ? "spell.save.success_unknown" : "spell.save.invalid",
      "blocking",
      ability ? "not_automated" : "invalid_value",
      "save",
      ability
        ? `Save ability ${ability} was recognized, but the success outcome cannot be inferred safely`
        : "Spell save must identify a supported ability",
    ),
  );
  return null;
}

function readCantripDie(
  entry: MpmbParsedEntry,
  issues: MpmbMappingIssue[],
): SpellData["descriptionCantripDie"] | undefined {
  const value = entry.data.descriptionCantripDie;
  if (value === undefined) return undefined;
  if (isRecord(value)) {
    const parsed = spellDataSchema.shape.descriptionCantripDie.safeParse(value);
    if (parsed.success) return parsed.data;
  }
  issues.push(
    issue(
      entry,
      "spell.cantrip_die.not_automated",
      "warning",
      "not_automated",
      "descriptionCantripDie",
      "Cantrip scaling is mapped only from the exact structured { die, levels } shape",
    ),
  );
  return undefined;
}

function readStructuredField<T>(
  entry: MpmbParsedEntry,
  key: string,
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
  fallback: T,
  issues: MpmbMappingIssue[],
): T {
  const value = entry.data[key];
  if (value === undefined) return fallback;
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  issues.push(
    issue(
      entry,
      `spell.${key}.invalid`,
      "blocking",
      "invalid_value",
      key,
      `Spell ${key} must already match Inkborne's structured schema`,
    ),
  );
  return fallback;
}
