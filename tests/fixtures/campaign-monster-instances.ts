import type { InstanceDetail, InstanceReceipt, InstanceRequest, SourcePreview } from "@/lib/campaigns/monster-instance-schema";
import { monsterDataSchema } from "@/lib/schemas/content-types/monster";
export const MC = { campaign: "10000000-0000-4000-8000-000000000001", owner: "10000000-0000-4000-8000-000000000002",
  system: "10000000-0000-4000-8000-000000000003", source: "10000000-0000-4000-8000-000000000004",
  instance: "10000000-0000-4000-8000-000000000005", operation: "10000000-0000-4000-8000-000000000006",
  foreign: "10000000-0000-4000-8000-000000000007", digest: "a".repeat(64) };
// Original synthetic narrative and declared values; no copied book text or rolled defaults.
export const mossglassSentinel = monsterDataSchema.parse({ schema_version: 1, size: "Medium", creature_type: "moss construct",
  armor_class: { value: 14, notes: "Declared bark shell" }, hit_points: { average: 17, dice_text: "Declared seventeen" }, speed: { walk: 20 },
  ability_scores: { strength: 12, dexterity: 8, constitution: 15, intelligence: 4, wisdom: 11, charisma: 6 },
  saving_throws: { wisdom: 0, charisma: -2 }, traits: [{ name: "Still lamp", description: "An original lamp watches a mossy bridge. <script>literal only</script>" }], actions: [] });
export function monsterSnapshot() {
  return { content_id: MC.source, version: 1, system_id_snapshot: MC.system, content_type_snapshot: "monster", slug_snapshot: "mossglass-sentinel",
    name_snapshot: "Mossglass Sentinel", data_snapshot: structuredClone(mossglassSentinel), effects_snapshot: [], source_snapshot: "homebrew",
    scope_snapshot: "personal", owner_id_snapshot: MC.owner, created_at: "2026-10-13T12:00:00Z" };
}
export function monsterPreview(): SourcePreview { return { source_id: MC.source, source_version: 1, system_id: MC.system, source_digest: MC.digest, declared_max_hp: 17, snapshot: monsterSnapshot() }; }
export function monsterCreate(): Extract<InstanceRequest, { command: "create" }> { return { command_version: 1, operation_id: MC.operation, command: "create", source_id: MC.source,
  source_version: 1, source_digest: MC.digest, name: "Bridge sentinel", current_hp: 0, notes: "Original private note." }; }
export function monsterDetail(revision = "0"): InstanceDetail { return { id: MC.instance, campaign_id: MC.campaign, system_id: MC.system, name: "Bridge sentinel",
  current_hp: 0, declared_max_hp: 17, notes: "Original private note.", archived: false, revision, source_content_id: MC.source,
  source_version: 1, source_digest: MC.digest, source_snapshot: monsterSnapshot() }; }
export function monsterReceipt(request: InstanceRequest = monsterCreate()): InstanceReceipt {
  const item = monsterDetail();
  const readback = { id: item.id, campaign_id: item.campaign_id, name: item.name, current_hp: item.current_hp, declared_max_hp: item.declared_max_hp,
    notes: item.notes, archived: item.archived, revision: item.revision };
  if (request.command === "create") Object.assign(readback, { name: request.name, current_hp: request.current_hp, notes: request.notes });
  else Object.assign(readback, request.patch, { revision: (BigInt(request.expected_revision) + BigInt(1)).toString() });
  return { command_version: 1, campaign_id: MC.campaign, operation_id: request.operation_id, canonical_intent: request, instance_id: MC.instance,
    original_actor_id: MC.owner, accepted_at: "2026-10-13T12:10:00Z", outcome: request.command === "create" ? "created" : "updated", readback };
}
