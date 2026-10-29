import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveManualCharacterHp, assignNativeCharacterCampaign } from "@/app/(app)/characters/[id]/sheet-actions";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), context: vi.fn(), enabled: vi.fn(), refresh: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), refresh: mocks.refresh }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/auth/character-command-context", () => ({ resolveCharacterCommandContext: mocks.context }));
vi.mock("@/lib/character/creation-ui-server", () => ({ basicSheetCommandsEnabled: mocks.enabled }));
const owner = "11111111-1111-4111-8111-111111111111", id = "22222222-2222-4222-8222-222222222222";
const campaign = "33333333-3333-4333-8333-333333333333";
const parent = { id, user_id: owner, system_id: "44444444-4444-4444-8444-444444444444", campaign_id: null,
  archived: false as const, level: 3, choices: { race: "human" }, state: { current_hp: 24, quick_notes: "keep" },
  base_stats: { constitution: 15 }, action_revision: "9007199254740993" };
const request = () => ({ character_id: id, expected_parent: parent, expected_max_hp: 24, patch: { current_hp: 20 } });
const saved = () => ({ status: "applied", character_id: id, actor_id: owner, revision: "9007199254740994",
  state: { ...parent.state, current_hp: 20 }, campaign_id: null });
beforeEach(() => {
  vi.resetAllMocks(); mocks.enabled.mockReturnValue(true);
  mocks.context.mockResolvedValue({ status: "token_verified", context: { actor_id: owner, context_version: 1 } });
  mocks.rpc.mockResolvedValue({ error: null, data: saved() });
});
describe("finite basic sheet action acknowledgement (source tests, no native database proof)", () => {
  it("binds verified actor/preimage and preserves bigint revision exactly", async () => {
    expect(await saveManualCharacterHp(owner, request())).toEqual(saved());
    expect(mocks.rpc).toHaveBeenCalledWith("character_manual_hp_command_v1", { p_context: { actor_id: owner, context_version: 1 }, p_request: request() });
    expect(mocks.rpc).toHaveBeenCalledTimes(1); expect(mocks.refresh).toHaveBeenCalledOnce();
  });
  it.each(["death_saves", "concentrating_on", "spell_slots_used", "feature_uses"])("refuses extra %s fields before a write", async key => {
    expect(await saveManualCharacterHp(owner, { ...request(), patch: { current_hp: 20, [key]: {} } })).toEqual({ status: "invalid" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([0, -1, 2.5, Number.NaN])("refuses unsupported current HP %s", async current_hp => {
    expect(await saveManualCharacterHp(owner, { ...request(), patch: { current_hp } })).toEqual({ status: "invalid" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not send another actor's command or enable the path when disabled", async () => {
    expect(await saveManualCharacterHp(campaign, request())).toEqual({ status: "unavailable" });
    mocks.enabled.mockReturnValue(false);
    expect(await saveManualCharacterHp(owner, request())).toEqual({ status: "invalid" }); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("preserves native conflict and never retries a lost response", async () => {
    mocks.rpc.mockResolvedValueOnce({ error: null, data: { status: "conflict" } });
    expect(await saveManualCharacterHp(owner, request())).toEqual({ status: "conflict" });
    mocks.rpc.mockRejectedValueOnce(new Error("lost after commit"));
    expect(await saveManualCharacterHp(owner, request())).toEqual({ status: "unknown" });
    expect(mocks.rpc).toHaveBeenCalledTimes(2); expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it.each([
    { revision: "9007199254740993" }, { actor_id: campaign }, { character_id: campaign },
    { state: { current_hp: 20 } }, { state: { ...parent.state, current_hp: 21 } },
  ])("cannot acknowledge an unrelated/malformed HP postimage %j", async change => {
    mocks.rpc.mockResolvedValue({ error: null, data: { ...saved(), ...change } });
    expect(await saveManualCharacterHp(owner, request())).toEqual({ status: "unknown" }); expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("accepts an unchanged native state only at the exact same revision", async () => {
    mocks.rpc.mockResolvedValue({ error: null, data: { ...saved(), status: "unchanged", revision: parent.action_revision, state: parent.state } });
    expect(await saveManualCharacterHp(owner, { ...request(), patch: { current_hp: 24 } })).toMatchObject({ status: "unchanged" });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("acknowledges only the exact unassigned-to-destination campaign command", async () => {
    const assignment = { character_id: id, campaign_id: campaign, expected_campaign_id: null, expected_revision: parent.action_revision };
    mocks.rpc.mockResolvedValue({ error: null, data: { ...saved(), campaign_id: campaign } });
    expect(await assignNativeCharacterCampaign(owner, assignment)).toMatchObject({ status: "applied", campaign_id: campaign });
    expect(mocks.rpc).toHaveBeenCalledWith("character_campaign_assignment_v1", expect.objectContaining({ p_request: assignment }));
    expect(await assignNativeCharacterCampaign(owner, { ...assignment, expected_campaign_id: campaign })).toEqual({ status: "invalid" });
    mocks.rpc.mockResolvedValue({ error: null, data: saved() });
    expect(await assignNativeCharacterCampaign(owner, assignment)).toEqual({ status: "unknown" });
  });
});
