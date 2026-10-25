import type { Effect } from "@/lib/types/effects";
import type { CharacterChoices } from "@/lib/types/character";
import type { AncestryHitPointRef } from "@/lib/character/ancestry-hit-points";
import { hpId } from "./subclass-hit-points";

// Exact genuine cached /api/2014/subraces/hill-dwarf and mandatory trait excerpts.
export const dwarvenToughnessSource = { index: "dwarven-toughness", name: "Dwarven Toughness", races: [],
  subraces: [{ index: "hill-dwarf", name: "Hill Dwarf" }],
  desc: ["Your hit point maximum increases by 1, and it increases by 1 every time you gain a level."], proficiencies: [],
};
export const hillDwarfSource = { index: "hill-dwarf", name: "Hill Dwarf", race: { index: "dwarf", name: "Dwarf" },
  desc: "As a hill dwarf, you have keen senses, deep intuition, and remarkable resilience.",
  ability_bonuses: [{ ability_score: { index: "wis", name: "WIS" }, bonus: 1 }],
  racial_traits: [{ index: "dwarven-toughness", name: "Dwarven Toughness" }], starting_proficiencies: [], languages: [],
};

export function ancestryHpFixture() {
  const character = { id: hpId(101), system_id: hpId(102), level: 3, action_revision: "7",
    base_stats: { strength: 15, dexterity: 13, constitution: 14, intelligence: 8, wisdom: 12, charisma: 10 },
    choices: { classes: [{ slug: "barbarian", level: 3, occurrence_id: hpId(103) }], race: "dwarf", subrace: "hill-dwarf",
      hp_rolls: { "barbarian-2": { method: "average", value: 7 }, "barbarian-3": { method: "average", value: 7 } },
    } as CharacterChoices,
  };
  const definition = (n: number, type: string, slug: string, data: Record<string, unknown>, effects: Effect[] = []) => ({
    id: hpId(n), version: 2, system_id: character.system_id, content_type: type, slug, name: slug,
    source: "srd" as const, scope: "platform" as const, owner_id: null, data, effects,
  });
  const classRef: AncestryHitPointRef = { id: hpId(104), character_id: character.id, content_id: hpId(105), content_version: 2,
    context: { source: "class", level: 1 }, choice_source: null, feature_grant_id: null,
    content_definitions: definition(105, "class", "barbarian", { hit_die: 12, spellcasting: null,
      multiclass: { prerequisites: [], proficiencies_gained: [] }, saving_throws: [], starting_proficiencies: [],
      levels: Array.from({ length: 20 }, (_, i) => ({ level: i + 1, features: [], spellcasting: null })), source_refs: [] }),
  };
  classRef.class_role = { occurrence_id: hpId(103), controller_ref_id: classRef.id, content_id: classRef.content_id,
    content_version: 2, action_revision: "7", role: "original", raw_data: structuredClone(classRef.content_definitions.data),
    evaluation_data: structuredClone(classRef.content_definitions.data), raw_effects: [], evaluation_effects: [] };
  const raceRef: AncestryHitPointRef = { id: hpId(106), character_id: character.id, content_id: hpId(107), content_version: 2,
    context: { source: "race" }, choice_source: null, feature_grant_id: null,
    content_definitions: definition(107, "race", "dwarf", { size: "Medium", speed: 25, source_refs: [], traits: [],
      subraces: ["hill-dwarf"], ability_score_representation: { version: 1, mode: "effects" } },
    [{ type: "mechanical", stat: "constitution", op: "add", value: 2 }]),
  };
  const subraceRef: AncestryHitPointRef = { id: hpId(108), character_id: character.id, content_id: hpId(109), content_version: 2,
    context: { source: "subrace" }, choice_source: null, feature_grant_id: null,
    content_definitions: definition(109, "subrace", "hill-dwarf", { parent_race: "dwarf", traits: ["dwarven-toughness"],
      hit_points_bonus_per_character_level: 1 }, [{ type: "mechanical", stat: "wisdom", op: "add", value: 1 }]),
  };
  return { character, classRef, raceRef, subraceRef, refs: [classRef, raceRef, subraceRef] };
}
