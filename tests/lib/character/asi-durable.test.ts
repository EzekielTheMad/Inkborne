import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { originalAsiFixture, asiSchema, asiId, asiInstant } from "../../fixtures/r06-asi";
import { hitDieSnapshotSchema } from "@/lib/character/durable-hit-die-schema";
import { hitDieDependencyFingerprint, planDurableHitDie } from "@/lib/character/durable-hit-die";
function captured() {
  const f = originalAsiFixture({ mode: "asi", allocations: [{ ability: "constitution", amount: 2 }] });
  return { contract_version: 1, character: { id: f.character.id, owner_id: f.character.user_id, system_id: f.character.system_id, campaign_id: null,
    archived: false, revision: "3", level: 4, base_stats: f.character.base_stats, choices: f.character.choices, state: f.character.state },
    system: { id: f.character.system_id, slug: "dnd-5e-2014", schema_definition: { ...asiSchema }, expression_context: {} }, campaign: null,
    pins: f.refs.map(ref => ({ id: ref.id, character_id: ref.character_id, content_id: ref.content_id, content_version: ref.content_version,
      feature_grant_id: ref.feature_grant_id, context: ref.context, choice_source: ref.choice_source,
      resolved: { id: ref.content_definitions.id, version: ref.content_definitions.version, system_id: f.character.system_id, content_type: ref.content_definitions.content_type,
        slug: ref.content_definitions.slug, name: ref.content_definitions.name, data: ref.content_definitions.data, effects: ref.content_definitions.effects,
        source: ref.content_definitions.source, scope: ref.content_definitions.scope, owner_id: ref.content_definitions.owner_id } })),
    inventory: [], feature_grants: f.evidence.grants.map(grant => ({ ...grant, original_extension: { nested: [1, 2, 3] } })), spell_grants: [], spells: [], access_rows: [] };
}
describe("actual captured durable ASI input and raw-preserving fingerprint", () => {
  it("retains nullable provenance/raw grant metadata; a changed grant id cannot disappear through parsing", () => {
    const raw = captured(), snapshot = hitDieSnapshotSchema.parse(raw), before = JSON.stringify(raw);
    expect(snapshot.pins[1].feature_grant_id).toBe(raw.pins[1].feature_grant_id);
    expect(snapshot.feature_grants[0].original_extension).toEqual({ nested: [1, 2, 3] });
    const first = hitDieDependencyFingerprint(raw);
    raw.pins[1].feature_grant_id = asiId(99);
    expect(hitDieDependencyFingerprint(raw)).not.toBe(first);
    const incomplete = captured(); delete (incomplete.pins[0] as Partial<typeof incomplete.pins[number]>).feature_grant_id;
    expect(() => hitDieSnapshotSchema.parse(incomplete)).toThrow();
    expect(JSON.stringify(snapshot)).toContain('"original_extension"'); expect(before).toContain('"feature_grant_id"');
  });
  it("actual durable plan includes permanent CON16/maxHP35 and preserves accepted-face/raw-roll inputs", () => {
    const raw = captured(), before = JSON.stringify(raw), classSlug = raw.character.choices.classes![0].slug;
    const result = planDurableHitDie(raw, { contract_version: 1, character_id: raw.character.id, operation_id: asiId(90), command: "spend_hit_die", class_slug: classSlug,
      expected_revision: "3", dependency_fingerprint: hitDieDependencyFingerprint(raw) }, { enabled: true, evaluationInstant: asiInstant, acceptanceInstant: asiInstant, acceptedDieFace: 3 });
    expect(result).toMatchObject({ status: "planned", baseline_constitution: 16, live_constitution: 16, max_hp: 35 });
    expect(JSON.stringify(raw)).toBe(before);
  });
});
