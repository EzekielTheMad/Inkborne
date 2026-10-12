import type { MonsterData } from "@/lib/schemas/content-types/monster";

// Original synthetic creatures, never imported, seeded or written to a database.
export const cinderlitKite: MonsterData = {
  schema_version: 1, size: "Small", creature_type: "construct",
  description: "A woven lantern creature that guards discarded workshop keys.",
  armor_class: { value: 12, notes: "woven shell" }, hit_points: { average: 18, dice_text: "3d6 + 8" },
  speed: { walk: 0, fly: 30, hover: true },
  ability_scores: { strength: 8, dexterity: 12, constitution: 10, intelligence: 6, wisdom: 10, charisma: 9 },
  saving_throws: { strength: -1, wisdom: 0 },
  actions: [{ name: "Key flick", description: "It flicks a dull brass key toward a nearby target.",
    attack: { kind: "ranged", attack_type: "weapon", bonus: 0, range: { normal: 20, long: 40 }, target: "one target" },
    damage: [{ type: "bludgeoning", average: 2, roll_text: "1d4" }],
  }],
};

export const glassrootSentinel: MonsterData = {
  schema_version: 1, size: "Large", creature_type: "plant", alignment: "patient and territorial",
  description: "Transparent roots bend toward familiar footsteps and away from a ringing bell.",
  armor_class: { value: 16 }, hit_points: { average: 86, dice_text: "12d10 + 20" },
  speed: { walk: 20, climb: 10, notes: "Root paths must remain connected." },
  ability_scores: { strength: 20, dexterity: 8, constitution: 16, intelligence: 7, wisdom: 14, charisma: 10 },
  skills: [{ name: "Perception", bonus: 0 }, { name: "Glasswork", bonus: -2 }],
  damage_vulnerabilities: ["thunder"], damage_resistances: ["piercing"], damage_immunities: ["poison"],
  damage_notes: "The declared piercing resistance applies while rooted.", condition_immunities: ["frightened"],
  senses: [{ type: "tremorsense", range: 30 }], passive_perception: 10,
  languages_notes: "It understands workshop signals but does not speak.",
  traits: [{ name: "Bell memory", description: "A remembered bell causes the roots to turn toward its sound." }],
  actions: [
    { name: "Root tap", description: "One root taps a nearby creature.",
      attack: { kind: "melee", attack_type: "weapon", bonus: 5, reach: 10 },
      damage: [{ type: "bludgeoning", average: 9, roll_text: "2d6 + 2" }, { type: "cold", average: 0 }],
    },
    { name: "Chime", description: "A low chime invites a nearby creature to pause.",
      saving_throw: { ability: "wisdom", dc: 12, on_success: "The creature keeps moving." } },
  ],
};

export const lanternReefRegent: MonsterData = {
  schema_version: 1, size: "Huge", creature_type: "aberration", alignment: "unpredictably curious",
  description: "Its pale lanterns map the paths of passing boats. Each light stores a different remembered conversation. ".repeat(55),
  armor_class: { value: 18, notes: "layered lantern glass" }, hit_points: { average: 180, dice_text: "20d12 + 50" },
  speed: { walk: 10, fly: 0, hover: false, swim: 40, climb: 0, burrow: 0, encumbered: 0, notes: "Its fins fold above water." },
  ability_scores: { strength: 22, dexterity: 12, constitution: 18, intelligence: 14, wisdom: 16, charisma: 8 },
  saving_throws: { strength: 8, dexterity: 0, constitution: 7, intelligence: -1, wisdom: 6, charisma: -2 },
  skills: [{ name: "Perception", bonus: 6 }],
  senses: [{ type: "darkvision", range: 60, notes: "Lanterns may be closed." }], senses_notes: "Light patterns carry distant echoes.",
  passive_perception: 0, languages: ["Tide signs"], languages_notes: "It replies with patterned light.",
  challenge: { rating: "9", experience_points: 0 },
  damage_vulnerabilities: ["thunder"], damage_resistances: ["cold"], damage_immunities: ["poison"],
  damage_notes: "The glass dims while resistance applies.", condition_immunities: ["charmed"],
  traits: [{ name: "Echo ledger", description: "Each light repeats one remembered phrase when disturbed." }],
  actions: [
    { name: "Lantern pulse", description: "A close light releases a soft pulse.",
      attack: { kind: "melee_or_ranged", attack_type: "spell", bonus: -1, reach: 5, range: { normal: 60, long: 120 }, target: "one target" },
      saving_throw: { ability: "constitution", dc: 0, on_success: "The glass stays clear." },
      damage: [{ type: "radiant", average: 0, roll_text: "1d6", notes: "A dim pulse." }],
    },
    { name: "Lantern pulse", description: "A distant light replies with a different pulse." },
  ],
  bonus_actions: [{ name: "Fold fins", description: "The regent turns its folded fins toward the current." }],
  reactions: [{ name: "Recall", description: "A lantern repeats the last heard word." }],
  legendary_actions: { description: "Its oldest lights answer between conversations.", actions_per_round: 3,
    entries: [{ name: "Old light", description: "One old lantern opens.", cost: 2 }] },
  lair_actions: { description: "Within its reef, the lights align with drifting sand.", initiative_count: 0,
    entries: [{ name: "Sand map", description: "Lines of sand mark the safe channels." }] },
};

export const monsterNames = ["Cinderlit Kite", "Glassroot Sentinel", "Lantern Reef Regent"] as const;
export const monsterFixtures = [cinderlitKite, glassrootSentinel, lanternReefRegent] as const;
export const monsterSystemId = "22222222-2222-4222-8222-222222222222";
export const monsterOwnerId = "33333333-3333-4333-8333-333333333333";

export function monsterEnvelope(data: MonsterData = cinderlitKite) {
  return {
    id: "11111111-1111-4111-8111-111111111111", system_id: monsterSystemId,
    content_type: "monster", name: "Cinderlit Kite", slug: "cinderlit-kite", version: 1,
    source: "homebrew" as const, scope: "personal" as const, owner_id: monsterOwnerId,
    data: structuredClone(data), effects: [],
  };
}

/** All individual fields remain valid; creates exact aggregate byte-boundary variants. */
export function monsterWithBytes(bytes: number): MonsterData {
  const data: MonsterData = {
    ...structuredClone(cinderlitKite), description: "Original long content.",
    traits: Array.from({ length: 20 }, (_, index) => ({ name: `Lantern memory ${index}`, description: "x" })),
  };
  let remaining = bytes - new TextEncoder().encode(JSON.stringify(data)).byteLength;
  for (const entry of data.traits!) {
    const extra = Math.min(Math.max(remaining, 0), 3_999);
    entry.description += "x".repeat(extra);
    remaining -= extra;
  }
  if (remaining !== 0) throw new Error("Requested boundary is outside this fixture's bounded capacity");
  return data;
}
