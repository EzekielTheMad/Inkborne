// @vitest-environment node
import { isDeepStrictEqual } from "node:util";
import { describe, expect, it, vi } from "vitest";
import { submitConditionalHpProposal, type ConditionalStateRequest, type PersistedState } from "@/docs/architecture/proposals/conditional-hp-client";

// Serialized in-memory contract model; not a PostgreSQL/RLS/HTTP integration test.
function model(initial: PersistedState) {
  let state = structuredClone(initial);
  const transport = vi.fn(async (r: ConditionalStateRequest) => {
    if (!isDeepStrictEqual(r.expected_state, state))
      return [{ status: "conflict", resulting_state: structuredClone(state) }];
    state = { ...state, ...r.state_patch };
    return [{ status: "applied", resulting_state: structuredClone(state) }];
  });
  return { transport, read: () => structuredClone(state) };
}
const request = (expected_state: PersistedState, state_patch: PersistedState): ConditionalStateRequest =>
  ({ character_id: "local-fixture", expected_state, state_patch });

describe("review-only conditional HP contract", () => {
  it.each([[8, 7], [7, 8]])("rejects the second stale damage write in either ordering (%s then %s)", async (first, second) => {
    const initial = { current_hp: 10, temp_hp: 0, quick_notes: "keep" };
    const db = model(initial);
    const results = await Promise.all([
      submitConditionalHpProposal(db.transport, request(initial, { current_hp: first, temp_hp: 0 })),
      submitConditionalHpProposal(db.transport, request(initial, { current_hp: second, temp_hp: 0 })),
    ]);
    expect(results.map(r => r.status)).toEqual(["applied", "conflict"]);
    expect(results[1]).toMatchObject({ reloadRequired: true });
    expect(db.read()).toEqual({ ...initial, current_hp: first });
    expect(db.transport).toHaveBeenCalledTimes(2); // No replay to force serial-intent HP5.
  });
  it("rejects stale healing without undoing a newer independent absolute edit", async () => {
    const initial = { current_hp: 10, temp_hp: 0, quick_notes: "old" };
    const db = model(initial);
    await db.transport(request(initial, { temp_hp: 3, quick_notes: "new" }));
    const outcome = await submitConditionalHpProposal(db.transport, request(initial, { current_hp: 13 }));
    expect(outcome.status).toBe("conflict");
    expect(db.read()).toEqual({ current_hp: 10, temp_hp: 3, quick_notes: "new" });
    expect(db.transport).toHaveBeenCalledTimes(2);
  });
  it("preserves keys absent from an accepted patch, including linked concentration state", async () => {
    const initial = { current_hp: 4, temp_hp: 0, quick_notes: "keep", concentrating_on: { spell: "s" } };
    const db = model(initial);
    const result = await submitConditionalHpProposal(db.transport, request(initial, { current_hp: 0, concentrating_on: null, active_effects: [] }));
    expect(result).toEqual({ status: "applied", state: { ...initial, current_hp: 0, concentrating_on: null, active_effects: [] } });
  });
  it("never reports an inaccessible or missing row as success", async () => {
    const transport = vi.fn(async () => [{ status: "missing", resulting_state: null }]);
    expect(await submitConditionalHpProposal(transport, request({}, { current_hp: 8 }))).toMatchObject({ status: "missing", reloadRequired: true });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("treats a response lost after a commit as uncertain without replay", async () => {
    const db = model({ current_hp: 10 });
    const transport = vi.fn(async (r: ConditionalStateRequest) => { await db.transport(r); throw new Error("response lost"); });
    const result = await submitConditionalHpProposal(transport, request({ current_hp: 10 }, { current_hp: 8 }));
    expect(result).toMatchObject({ status: "uncertain", reloadRequired: true });
    expect(db.read().current_hp).toBe(8);
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it.each([{ response: [] }, { response: [{ status: "applied", resulting_state: null }] }, { response: [{ status: "success", resulting_state: {} }] }])("fails closed on a malformed result $response", async ({ response }) => {
    const transport = vi.fn(async () => response);
    expect(await submitConditionalHpProposal(transport, request({}, { current_hp: 8 }))).toMatchObject({ status: "uncertain", reloadRequired: true });
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
