import type { NpcData } from "@/lib/schemas/content-types/npc";

/** Original synthetic stories. No book/catalog/database content or live writes. */
export const originalNpc: NpcData = {
  schema_version: 1, description: "A bridge keeper collects the names of forgotten paths.", occupation: "Bridge keeper",
  personality: {
    personality_traits: ["Counts footsteps before answering.", "Keeps a notebook of unfinished journeys."],
    ideals: ["Everyone deserves a way home."], bonds: ["The old bridge is a promise."], flaws: ["Never admits being lost."],
    motivation: "Find the road that disappeared during last winter.", mannerisms: "Taps a wooden compass.", fear: "An unmarked crossing.",
  },
  relationships: [{ name: "The bell maker", relationship: "An old friend with a different map.", description: "Each remembers a different route to the same village." }],
};
export const npcId = (last: number) => `b1711111-1111-4111-8111-${String(last).padStart(12, "0")}`;
export const npcSystemId = npcId(2), npcOwnerId = npcId(3);
export function npcEnvelope(data: NpcData = originalNpc) {
  return { id: npcId(1), system_id: npcSystemId, content_type: "npc", slug: "original-bridge-keeper", name: "Original Bridge Keeper",
    version: 1, source: "homebrew" as const, scope: "personal" as const, owner_id: npcOwnerId, data: structuredClone(data), effects: [] };
}
export function npcSnapshot(row = npcEnvelope()) {
  return { content_id: row.id, version: row.version, system_id_snapshot: row.system_id, content_type_snapshot: row.content_type,
    slug_snapshot: row.slug, name_snapshot: row.name, data_snapshot: row.data, effects_snapshot: row.effects,
    source_snapshot: row.source, scope_snapshot: row.scope, owner_id_snapshot: row.owner_id };
}
export function longNpc(character = "x"): NpcData {
  const line = character.repeat(500);
  return { schema_version: 1, description: character.repeat(8_000), occupation: character.repeat(120),
    personality: { personality_traits: Array.from({ length: 8 }, () => line), ideals: Array.from({ length: 8 }, () => line),
      bonds: Array.from({ length: 8 }, () => line), flaws: Array.from({ length: 8 }, () => line),
      motivation: character.repeat(1_000), mannerisms: character.repeat(1_000), fear: character.repeat(1_000) },
    relationships: Array.from({ length: 20 }, (_, index) => ({ name: `Original hook ${index}`, relationship: character.repeat(120), description: character.repeat(1_000) })) };
}
export const npcRejectedEffects = [
  { type: "mechanical", stat: "strength", op: "add", value: 2 },
  { type: "grant", stat: "athletics", value: "proficient" },
  { type: "choice", choose: 1, from: ["athletics", "acrobatics"], grant_type: "proficiency", choice_id: "npc-skill" },
  { type: "narrative", text: "Original narrative effect is still not an NPC envelope effect." },
] as const;
