import type { Effect } from "@/lib/types/effects";
import type { SubclassHitPointRef } from "@/lib/character/subclass-hit-points";

export const hpId = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
// Source excerpt: cached genuine /api/2014/features/draconic-resilience.
export const draconicResilienceSource = {
  index: "draconic-resilience", name: "Draconic Resilience", class: { index: "sorcerer", name: "Sorcerer" },
  subclass: { index: "draconic", name: "Draconic" }, level: 1, desc: [
    "As magic flows through your body, it causes physical traits of your dragon ancestors to emerge. At 1st level, your hit point maximum increases by 1 and increases by 1 again whenever you gain a level in this class.",
    "Additionally, parts of your skin are covered by a thin sheen of dragon-like scales. When you aren't wearing armor, your AC equals 13 + your Dexterity modifier.",
  ],
};
export const draconicRoot = { index: "draconic", class: { index: "sorcerer" } };
export const draconicLevels = [{ level: 1, features: ["dragon-ancestor", "draconic-resilience"] }];
export function subclassHpFixture() {
  const character = { id: hpId(1), system_id: hpId(2), level: 3, action_revision: "7", choices: {
    classes: [{ slug: "sorcerer", subclass: "draconic", level: 3, occurrence_id: hpId(3) }], hp_rolls: {},
  } };
  const definition = (n: number, type: string, slug: string, data: Record<string, unknown>) => ({
    id: hpId(n), version: 2, system_id: character.system_id, content_type: type, slug,
    source: "srd", scope: "platform", owner_id: null, data,
  });
  const classRef: SubclassHitPointRef & { content_definitions: { effects: Effect[] } } = {
    id: hpId(4), character_id: character.id, content_id: hpId(5), content_version: 2,
    context: { source: "class", level: 1 }, choice_source: null, feature_grant_id: null,
    content_definitions: { ...definition(5, "class", "sorcerer", { hit_die: 6 }), effects: [] },
  };
  const subclassRef: SubclassHitPointRef = {
    id: hpId(6), character_id: character.id, content_id: hpId(7), content_version: 2,
    context: { source: "subclass", class: "sorcerer" }, choice_source: `builder:subclass:${hpId(3)}`, feature_grant_id: null,
    content_definitions: definition(7, "subclass", "draconic", { parent_class: "sorcerer",
      levels: draconicLevels, hit_points_bonus_per_class_level: 1 }),
  };
  classRef.class_role = { occurrence_id: hpId(3), controller_ref_id: classRef.id, content_id: classRef.content_id,
    content_version: classRef.content_version!, action_revision: character.action_revision, role: "original",
    raw_data: structuredClone(classRef.content_definitions.data), evaluation_data: structuredClone(classRef.content_definitions.data),
    raw_effects: [], evaluation_effects: [] };
  return { character, classRef, subclassRef, refs: [classRef, subclassRef] };
}
