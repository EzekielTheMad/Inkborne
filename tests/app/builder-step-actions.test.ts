import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ context: vi.fn(), client: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/character-command-context", () => ({ resolveCharacterCommandContext: mocks.context }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
import { checkBuilderStep, saveBuilderStep, submitBuilderStep } from "@/app/(app)/characters/[id]/builder/step-actions";
import { parseBuilderStepIntent } from "@/lib/builder/builder-step-command";

const actor = "10000000-0000-4000-8000-000000000001", target = "10000000-0000-4000-8000-000000000002";
const other = "10000000-0000-4000-8000-000000000003", content = "10000000-0000-4000-8000-000000000004";
const fields = { content_id: content, content_version: 1 };
const operation = "10000000-0000-4000-8000-000000000005";
const intent = { contract_version: 1, operation_id: operation, character_id: target, command: "select_race", fields };
function applied(request: Record<string, unknown>) {
  return { status: "applied", receipt: { operation_id: request.operation_id, character_id: target, actor_id: actor,
    command: request.command, fields: request.fields, saved_choices: { race: "human" }, saved_scores: {}, action_revision: "2" } };
}
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("INKBORNE_CLASS_ORIGIN_CREATION_UI", "true");
  mocks.context.mockResolvedValue({ status: "token_verified", context: { context_version: 1, actor_id: actor,
    session_id: other, jwt_expires_at: "2026-10-23T00:00:00.000000Z" } });
  mocks.client.mockResolvedValue({ rpc: mocks.rpc });
  mocks.rpc.mockImplementation(async (_name, args) => ({ error: null, data: applied(args.p_request) }));
});
afterEach(() => vi.unstubAllEnvs());

describe("builder domain action (Auth/RPC doubles; actual app acceptance is separate)", () => {
  it("refuses arbitrary whole-choice or award-plan input before authentication or an RPC", async () => {
    await expect(submitBuilderStep(actor, { ...intent, fields: { ...fields, classes: [], plan: { currency: { gp: 99999 } } } })).rejects.toThrow();
    expect(mocks.context).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("refuses a changed authenticated account before constructing the user RPC client", async () => {
    await expect(submitBuilderStep(other, intent)).rejects.toThrow("sign-in changed");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("returns only the exact accepted domain patch's canonical saved values", async () => {
    expect(await saveBuilderStep(actor, target, "select_race", fields, operation)).toEqual({ choices: { race: "human" }, scores: {}, action_revision: "2" });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("character_builder_command_v1", expect.objectContaining({
      p_request: intent,
    }));
  });
  it("resolves the identical operation after a thrown transport error without resending a mutation", async () => {
    let original: Record<string, unknown>;
    mocks.rpc.mockImplementationOnce((_name, args) => { original = args.p_request; return Promise.reject(Error("private transport details")); })
      .mockImplementationOnce(async (_name, args) => {
        expect(args.p_request).toEqual({ contract_version: 1, command: "resolve_builder", operation_id: original.operation_id, character_id: target });
        return { error: null, data: { ...applied(original), status: "recorded" } };
      });
    expect(await saveBuilderStep(actor, target, "select_race", fields, operation)).toEqual({ choices: { race: "human" }, scores: {}, action_revision: "2" });
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });
  it.each(["actor_id", "character_id", "operation_id", "command", "fields"])("refuses a structurally valid receipt for another %s", async key => {
    mocks.rpc.mockImplementation(async (_name, args) => {
      const response = applied(args.p_request);
      return { error: null, data: { ...response, receipt: { ...response.receipt, [key]: other } } };
    });
    await expect(submitBuilderStep(actor, intent)).rejects.toThrow("could not be confirmed");
  });
  it("requires a retained browser operation rather than minting one on the server", async () => {
    await expect(saveBuilderStep(actor, target, "select_race", fields)).rejects.toThrow();
    expect(mocks.context).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("checks the exact original after reload and returns its matched full receipt", async () => {
    mocks.rpc.mockImplementation(async (_name, args) => {
      expect(args.p_request).toEqual({ contract_version: 1, command: "resolve_builder", operation_id: operation, character_id: target });
      return { error: null, data: { ...applied(intent), status: "recorded" } };
    });
    expect(await checkBuilderStep(actor, intent)).toEqual({ ...applied(intent), status: "recorded" });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("retries the original request with the same identity and expectations", async () => {
    expect(await submitBuilderStep(actor, intent)).toEqual(applied(intent));
    expect(await submitBuilderStep(actor, intent)).toEqual(applied(intent));
    expect(mocks.rpc.mock.calls.map(call => call[1].p_request)).toEqual([intent, intent]);
  });
  it("returns absent without interpreting it as cancellation or sending a mutation", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "absent" }, error: null });
    expect(await checkBuilderStep(actor, intent)).toEqual({ status: "absent" });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it.each(["malformed", "error", "throw"])("keeps a %s lookup uncertain with no mutation fallback", async mode => {
    if (mode === "throw") mocks.rpc.mockRejectedValue(Error("private transport details"));
    else mocks.rpc.mockResolvedValue(mode === "error" ? { data: null, error: { message: "private database details" } }
      : { data: { status: "recorded", receipt: {} }, error: null });
    await expect(checkBuilderStep(actor, intent)).rejects.toThrow("could not be confirmed");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it.each([null, { ...intent, operation_id: undefined }, { ...intent, contract_version: 2 },
    { ...intent, extra: "untrusted" }, { ...intent, command: "resolve_builder" }])("refuses invalid original input before Auth", async input => {
    await expect(checkBuilderStep(actor, input)).rejects.toThrow();
    expect(mocks.context).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("accepts large valid narratives and rejects cycles and non-JSON input safely", () => {
    const narrative = { ...intent, command: "background_narrative", fields: { key: "bonds", values: Array(20).fill("界".repeat(2000)) } };
    expect(parseBuilderStepIntent(narrative)).toEqual(narrative);
    const cyclic: Record<string, unknown> = { ...intent }; cyclic.fields = cyclic;
    expect(parseBuilderStepIntent(cyclic)).toBeNull();
    expect(parseBuilderStepIntent({ ...intent, fields: new Date() })).toBeNull();
  });
});
