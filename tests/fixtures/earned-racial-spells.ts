import tiefling from "./earned-racial-spells/tiefling.json";
import legacy from "./earned-racial-spells/infernal-legacy.json";
import thaumaturgy from "./earned-racial-spells/thaumaturgy.json";
import rebuke from "./earned-racial-spells/hellish-rebuke.json";
import darkness from "./earned-racial-spells/darkness.json";
import { transformRaceEntry } from "@/scripts/transformers/races";
import { transformTraitEntry } from "@/scripts/transformers/traits";
import { transformSpellEntry } from "@/scripts/transformers/spells";
import { classDataSchema } from "@/lib/schemas/content-types/class";
import { subclassDataSchema } from "@/lib/schemas/content-types/subclass";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import type { CharacterSpell } from "@/lib/types/spells";
import type { CastingAbilityInput } from "@/lib/spells/casting-ability";
import type { EarnedRacialSpellSource } from "@/lib/schemas/racial-spells";

// Genuine cached API bytes are golden transformer inputs; native authority and
// Auth are deliberately not simulated by this loaded-reader fixture.
export const infernalInputs = { tiefling, trait: legacy, spells: [thaumaturgy, rebuke, darkness] };
export const racialId = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export function earnedRacialFixture(level = 5) {
  const character = { id: racialId(1), system_id: racialId(2), level, action_revision: "7",
    choices: { race: "tiefling", classes: [{ slug: "bard", level: Math.min(3, level), occurrence_id: racialId(3) },
      ...(level > 3 ? [{ slug: "wizard", level: level - 3, occurrence_id: racialId(4) }] : [])] } };
  const definition = (n: number, type: string, slug: string, data: Record<string, unknown>, effects: ContentRefWithContent["content_definitions"]["effects"] = []) => ({
    id: racialId(n), version: 1, system_id: character.system_id, content_type: type, slug, name: slug,
    source: "srd" as const, scope: "platform" as const, owner_id: null, version_created_at: "2026-10-24T00:00:00.000000Z", data, effects,
  });
  const classes: ContentRefWithContent[] = character.choices.classes.map((cls, i) => {
    const data = classDataSchema.parse({ hit_die: cls.slug === "bard" ? 8 : 6,
      spellcasting: { type: "full", ability: cls.slug === "bard" ? "charisma" : "intelligence", ritual_casting: true },
      spellcastingKnown: { prepared: cls.slug === "wizard", spells: cls.slug === "wizard" ? "all" : Array(20).fill(6), cantrips: Array(20).fill(cls.slug === "wizard" ? 3 : 2) },
      multiclass: { prerequisites: [], proficiencies_gained: [] }, saving_throws: [], starting_proficiencies: [],
      levels: Array.from({ length: 20 }, (_, n) => ({ level: n + 1, features: [], spellcasting: { spell_slots: n === 0 ? [2, 0, 0, 0, 0, 0, 0, 0, 0] : n === 1 ? [3, 0, 0, 0, 0, 0, 0, 0, 0] : [4, 2, 0, 0, 0, 0, 0, 0, 0] } })),
    });
    const pin: ContentRefWithContent = { id: racialId(5 + i), character_id: character.id, content_id: racialId(7 + i), content_version: 1,
      context: { source: "class", level: 1 }, choice_source: null, feature_grant_id: null, created_at: "2026-10-24T01:00:00.000000Z",
      content_definitions: definition(7 + i, "class", cls.slug, data) };
    pin.class_role = { occurrence_id: cls.occurrence_id, controller_ref_id: pin.id, content_id: pin.content_id, content_version: 1,
      role: i === 0 ? "original" : "secondary", action_revision: character.action_revision,
      raw_effects: [], evaluation_effects: [], raw_data: structuredClone(data), evaluation_data: structuredClone(data) };
    return pin;
  });
  const transformed = transformRaceEntry(tiefling, { trait: legacy, spells: [thaumaturgy, rebuke, darkness] });
  const root: ContentRefWithContent = { id: racialId(10), character_id: character.id, content_id: racialId(11), content_version: 2,
    context: { source: "race" }, choice_source: null, feature_grant_id: null, created_at: "2026-10-25T00:00:00.000001Z",
    content_definitions: { ...definition(11, "race", "tiefling", transformed.data, transformed.effects), version: 2,
      name: "Tiefling", version_created_at: "2026-10-25T00:00:00.000001Z" } };
  const transformedTrait = transformTraitEntry(legacy);
  const trait: ContentRefWithContent = { id: racialId(12), character_id: character.id, content_id: racialId(13), content_version: 1,
    context: { source: "racial_trait", root_controller_ref_id: root.id }, choice_source: "builder:racial-trait:infernal-legacy",
    feature_grant_id: null, created_at: "2026-10-25T00:00:00.000001Z",
    content_definitions: { ...definition(13, "trait", "infernal-legacy", transformedTrait.data, transformedTrait.effects), name: "Infernal Legacy" } };
  const spell = (which: "rebuke" | "darkness"): CharacterSpell => {
    const api = which === "rebuke" ? rebuke : darkness, data = transformSpellEntry(api), n = which === "rebuke" ? 20 : 22;
    const source: EarnedRacialSpellSource = { builder_source_pin_id: trait.id, builder_root_ref_id: root.id,
      builder_choice_id: null, spellcasting_ability: "charisma", builder_earned_racial_spell: which === "rebuke"
        ? { contract_version: 1, grant_key: "infernal-legacy:3:hellish-rebuke", character_level: 3, spell_level: 1, cast_level: 2 }
        : { contract_version: 1, grant_key: "infernal-legacy:5:darkness", character_level: 5, spell_level: 2, cast_level: 2 } };
    return { id: racialId(n), character_id: character.id, content_id: racialId(n + 1), content_version: 1, name: api.name,
      class_slug: "race:tiefling", source: "racial_trait", spell_grant_id: null, custom_data: source,
      is_known: true, is_prepared: true, always_prepared: true, in_spellbook: false, created_at: "2026-10-25T01:00:00.000000Z",
      content_definitions: { ...definition(n + 1, "spell", api.index, data.data, data.effects), name: api.name,
        version_created_at: "2026-10-25T00:00:00.000001Z" } };
  };
  const spells = [spell("rebuke"), spell("darkness")];
  const refs = [...classes, root, trait];
  const input: CastingAbilityInput = { character, contentSnapshotsComplete: true, contentRefs: refs, spells,
    abilities: ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"].map(slug => ({ slug })),
    abilityScores: { strength: 10, dexterity: 10, constitution: 12, intelligence: 16, wisdom: 10, charisma: 10 }, proficiencyBonus: level >= 5 ? 3 : 2 };
  const lore = { ...root, id: racialId(30), content_id: racialId(31), content_version: 1,
    context: { source: "subclass", class: "bard" }, choice_source: `builder:subclass:${racialId(3)}`,
    content_definitions: definition(31, "subclass", "lore", subclassDataSchema.parse({ parent_class: "bard", levels: [{ level: 3, features: [] }] })) };
  return { character, root, trait, classes, refs, spells, input, lore };
}
