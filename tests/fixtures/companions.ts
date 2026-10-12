import type { CompanionData } from "@/lib/schemas/content-types/companion";
import { cinderlitKite, monsterWithBytes } from "./monsters";

export const companionId = (n: number) => `c1811111-1111-4111-8111-${String(n).padStart(12, "0")}`;
export const companionSystemId = companionId(2), companionOwnerId = companionId(3);
/** Original declared templates, no creature/rule/permission/persistence claim. */
export function originalCompanion(role: CompanionData["role"] = "mount"): CompanionData {
  return { schema_version: 1, role, stat_block: { ...structuredClone(cinderlitKite),
    description: "Original workshop creature declared for a companion template.",
    ability_scores: { ...cinderlitKite.ability_scores, strength: 30 },
    skills: [{ name: "Athletics", bonus: 20 }],
  } };
}
export function companionEnvelope(data: CompanionData = originalCompanion()) {
  return { id: companionId(1), system_id: companionSystemId, content_type: "companion", slug: "original-workshop-companion", name: "Original Workshop Companion",
    version: 1, source: "homebrew" as const, scope: "personal" as const, owner_id: companionOwnerId, effects: [], data: structuredClone(data) };
}
export function companionSnapshot(row = companionEnvelope()) {
  return { content_id: row.id, version: row.version, system_id_snapshot: row.system_id, content_type_snapshot: row.content_type,
    slug_snapshot: row.slug, name_snapshot: row.name, data_snapshot: structuredClone(row.data), effects_snapshot: structuredClone(row.effects),
    source_snapshot: row.source, scope_snapshot: row.scope, owner_id_snapshot: row.owner_id, created_at: "2026-10-12T12:00:00.000Z" };
}
export function companionWithBytes(bytes: number): CompanionData {
  const wrapperBytes = new TextEncoder().encode(JSON.stringify({ schema_version: 1, role: "mount", stat_block: {} })).byteLength - 2;
  return { schema_version: 1, role: "mount", stat_block: monsterWithBytes(bytes - wrapperBytes) };
}
export const companionRejectedEffects = [
  { type: "mechanical", stat: "strength", op: "add", value: 2 },
  { type: "grant", stat: "athletics", value: "proficient" },
  { type: "choice", choose: 1, from: ["athletics", "acrobatics"], grant_type: "proficiency", choice_id: "companion-skill" },
  { type: "narrative", text: "Original descriptive effect is not an accepted companion envelope effect." },
] as const;
