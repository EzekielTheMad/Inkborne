import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ context: vi.fn(), client: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/character-command-context", () => ({ resolveCharacterCommandContext: mocks.context }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
import { saveBuilderStep } from "@/app/(app)/characters/[id]/builder/step-actions";

const actor = "10000000-0000-4000-8000-000000000001", target = "10000000-0000-4000-8000-000000000002";
const other = "10000000-0000-4000-8000-000000000003", content = "10000000-0000-4000-8000-000000000004";
const fields = { content_id: content, content_version: 1 };
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
    await expect(saveBuilderStep(actor, target, "select_race", { ...fields, classes: [], plan: { currency: { gp: 99999 } } })).rejects.toThrow();
    expect(mocks.context).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("refuses a changed authenticated account before constructing the user RPC client", async () => {
    await expect(saveBuilderStep(other, target, "select_race", fields)).rejects.toThrow("sign-in changed");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("returns only the exact accepted domain patch's canonical saved values", async () => {
    expect(await saveBuilderStep(actor, target, "select_race", fields)).toEqual({ choices: { race: "human" }, scores: {}, action_revision: "2" });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("character_builder_command_v1", expect.objectContaining({
      p_request: expect.objectContaining({ command: "select_race", character_id: target, fields }),
    }));
  });
  it("resolves the identical operation after a thrown transport error without resending a mutation", async () => {
    let original: Record<string, unknown>;
    mocks.rpc.mockImplementationOnce((_name, args) => { original = args.p_request; return Promise.reject(Error("private transport details")); })
      .mockImplementationOnce(async (_name, args) => {
        expect(args.p_request).toEqual({ contract_version: 1, command: "resolve_builder", operation_id: original.operation_id, character_id: target });
        return { error: null, data: { ...applied(original), status: "recorded" } };
      });
    expect(await saveBuilderStep(actor, target, "select_race", fields)).toEqual({ choices: { race: "human" }, scores: {}, action_revision: "2" });
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });
  it.each(["actor_id", "character_id", "operation_id"])("refuses a structurally valid receipt for another %s", async key => {
    mocks.rpc.mockImplementation(async (_name, args) => {
      const response = applied(args.p_request);
      return { error: null, data: { ...response, receipt: { ...response.receipt, [key]: other } } };
    });
    await expect(saveBuilderStep(actor, target, "select_race", fields)).rejects.toThrow("could not be confirmed");
  });
});
