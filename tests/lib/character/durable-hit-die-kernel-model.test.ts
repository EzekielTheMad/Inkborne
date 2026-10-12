import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { hitDieDependencyFingerprint, canonicalHitDieIntent, planDurableHitDie } from "@/lib/character/durable-hit-die";
import type { HitDieSnapshot } from "@/lib/character/durable-hit-die-schema";
import { simulateHitDieCommit, readModelHitDieReceipt, nativeInstantMicros, projectNativeInstant, supportedExpiryDeadline, type HitDieModelStore, type HitDieModelInput } from "@/lib/character/durable-hit-die-kernel-model";
import { interpretHitDieResponse, acceptedRollTotalSchema } from "@/lib/character/durable-hit-die-receipt";

const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;
const instant = "2026-10-12T01:00:00.000Z";
const native = "2026-10-12T01:00:00.000999Z";
function fixture(): HitDieSnapshot {
  return { contract_version: 1, character: { id: id(1), owner_id: id(2), system_id: id(3), campaign_id: null, archived: false,
    revision: "9007199254740993", level: 1, base_stats: { strength: 10, dexterity: 10, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10 }, choices: { classes: [{ slug: "fighter", level: 1 }], hp_rolls: {} },
    state: { current_hp: 0, hit_dice_spent: { fighter: 0, custom_pool: 2 }, death_saves: { successes: 1, failures: 2 }, quick_notes: "retain" } },
    system: { id: id(3), slug: "dnd-5e-2014", expression_context: {}, schema_definition: {
      ability_scores: ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"].map(slug => ({ slug, name: slug, abbr: slug.slice(0, 3) })), proficiency_levels: [{ slug: "none", name: "None", multiplier: 0 }], derived_stats: [], skills: [], resources: [], currencies: [],
      content_types: [{ slug: "class", name: "Class" }], creation_steps: [{ step: 1, type: "class", label: "Class" }], sheet_sections: [{ slug: "stats", label: "Stats" }] } }, campaign: null,
    pins: [{ id: id(4), character_id: id(1), content_id: id(5), content_version: 1, context: {}, choice_source: null, feature_grant_id: null,
      resolved: { id: id(5), version: 1, system_id: id(3), content_type: "class", slug: "fighter", name: "Fighter",
        data: { hit_die: 10, spellcasting: null, multiclass: { prerequisites: [], proficiencies_gained: [] }, saving_throws: [], starting_proficiencies: [],
          levels: Array.from({ length: 20 }, (_, i) => ({ level: i + 1, features: [], spellcasting: null })), source_refs: [] },
        effects: [], source: "srd", scope: "platform", owner_id: null } }], inventory: [], feature_grants: [], spell_grants: [], spells: [], access_rows: [] };
}
function prepared(snapshot = fixture(), operation = id(6), face = 3) {
  const request = { contract_version: 1 as const, character_id: snapshot.character.id, operation_id: operation, command: "spend_hit_die" as const,
    class_slug: "fighter", expected_revision: snapshot.character.revision, dependency_fingerprint: hitDieDependencyFingerprint(snapshot) };
  const candidate = planDurableHitDie(snapshot, request, { enabled: true, evaluationInstant: instant, acceptanceInstant: instant, acceptedDieFace: face });
  return { actorId: id(2), request, snapshot, candidate, canonicalIntent: canonicalHitDieIntent(request), nativeEvaluatedAt: native, nativeAcceptedAt: native, linkedRollId: id(9) };
}
function store(snapshot = fixture()): HitDieModelStore { return { snapshot, gate: true, receipts: [], rolls: [] }; }
function commit(current = store(), input: HitDieModelInput = prepared(current.snapshot)) { return simulateHitDieCommit(current, input, { fixtureReaderEnabled: true }); }
function expiry(value: string) {
  return { id: id(20), name: "Boon", slug: "boon", source: "custom", content_id: null, effects: [], duration: { type: "hours", value: 1 },
    concentration: false, applied_at: instant, expires_at: value };
}

describe("offline hit-die kernel model, not database atomicity", () => {
  it("defaults to unavailable reader and refuses a disabled gate", () => {
    const s = store();
    expect(simulateHitDieCommit(s, prepared()).response).toEqual({ status: "unavailable" });
    expect(commit({ ...s, gate: false }).response).toEqual({ status: "disabled" });
    expect(s.receipts).toHaveLength(0);
  });
  it("denies missing/foreign actors before receipt disclosure", () => {
    const accepted = commit();
    expect(commit(accepted.store, { ...prepared(), actorId: id(99) }).response).toEqual({ status: "inaccessible" });
    expect(readModelHitDieReceipt(accepted.store, null, prepared().request, prepared().canonicalIntent)).toEqual({ status: "inaccessible" });
  });
  it("atomically models one receipt, spent die, reset and linked stored roll", () => {
    const original = store(); const before = JSON.stringify(original); const result = commit(original);
    expect(result.response.status).toBe("committed");
    expect(result.store.snapshot.character).toMatchObject({ revision: "9007199254740994", state: { current_hp: 5, hit_dice_spent: { fighter: 1, custom_pool: 2 }, quick_notes: "retain", death_saves: { successes: 0, failures: 0 } } });
    expect(result.store.receipts).toHaveLength(1); expect(result.store.rolls).toHaveLength(1);
    expect(result.store.rolls[0].roll.total).toBe(5); expect(JSON.stringify(original)).toBe(before);
  });
  it("replays before gate, expiry, archive, pins and candidate availability checks", () => {
    const original = prepared(); const accepted = commit(); const changed = structuredClone(accepted.store);
    changed.gate = false; changed.snapshot.character.archived = true; changed.snapshot.pins = [];
    const replay = commit(changed, { ...original, candidate: null, snapshot: null, nativeAcceptedAt: "invalid" });
    expect(replay.response.status).toBe("replayed"); expect(replay.store).toBe(changed);
    if (replay.response.status === "replayed") expect(replay.response.receipt.roll.total).toBe(5);
  });
  it("conflicts on operation reuse with changed class or revision", () => {
    const accepted = commit(); const input = prepared(); input.request.class_slug = "wizard"; input.canonicalIntent = canonicalHitDieIntent(input.request);
    expect(commit(accepted.store, input).response).toEqual({ status: "operation_conflict" });
  });
  it("models different IDs at one revision and two valid sequential operations", () => {
    const first = commit(); const old = prepared(); old.request.operation_id = id(7);
    expect(commit(first.store, old).response).toEqual({ status: "revision_conflict" });
    const advanced = structuredClone(first.store); advanced.snapshot.character.level = 2; advanced.snapshot.character.choices.classes[0].level = 2;
    advanced.snapshot.character.revision = "9007199254740995";
    const second = commit(advanced, { ...prepared(advanced.snapshot, id(7)), linkedRollId: id(10) });
    expect(second.response.status).toBe("committed"); expect(second.store.receipts).toHaveLength(2);
  });
  it("refuses ABA revision and changed complete dependencies without a state mutation", () => {
    const s = store(); const input = prepared(); s.snapshot.character.revision = "9007199254740995";
    expect(commit(s, input).response.status).toBe("revision_conflict");
    s.snapshot.character.revision = input.request.expected_revision; s.snapshot.access_rows = [{ changed: true }];
    expect(commit(s, input).response.status).toBe("revision_conflict");
  });
  it("refuses maximum revision before writes", () => {
    const s = store(); s.snapshot.character.revision = "9223372036854775807";
    expect(commit(s).response.status).toBe("invalid"); expect(s.receipts).toEqual([]);
  });
  it.each(["receipt", "state", "roll"] as const)("injected %s fault publishes no model transition", faultAfter => {
    const s = store(); const before = JSON.stringify(s);
    expect(() => simulateHitDieCommit(s, prepared(), { fixtureReaderEnabled: true, faultAfter })).toThrow("Injected model fault");
    expect(JSON.stringify(s)).toBe(before);
  });
  it("returned receipts are copies, and absent/denied/malformed reads remain unresolved", () => {
    const result = commit(); const input = prepared(); const read = readModelHitDieReceipt(result.store, id(2), input.request, input.canonicalIntent);
    if (read.status !== "replayed") throw new Error("Expected receipt");
    read.receipt.roll.total = 99; expect(result.store.receipts[0].roll.total).toBe(5);
    for (const response of [{ status: "absent" }, { status: "inaccessible" }, {}, null, { status: "committed" }]) expect(interpretHitDieResponse(response, "lookup", input.request)).toBe("unresolved");
    expect(interpretHitDieResponse({ status: "disabled" }, "commit", input.request)).toBe("rejected");
  });
  it("accepts only a response correlated to the retained operation and canonical request", () => {
    const input = prepared(); const accepted = commit();
    expect(interpretHitDieResponse(accepted.response, "commit", input.request)).toBe("accepted");
    const otherOperation = commit(store(), prepared(fixture(), id(7)));
    expect(interpretHitDieResponse(otherOperation.response, "commit", input.request)).toBe("unresolved");
    const advanced = fixture(); advanced.character.revision = "9007199254740995";
    const otherIntent = commit(store(advanced), prepared(advanced));
    expect(interpretHitDieResponse(otherIntent.response, "commit", input.request)).toBe("unresolved");
    const otherCharacter = fixture(); otherCharacter.character.id = id(30); otherCharacter.pins[0].character_id = id(30);
    const wrongCharacter = commit(store(otherCharacter), prepared(otherCharacter));
    expect(interpretHitDieResponse(wrongCharacter.response, "commit", input.request)).toBe("unresolved");
    expect(interpretHitDieResponse(accepted.response, "commit", { ...input.request, actor_id: id(2) })).toBe("unresolved");
  });
  it("lookup accepts correlated replay, never a committed status", () => {
    const input = prepared(); const accepted = commit();
    expect(interpretHitDieResponse(accepted.response, "lookup", input.request)).toBe("unresolved");
    const replay = readModelHitDieReceipt(accepted.store, id(2), input.request, input.canonicalIntent);
    expect(interpretHitDieResponse(replay, "lookup", input.request)).toBe("accepted");
    const transferred = structuredClone(accepted.store); transferred.snapshot.character.owner_id = id(99);
    const newOwnerReplay = readModelHitDieReceipt(transferred, id(99), input.request, input.canonicalIntent);
    expect(interpretHitDieResponse(newOwnerReplay, "lookup", input.request)).toBe("accepted");
  });
  it.each([-2147483648, 2147483647])("INT4 boundary %s is supported", total => expect(acceptedRollTotalSchema.safeParse(total).success).toBe(true));
  it.each([-2147483649, 2147483648, 1.5, Infinity])("INT4 unsupported %s is refused", total => expect(acceptedRollTotalSchema.safeParse(total).success).toBe(false));
  it("rejects a forged out-of-range candidate before writes", () => {
    const s = store(); const input = prepared(); if (input.candidate.status !== "planned") throw new Error("Expected candidate");
    input.candidate.roll.total = 2147483648; expect(commit(s, input).response.status).toBe("invalid"); expect(s.rolls).toEqual([]);
  });
  it("preserves zero/negative healing and caps healing at max HP", () => {
    const negative = fixture(); negative.character.base_stats.constitution = 2;
    expect(commit(store(negative), prepared(negative, id(6), 1)).store.snapshot.character.state).toMatchObject({ current_hp: 0, death_saves: { successes: 1, failures: 2 }, hit_dice_spent: { fighter: 1 } });
    const cap = fixture(); cap.character.state.current_hp = 11;
    expect(commit(store(cap), prepared(cap, id(6), 10)).store.snapshot.character.state.current_hp).toBe(12);
  });
});

describe("explicit microsecond parsing and conservative millisecond expiry", () => {
  it("keeps native fractions, floors evaluation and supports negative epoch/day rollover", () => {
    expect(projectNativeInstant(native)).toBe(instant);
    expect(nativeInstantMicros("1969-12-31T23:59:59.999999Z")).toBe(BigInt(-1));
    expect(projectNativeInstant("1969-12-31T23:59:59.999999Z")).toBe("1969-12-31T23:59:59.999Z");
    expect(projectNativeInstant("2026-10-12T23:59:59.999999Z")).toBe("2026-10-12T23:59:59.999Z");
  });
  it.each(["2026-10-12T01:00:00.001001Z", "2026-10-12T01:00:00.001000Z", "2026-10-12T01:00:00.001+00:00", "0000-01-01T00:00:00.000Z", "2026-02-30T00:00:00.000Z", "infinity"])("rejects unsupported expiry %s without rewriting", value => {
    const s = fixture(); s.character.state.active_effects = [expiry(value)]; const before = JSON.stringify(s);
    expect(() => supportedExpiryDeadline(s, instant)).toThrow(); expect(JSON.stringify(s)).toBe(before);
  });
  it.each([["000999", "committed"], ["001000", "expired"], ["001001", "expired"]])("native acceptance .%s produces %s", (fraction, status) => {
    const s = fixture(); s.character.state.active_effects = [expiry("2026-10-12T01:00:00.001Z")];
    const result = commit(store(s), { ...prepared(s), nativeAcceptedAt: `2026-10-12T01:00:00.${fraction}Z` });
    expect(result.response.status).toBe(status);
  });
  it.each([["000999", "invalid"], ["001000", "committed"], ["001001", "committed"]])("candidate check .001 versus native .%s produces %s", (fraction, status) => {
    const s = store(); const before = JSON.stringify(s); const input = prepared();
    if (input.candidate.status !== "planned") throw new Error("Expected candidate");
    input.candidate.acceptance_checked_at = "2026-10-12T01:00:00.001Z";
    input.nativeAcceptedAt = `2026-10-12T01:00:00.${fraction}Z`;
    const result = commit(s, input); expect(result.response.status).toBe(status); expect(JSON.stringify(s)).toBe(before);
    if (status === "invalid") { expect(result.store.receipts).toEqual([]); expect(result.store.rolls).toEqual([]); }
  });
  it("treats equality at evaluation as expired, null deadline as absent and future evaluation invalid", () => {
    const s = fixture(); s.character.state.active_effects = [expiry(instant)]; expect(supportedExpiryDeadline(s, instant)).toBe(null);
    expect(supportedExpiryDeadline(fixture(), instant)).toBe(null);
    expect(commit(store(), { ...prepared(), nativeEvaluatedAt: "2026-10-12T01:00:00.001000Z" }).response.status).toBe("invalid");
  });
});
