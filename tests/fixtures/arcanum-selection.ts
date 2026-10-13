import { arcanumCaptureSchema, arcanumReceiptSchema, type ArcanumRequest } from "@/lib/spells/arcanum-selection-schema";
import { arcanumFixture } from "./arcanum-binding";
import { originalId, subclassCharacterId, subclassOwnerId, subclassSystemId } from "./subclass-casting";

// ORIGINAL synthetic recorded rows. Protected producer/earned origin/roles are
// MODELED ONLY; no v1 function can issue these rows and no native SQL is executed.
export function recordedArcanumFixture(tier: 6 | 7 | 8 | 9 = 6, spent: unknown = 1) {
  const base = arcanumFixture(tier);
  const request: ArcanumRequest = { command_version: 1, command: "first_select", operation_id: originalId(3000 + tier),
    expected_revision: "9007199254740993", earned_occurrence_id: originalId(3100 + tier), feature_grant_id: base.grant.grantId,
    spell_content_id: base.spell.content_id, spell_version: base.spell.version };
  const capture = arcanumCaptureSchema.parse({ schema_version: 1, capture_kind: "first_choice", selection_id: originalId(3200 + tier),
    character_id: subclassCharacterId, system_id: subclassSystemId, earned_occurrence_id: request.earned_occurrence_id, origin_id: originalId(3300 + tier),
    operation_id: request.operation_id, original_actor_id: subclassOwnerId, accepted_at: "2026-10-13T20:00:00.000001Z",
    before_revision: request.expected_revision, after_revision: "9007199254740994", original_feature_grant_id: base.grant.grantId,
    controller_ref_id: base.grant.controllerRefId, controller_content_id: base.parent.content_id, controller_version: base.parent.version,
    derived_feature_ref_id: base.refs[1].refId, feature_content_id: base.feature.content_id, feature_version: base.feature.version,
    feature_slug: base.featureSlug, unlock_level: base.gainLevel, spell_content_id: base.spell.content_id, spell_version: base.spell.version,
    controller_snapshot: base.parent, feature_snapshot: base.feature, spell_snapshot: base.spell,
    captured_grant: { id: base.grant.grantId, character_id: subclassCharacterId, controller_ref_id: base.grant.controllerRefId,
      feature_slug: base.featureSlug, feature_content_id: base.feature.content_id, feature_version: base.feature.version,
      unlock_level: base.gainLevel, original_extension: { ordered: ["prism", "horizon"] } }, canonical_intent: request });
  const receipt = arcanumReceiptSchema.parse({ receipt_version: 1, capture_kind: "first_choice", character_id: capture.character_id,
    operation_id: capture.operation_id, selection_id: capture.selection_id, earned_occurrence_id: capture.earned_occurrence_id,
    origin_id: capture.origin_id, original_actor_id: capture.original_actor_id, accepted_at: capture.accepted_at,
    before_revision: capture.before_revision, after_revision: capture.after_revision, canonical_intent: request, capture: structuredClone(capture) });
  return { base, request, capture, receipt,
    parent: { id: subclassCharacterId, owner_id: subclassOwnerId, system_id: subclassSystemId, revision: "9007199254740995",
      state: { feature_uses: { [base.featureSlug]: spent } } },
    phase: { current_actor_id: subclassOwnerId, before_at: "2026-10-13T20:10:00.000001Z",
      return_at: "2026-10-13T20:10:00.000002Z", expires_at: "2026-10-13T20:11:00.000001Z" } };
}

// Internally coherent foreign-system history: every immutable snapshot and the
// reciprocal original receipt agree. Only the CURRENT parent system differs.
// This is an injected negative, not a producer or canonical system migration.
export function foreignSystemArcanumPair(fixture: ReturnType<typeof recordedArcanumFixture>) {
  const capture = structuredClone(fixture.capture);
  capture.system_id = originalId(9900);
  for (const raw of [capture.controller_snapshot, capture.feature_snapshot, capture.spell_snapshot]) {
    raw.system_id_snapshot = capture.system_id;
  }
  const receipt = { ...structuredClone(fixture.receipt), capture: structuredClone(capture) };
  return { capture, receipt };
}
