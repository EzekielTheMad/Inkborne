import { z } from "zod";
import type { CharacterChoices } from "@/lib/types/character";
import { classRoleForRef, originalClassOccurrence } from "./builder-class-roles";
import type { SubclassHitPointRef } from "./subclass-hit-points";

export type AncestryHitPointRef = SubclassHitPointRef;
export type AncestryHitPointBonus = { status: "available"; bonus: number } | { status: "unavailable" };
const uuid = z.uuid(), version = z.number().int().min(1).max(2_147_483_647);
const bonusKey = "hit_points_bonus_per_character_level";

/** A failed or filtered read cannot establish that optional metadata is absent.
 * The saved root declares the mechanic; race names and trait slugs do not grant HP.
 */
export function resolveAncestryHitPointBonus(character: {
  id: string; system_id: string; level: number; choices: CharacterChoices; action_revision?: string | number; revision?: string;
}, refs: readonly AncestryHitPointRef[], snapshotsComplete: boolean): AncestryHitPointBonus {
  const unavailable = { status: "unavailable" as const };
  if (!snapshotsComplete) return unavailable;
  const roots = refs.filter(ref => ["race", "subrace"].includes(ref.content_definitions.content_type));
  const selected = ["race", "subrace"] as const;
  const exact = (ref: AncestryHitPointRef) => uuid.safeParse(ref.id).success && ref.character_id === character.id
    && uuid.safeParse(ref.content_id).success && version.safeParse(ref.content_version).success
    && ref.content_id === ref.content_definitions.id && ref.content_version === ref.content_definitions.version
    && ref.content_definitions.system_id === character.system_id
    && ["srd", "homebrew"].includes(ref.content_definitions.source)
    && ["platform", "personal", "shared"].includes(ref.content_definitions.scope ?? "")
    && (ref.content_definitions.owner_id === null || uuid.safeParse(ref.content_definitions.owner_id).success);
  if (new Set(roots.map(ref => ref.id)).size !== roots.length || roots.some(ref => !exact(ref))) return unavailable;
  for (const type of selected) {
    const pins = roots.filter(ref => ref.content_definitions.content_type === type), slug = character.choices[type];
    if (pins.length !== (slug ? 1 : 0) || slug && pins[0]?.content_definitions.slug !== slug) return unavailable;
  }
  const race = roots.find(ref => ref.content_definitions.content_type === "race");
  const subrace = roots.find(ref => ref.content_definitions.content_type === "subrace");
  if (subrace && (!race || subrace.content_definitions.data.parent_race !== race.content_definitions.slug)) return unavailable;
  // Valid historical roots do not need new class-role metadata to retain zero.
  if (!subrace || !Object.hasOwn(subrace.content_definitions.data, bonusKey)) return { status: "available", bonus: 0 };
  if (subrace.content_definitions.data[bonusKey] !== 1 || !race
    || roots.some(ref => ref.feature_grant_id !== null || ref.choice_source !== null
      || ref.context.source !== ref.content_definitions.content_type || Object.keys(ref.context).length !== 1)) return unavailable;

  const classes = character.choices.classes ?? [], classPins = refs.filter(ref => ref.content_definitions.content_type === "class");
  if (!uuid.safeParse(character.id).success || !uuid.safeParse(character.system_id).success
    || !Number.isInteger(character.level) || character.level < 1 || character.level > 20 || classes.length === 0
    || new Set(classes.map(cls => cls.slug)).size !== classes.length
    || new Set(classes.map(cls => cls.occurrence_id)).size !== classes.length
    || classes.some(cls => !uuid.safeParse(cls.occurrence_id).success || !Number.isInteger(cls.level) || cls.level < 1 || cls.level > 20)
    || classes.reduce((sum, cls) => sum + cls.level, 0) !== character.level || classPins.length !== classes.length
    || new Set([...roots, ...classPins].map(ref => ref.id)).size !== roots.length + classPins.length
    || !originalClassOccurrence(classPins, character.choices)) return unavailable;
  const revision = character.action_revision ?? character.revision;
  for (const cls of classes) {
    const pins = classPins.filter(ref => ref.content_definitions.slug === cls.slug), pin = pins[0];
    if (pins.length !== 1 || !exact(pin) || pin.context.source !== "class" || pin.feature_grant_id !== null
      || ![4, 6, 8, 10, 12].includes(pin.content_definitions.data.hit_die as number)) return unavailable;
    const role = classRoleForRef(pin, character.choices);
    if (!role || role.occurrence_id !== cls.occurrence_id || revision === undefined || role.action_revision !== String(revision)) return unavailable;
  }
  return { status: "available", bonus: character.level };
}
