import { z } from "zod";
import type { CharacterChoices } from "@/lib/types/character";
import type { Effect } from "@/lib/types/effects";
import { classRoleForRef, type BuilderClassRole } from "./builder-class-roles";

export interface SubclassHitPointRef {
  id: string; character_id?: string; content_id: string; content_version?: number;
  context: Record<string, unknown>; choice_source: string | null;
  feature_grant_id?: string | null; class_role?: BuilderClassRole;
  content_definitions: {
    id: string; version: number; system_id?: string; content_type: string; slug: string;
    source: string; scope?: string; owner_id?: string | null; data: Record<string, unknown>;
    effects?: Effect[];
  };
}
export type SubclassHitPointBonus = { status: "available"; bonus: number } | { status: "unavailable" };
const uuid = z.uuid(), version = z.number().int().min(1).max(2147483647);
const bonusKey = "hit_points_bonus_per_class_level";
function savedLevels(value: unknown): Array<{ level: number; subclass_level?: boolean }> | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) return null;
  const rows: Array<{ level: number; subclass_level?: boolean }> = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const row = raw as Record<string, unknown>;
    if (!Number.isInteger(row.level) || (row.level as number) < 1 || (row.level as number) > 20
      || Object.hasOwn(row, "subclass_level") && typeof row.subclass_level !== "boolean") return null;
    rows.push(row as { level: number; subclass_level?: boolean });
  }
  return new Set(rows.map(row => row.level)).size === rows.length ? rows : null;
}

/** Read only the selected immutable subclass roots. Catalog slugs and feature
 * prose never grant HP at read time. Older roots without metadata retain zero.
 * The loaded snapshot reader supplies the immutable content/version join; this
 * resolver additionally binds every new bonus to its character and occurrence.
 */
export function resolveSubclassHitPointBonus(character: {
  id: string; system_id: string; level: number; choices: CharacterChoices; action_revision?: string | number; revision?: string;
}, refs: readonly SubclassHitPointRef[]): SubclassHitPointBonus {
  const subclasses = refs.filter(ref => ref.content_definitions.content_type === "subclass");
  const declarations = subclasses.filter(ref => Object.hasOwn(ref.content_definitions.data, bonusKey));
  if (!declarations.length) return { status: "available", bonus: 0 };
  const unavailable = { status: "unavailable" as const };
  const classes = character.choices.classes ?? [];
  if (!uuid.safeParse(character.id).success || !uuid.safeParse(character.system_id).success
    || !Number.isInteger(character.level) || character.level < 1 || character.level > 20
    || classes.length === 0 || new Set(classes.map(cls => cls.slug)).size !== classes.length
    || new Set(classes.map(cls => cls.occurrence_id)).size !== classes.length
    || classes.some(cls => !uuid.safeParse(cls.occurrence_id).success || !Number.isInteger(cls.level) || cls.level < 1 || cls.level > 20)
    || classes.reduce((sum, cls) => sum + cls.level, 0) !== character.level) return unavailable;
  const classPins = refs.filter(ref => ref.content_definitions.content_type === "class");
  const roots = [...classPins, ...subclasses];
  if (classPins.length !== classes.length || subclasses.length !== classes.filter(cls => cls.subclass).length
    || new Set(roots.map(ref => ref.id)).size !== roots.length
    || roots.some(ref => !uuid.safeParse(ref.id).success || ref.character_id !== character.id
      || !uuid.safeParse(ref.content_id).success || !version.safeParse(ref.content_version).success
      || ref.content_id !== ref.content_definitions.id || ref.content_version !== ref.content_definitions.version
      || ref.content_definitions.system_id !== character.system_id
      || !["srd", "homebrew"].includes(ref.content_definitions.source)
      || !["platform", "personal", "shared"].includes(ref.content_definitions.scope ?? "")
      || !(ref.content_definitions.owner_id === null || uuid.safeParse(ref.content_definitions.owner_id).success))) return unavailable;
  let bonus = 0;
  for (const cls of classes) {
    const classMatches = classPins.filter(ref => ref.content_definitions.slug === cls.slug);
    if (classMatches.length !== 1 || classMatches[0].context.source !== "class" || classMatches[0].feature_grant_id !== null
      || ![4, 6, 8, 10, 12].includes(classMatches[0].content_definitions.data.hit_die as number)) return unavailable;
    const role = classRoleForRef(classMatches[0], character.choices);
    const revision = character.action_revision ?? character.revision;
    if (!role || role.occurrence_id !== cls.occurrence_id || revision === undefined || role.action_revision !== String(revision)) return unavailable;
    if (!cls.subclass) continue;
    const matches = subclasses.filter(ref => ref.content_definitions.slug === cls.subclass);
    if (matches.length !== 1) return unavailable;
    const pin = matches[0];
    if (pin.context.source !== "subclass" || pin.context.class !== cls.slug
      || Object.keys(pin.context).length !== 2 || pin.feature_grant_id !== null
      || pin.choice_source !== `builder:subclass:${cls.occurrence_id}`
      || pin.content_definitions.data.parent_class !== cls.slug) return unavailable;
    if (Object.hasOwn(pin.content_definitions.data, bonusKey)) {
      if (pin.content_definitions.data[bonusKey] !== 1) return unavailable;
      const classLevels = savedLevels(classMatches[0].content_definitions.data.levels);
      const subclassLevels = savedLevels(pin.content_definitions.data.levels);
      const gates = classLevels?.filter(row => row.subclass_level === true) ?? [];
      if (!classLevels || !subclassLevels || !classLevels.some(row => row.level === cls.level)
        || !gates.length || Math.min(...gates.map(row => row.level)) > cls.level
        || Math.min(...subclassLevels.map(row => row.level)) > cls.level) return unavailable;
      bonus += cls.level;
    }
  }
  return { status: "available", bonus };
}
