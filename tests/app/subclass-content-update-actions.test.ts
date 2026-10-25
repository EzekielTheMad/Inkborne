import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ context: vi.fn(), client: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/character-command-context", () => ({ resolveCharacterCommandContext: mocks.context }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
import { previewSubclassContentUpdate, submitBuilderStep, checkBuilderStep } from "@/app/(app)/characters/[id]/builder/step-actions";
import { parseBuilderStepIntent } from "@/lib/builder/builder-step-command";

const id = (value: number) => `10000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const actor = id(1), target = id(2), ref = id(3), content = id(4), occurrence = id(5), operation = id(6), other = id(7);
const request = { subclass_ref_id: ref, target_content_version: 2 };
const fields = { class_slug: "warlock", occurrence_id: occurrence, subclass_ref_id: ref, content_id: content,
  expected_content_version: 1, target_content_version: 2, expected_action_revision: "4", preview_digest: "a".repeat(64) };
const preview = () => ({ status: "available", preview: { contract_version: 1, character_id: target, actor_id: actor,
  fields, saved_name: "The Fiend", target_name: "The Fiend", retained: [{ kind: "invariant", label: "Class identity and HP" }],
  removed: [{ kind: "spell_grant", label: "Automatic Burning Hands grant" }],
  added: [{ kind: "expanded_spell", label: "Burning Hands as an ordinary candidate" }], automatic_spells_learned: 0 } });
const unavailable = { status: "unavailable", reason: "unavailable" };
const original = () => parseBuilderStepIntent({ contract_version: 1, command: "update_subclass_version",
  operation_id: operation, character_id: target, fields })!;
const rejected = () => ({ status: "rejected", rejection: { actor_id: actor, character_id: target,
  operation_id: operation, command: "update_subclass_version", fields, reason: "stale_review", observed_action_revision: "5" } });

beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("INKBORNE_CLASS_ORIGIN_CREATION_UI", "true");
  mocks.context.mockResolvedValue({ status: "token_verified", context: { context_version: 1, actor_id: actor,
    session_id: other, jwt_expires_at: "2026-10-25T00:00:00.000000Z" } });
  mocks.client.mockResolvedValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: preview(), error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("reviewed subclass update server boundary (Auth/RPC doubles)", () => {
  it("returns only a matching complete native preview and never sends a builder mutation", async () => {
    expect(await previewSubclassContentUpdate(actor, target, request)).toEqual(preview());
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("character_builder_subclass_update_preview_v1", {
      p_context: { context_version: 1, actor_id: actor, session_id: other, jwt_expires_at: "2026-10-25T00:00:00.000000Z" },
      p_character_id: target, p_subclass_ref_id: ref, p_target_content_version: 2,
    });
  });
  it.each([null, { ...request, target_content_version: 0 }, { ...request, target_content_version: 2147483648 },
    { ...request, subclass_ref_id: "bad" }, { ...request, actor_id: actor }, { ...request, preview_digest: "guessed" }])(
    "rejects invalid or caller-supplied protected preview fields before authentication", async value => {
      expect(await previewSubclassContentUpdate(actor, target, value)).toEqual(unavailable);
      expect(mocks.context).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
    });
  it.each(["actor", "target", "disabled"])("refuses invalid %s before authentication", async mode => {
    if (mode === "disabled") vi.stubEnv("INKBORNE_CLASS_ORIGIN_CREATION_UI", "false");
    expect(await previewSubclassContentUpdate(mode === "actor" ? "bad" : actor, mode === "target" ? "bad" : target, request)).toEqual(unavailable);
    expect(mocks.context).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("refuses a changed signed-in account without constructing an RPC client", async () => {
    expect(await previewSubclassContentUpdate(other, target, request)).toEqual(unavailable);
    expect(mocks.client).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(["actor", "target", "ref", "version", "automatic", "unknown"])("refuses a mismatched %s preview", async mode => {
    const response = preview();
    if (mode === "actor") response.preview.actor_id = other;
    if (mode === "target") response.preview.character_id = other;
    if (mode === "ref") response.preview.fields = { ...fields, subclass_ref_id: other };
    if (mode === "version") response.preview.fields = { ...fields, target_content_version: 3 };
    if (mode === "automatic") response.preview.automatic_spells_learned = 1;
    mocks.rpc.mockResolvedValue({ data: mode === "unknown" ? { ...response, raw_database_details: "withheld" } : response, error: null });
    expect(await previewSubclassContentUpdate(actor, target, request)).toEqual(unavailable);
  });
  it.each(["auth-throw", "client-throw", "rpc-throw", "rpc-error", "malformed"])("keeps %s unavailable without exposing error details", async mode => {
    if (mode === "auth-throw") mocks.context.mockRejectedValue(Error("private auth details"));
    if (mode === "client-throw") mocks.client.mockRejectedValue(Error("private client details"));
    if (mode === "rpc-throw") mocks.rpc.mockRejectedValue(Error("private database details"));
    if (mode === "rpc-error") mocks.rpc.mockResolvedValue({ data: null, error: { message: "private database details" } });
    if (mode === "malformed") mocks.rpc.mockResolvedValue({ data: { status: "available", preview: {} }, error: null });
    expect(await previewSubclassContentUpdate(actor, target, request)).toEqual(unavailable);
  });
  it("retains finite native refusals and rejects non-JSON preview inputs", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "unavailable", reason: "conflict" }, error: null });
    expect(await previewSubclassContentUpdate(actor, target, request)).toEqual({ status: "unavailable", reason: "conflict" });
    const cyclic: Record<string, unknown> = { ...request }; cyclic.self = cyclic;
    mocks.rpc.mockClear();
    expect(await previewSubclassContentUpdate(actor, target, cyclic)).toEqual(unavailable);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("sends and resolves the exact preview-bound original through the existing receipt protocol", async () => {
    const original = parseBuilderStepIntent({ contract_version: 1, command: "update_subclass_version", operation_id: operation,
      character_id: target, fields })!;
    expect(original).not.toBeNull(); expect(Object.isFrozen(original.fields)).toBe(true);
    const saved = { status: "applied", receipt: { operation_id: operation, character_id: target, actor_id: actor,
      command: original.command, fields, saved_choices: {}, saved_scores: {}, action_revision: "5" } };
    mocks.rpc.mockResolvedValueOnce({ data: saved, error: null }).mockResolvedValueOnce({ data: { ...saved, status: "recorded" }, error: null });
    expect(await submitBuilderStep(actor, original)).toEqual(saved);
    expect(await checkBuilderStep(actor, original)).toEqual({ ...saved, status: "recorded" });
    expect(mocks.rpc.mock.calls[0][1].p_request).toEqual(original);
    expect(mocks.rpc.mock.calls[1][0]).toBe("character_builder_subclass_update_resolution_v1");
    expect(mocks.rpc.mock.calls[1][1].p_request).toEqual(original);
  });
  it.each(["submit", "check"])("accepts an exact native stale-review proof on %s", async method => {
    mocks.rpc.mockResolvedValue({ data: rejected(), error: null });
    expect(await (method === "submit" ? submitBuilderStep : checkBuilderStep)(actor, original())).toEqual(rejected());
    expect(mocks.rpc.mock.calls[0][1].p_request).toEqual(original());
    expect(mocks.rpc.mock.calls[0][0]).toBe(method === "submit" ? "character_builder_command_v1" : "character_builder_subclass_update_resolution_v1");
  });
  it.each(["actor", "target", "operation", "fields", "equal", "earlier", "malformed", "unknown"])(
    "refuses a stale-review proof with %s mismatch", async mode => {
      const raw = rejected();
      if (mode === "actor") raw.rejection.actor_id = other;
      if (mode === "target") raw.rejection.character_id = other;
      if (mode === "operation") raw.rejection.operation_id = other;
      if (mode === "fields") raw.rejection.fields = { ...fields, preview_digest: "b".repeat(64) };
      if (mode === "equal") raw.rejection.observed_action_revision = "4";
      if (mode === "earlier") raw.rejection.observed_action_revision = "3";
      if (mode === "malformed") raw.rejection.observed_action_revision = "05";
      mocks.rpc.mockResolvedValue({ data: mode === "unknown" ? { ...raw, extra: true } : raw, error: null });
      await expect(checkBuilderStep(actor, original())).rejects.toThrow("could not be confirmed");
    });
  it.each(["throw", "error"])("resolves a lost %s submission using the complete original update", async mode => {
    if (mode === "throw") mocks.rpc.mockRejectedValueOnce(Error("private transport details"));
    else mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "private database details" } });
    mocks.rpc.mockResolvedValueOnce({ data: rejected(), error: null });
    expect(await submitBuilderStep(actor, original())).toEqual(rejected());
    expect(mocks.rpc.mock.calls.map(call => call[0])).toEqual(["character_builder_command_v1", "character_builder_subclass_update_resolution_v1"]);
    expect(mocks.rpc.mock.calls[1][1].p_request).toEqual(original());
  });
  it.each([{ ...fields, target_content_version: 1 }, { ...fields, expected_action_revision: "04" },
    { ...fields, preview_digest: "guessed" }, { ...fields, occurrence_id: "bad" }, { ...fields, class_slug: "wizard" }])(
    "refuses invalid correction intent before RPC", async badFields => {
      await expect(submitBuilderStep(actor, { contract_version: 1, operation_id: operation, character_id: target,
        command: "update_subclass_version", fields: badFields })).rejects.toThrow();
      expect(mocks.context).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
    });
});
