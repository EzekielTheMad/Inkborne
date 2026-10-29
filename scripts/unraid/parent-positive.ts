import assert from "node:assert/strict";
import fs from "node:fs";
import { z } from "zod";
import { ANCESTRY_FAMILY_CHECKS } from "../ancestry-hp-acceptance";
import { parentNativeSchema, parentDetailSchema, type ParentObservation } from "../parent-admission-acceptance";
import { assertNativeIdentity, nativeJson } from "./native";

// A separate fresh-state observation contract. Historical validators and their
// publication/count prerequisites are unchanged.
export async function observeParent(characterId: string, actorId: string, snapshots: 1535 | 1536 | 1537 = 1535): Promise<ParentObservation> {
  assertNativeIdentity();
  const variables = { character_id: characterId, actor_id: actorId };
  const read = (name: string) => fs.readFileSync(`supabase/verification/${name}.sql`, "utf8");
  const native = parentNativeSchema.parse(await nativeJson(read("builder-parent-admission-readback"), variables));
  const detail = parentDetailSchema.extend({ snapshots: z.object({ count: z.literal(snapshots),
    fingerprint: z.string().regex(/^[a-f0-9]{32}$/) }).strict() }).parse(await nativeJson(read("builder-parent-positive-detail"), variables));
  const family = z.record(z.string(), z.unknown()).parse(await nativeJson(read("builder-class-choices-readback"), variables));
  for (const row of [native, detail]) { assert.equal(row.characterId, characterId); assert.equal(row.actorId, actorId); }
  assert.equal(native.classRoles.character_id, characterId); assert.equal(native.classRoles.action_revision, native.actionRevision);
  assert.equal(native.classRoles.original_occurrence_id, native.originalOccurrenceId); assert.equal(native.firstClassProofs[0].actorId, actorId);
  assert.deepEqual(Object.keys(native.orderBijections).sort(), ["feature_grants", "inventory", "pins", "spell_grants", "spells"]);
  assert(Object.values(native.orderBijections).every(Boolean));
  for (const check of ANCESTRY_FAMILY_CHECKS) assert.equal(family[check], true, check);
  assert.equal(detail.inventoryFromAcceptedAward, true);
  assert.equal(new Set(native.receipts.map(row => row.operationId)).size, native.receipts.length);
  return { native, detail, family };
}

export function retainParentOrigins(before: ParentObservation, after: ParentObservation) {
  for (const key of ["characterId", "actorId", "originalOccurrenceId", "firstClassProofs"] as const) assert.deepEqual(after.native[key], before.native[key], key);
  const sources = (value: ParentObservation) => value.native.classRoles.class_sources.map(({ role, occurrence_id, controller_ref_id, content_id, content_version }) =>
    ({ role, occurrence_id, controller_ref_id, content_id, content_version }));
  assert.deepEqual(sources(after), sources(before));
  for (const key of ["hpDraws", "catalog", "snapshots"] as const) assert.deepEqual(after.detail[key], before.detail[key], key);
  for (const receipt of before.native.receipts) assert.deepEqual(after.native.receipts.find(row => row.operationId === receipt.operationId), receipt);
}

export function requireParentSave(before: ParentObservation, after: ParentObservation, commands: string[]) {
  retainParentOrigins(before, after);
  assert(BigInt(after.native.actionRevision) > BigInt(before.native.actionRevision), "edit performed no physical save");
  const added = after.native.receipts.filter(row => !before.native.receipts.some(old => old.operationId === row.operationId));
  assert.deepEqual(added.map(row => row.command).sort(), [...commands].sort());
  assert.deepEqual(after.native.state, before.native.state);
  assert.deepEqual(after.native.choices.classes, before.native.choices.classes);
  assert.deepEqual(after.detail.inventory, before.detail.inventory);
}

export async function otherParentRows(characterId: string) {
  const tables = ["public.characters", "public.character_content_refs", "public.character_feature_grants", "public.character_spell_grants",
    "public.character_spells", "public.character_inventory", "public.character_starting_grants", "private.character_class_origin_v1",
    "private.character_class_commands_v1", "private.character_builder_receipts_v1", "private.character_projection_order_v1",
    "private.character_builder_hp_draws_v1", "private.character_builder_class_acquisitions_v1", "private.character_class_occurrences_v1",
    "private.character_builder_progression_history_v1"];
  return nativeJson("BEGIN READ ONLY; SELECT jsonb_build_object(" + tables.map(table => `'${table}',(SELECT jsonb_build_object('count',count(*),
    'fingerprint',md5(COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]')::text)) FROM ${table} r
    WHERE ${table === "public.characters" ? "id" : "character_id"}<>:'character_id'::uuid)`).join(",") + "); ROLLBACK;", { character_id: characterId });
}
