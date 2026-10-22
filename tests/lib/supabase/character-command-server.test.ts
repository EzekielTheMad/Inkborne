// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), client: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/character-command-context", () => ({ resolveCharacterCommandContext: mocks.verify }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.client }));
import { createClassOriginCharacter, resolveClassOriginCreation } from "@/lib/supabase/character-command-server";

// Transport/response parsing only. The same-token verifier is tested separately;
// these mocks do not establish native Auth, installed RPC or a saved character.
const actor = "10000000-0000-4000-8000-000000000001", session = "10000000-0000-4000-8000-000000000002";
const operation = "10000000-0000-4000-8000-000000000003", system = "10000000-0000-4000-8000-000000000004";
const target = "10000000-0000-4000-8000-000000000005";
const url = "https://character-command-fixture.invalid", key = "fixture-server-credential";
const context = () => Object.freeze({ context_version: 1, actor_id: actor, session_id: session, jwt_expires_at: "2026-10-22T22:00:00.000000Z" });
const intent = () => ({ contract_version: 1, operation_id: operation, command: "create_character",
  fields: { name: "Fixture", system_id: system, campaign_id: null } });
const receipt = () => ({ receipt_version: 1, receipt_kind: "bootstrap_new", operation_id: operation,
  verified_actor_id: actor, target_character_id: target, accepted_at: "2026-10-22T21:00:00.123456Z",
  canonical_intent: intent(), initial_action_revision: "0", initial_class_revision: "0", initial_producer_revision: "0", copy_lineage: null });
const unavailable = { status: "unavailable", reason: "character_creation_unavailable" };
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", key);
  mocks.verify.mockResolvedValue({ status: "token_verified", context: context() });
  mocks.client.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: { status: "recorded", receipt: receipt() }, error: null });
});
afterEach(() => { vi.unstubAllEnvs(); });
describe("server-only staged creation transport", () => {
  it("gets context itself and sends one exact RPC using a fresh cookie-free service client", async () => {
    expect(await createClassOriginCharacter(intent())).toEqual({ status: "recorded", receipt: receipt() });
    expect(mocks.verify).toHaveBeenCalledExactlyOnceWith();
    expect(mocks.client).toHaveBeenCalledExactlyOnceWith(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("character_creation_command_v1", { p_context: context(), p_request: intent() });
  });
  it("resolves the same operation with a freshly verified context and no target/actor argument", async () => {
    expect(await resolveClassOriginCreation(operation)).toEqual({ status: "recorded", receipt: receipt() });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("character_creation_command_v1", { p_context: context(),
      p_request: { contract_version: 1, command: "resolve_creation", operation_id: operation } });
  });
  it("creates a new client/context per invocation instead of retaining account state", async () => {
    await createClassOriginCharacter(intent()); await resolveClassOriginCreation(operation);
    expect(mocks.verify).toHaveBeenCalledTimes(2); expect(mocks.client).toHaveBeenCalledTimes(2);
  });
  it.each([null, [], {}, { ...intent(), actor_id: actor }, { ...intent(), context: context() },
    { ...intent(), command: "copy_character" }, { ...intent(), operation_id: "bad" },
    { ...intent(), fields: { ...intent().fields, campaign_id: actor } },
    { ...intent(), fields: { ...intent().fields, name: " Fixture " } },
    { ...intent(), fields: { ...intent().fields, name: "x".repeat(33000) } },
  ])("rejects browser identity/unsupported input before verification: %j", async input => {
    expect(await createClassOriginCharacter(input)).toEqual({ status: "invalid" });
    expect(mocks.verify).not.toHaveBeenCalled(); expect(mocks.client).not.toHaveBeenCalled();
  });
  it("bounds cyclic/deep/non-JSON inputs before schema parsing", async () => {
    const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
    expect(await createClassOriginCharacter(cyclic)).toEqual({ status: "invalid" });
    expect(await createClassOriginCharacter({ ...intent(), extra: () => "ignored" })).toEqual({ status: "invalid" });
    expect(mocks.verify).not.toHaveBeenCalled();
  });
  it.each([null, {}, actor.toUpperCase().replace("10000000", "ABCDEF00"), "bad"])("rejects malformed operation lookup %j", async operationId => {
    expect(await resolveClassOriginCreation(operationId)).toEqual({ status: "invalid" });
    expect(mocks.verify).not.toHaveBeenCalled();
  });
  it("does not construct a service client when token verification is unavailable", async () => {
    mocks.verify.mockResolvedValue({ status: "unavailable", reason: "auth_unavailable" });
    expect(await createClassOriginCharacter(intent())).toEqual(unavailable); expect(mocks.client).not.toHaveBeenCalled();
  });
  it("maps thrown verifier errors to a generic result", async () => {
    mocks.verify.mockRejectedValue(new Error("fixture-secret-provider-error"));
    expect(await resolveClassOriginCreation(operation)).toEqual(unavailable); expect(mocks.client).not.toHaveBeenCalled();
  });
  it.each(["", "   "])("fails absent/blank service configuration %j without transport", async serviceKey => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", serviceKey);
    expect(await createClassOriginCharacter(intent())).toEqual(unavailable); expect(mocks.client).not.toHaveBeenCalled();
  });
  it("refuses a Supabase URL changed during verification", async () => {
    mocks.verify.mockImplementation(async () => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://different-project.invalid");
      return { status: "token_verified", context: context() }; });
    expect(await createClassOriginCharacter(intent())).toEqual(unavailable); expect(mocks.client).not.toHaveBeenCalled();
  });
  it("copies the parsed caller intent before the verifier awaits", async () => {
    const input = intent();
    mocks.verify.mockImplementation(async () => { input.fields.name = "Changed after parse";
      return { status: "token_verified", context: context() }; });
    expect((await createClassOriginCharacter(input)).status).toBe("recorded");
    expect(mocks.rpc.mock.calls[0][1].p_request.fields.name).toBe("Fixture");
  });
  it("preserves exact native microseconds while parsing a matching original receipt", async () => {
    const result = await createClassOriginCharacter(intent());
    expect(result.status === "recorded" && result.receipt.accepted_at).toBe("2026-10-22T21:00:00.123456Z");
  });
  it("accepts the original producer applied receipt only for create", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "applied", receipt: receipt() }, error: null });
    expect(await createClassOriginCharacter(intent())).toEqual({ status: "applied", receipt: receipt() });
    expect(await resolveClassOriginCreation(operation)).toEqual(unavailable);
  });
  it.each([
    { status: "recorded", receipt: { ...receipt(), verified_actor_id: target } },
    { status: "recorded", receipt: { ...receipt(), operation_id: target } },
    { status: "recorded", receipt: { ...receipt(), initial_action_revision: "1" } },
    { status: "recorded", receipt: { ...receipt(), canonical_intent: { ...intent(), fields: { ...intent().fields, name: "Different" } } } },
    { status: "recorded", receipt: receipt(), token: "must-not-return" },
    { status: "recorded", receipt: { ...receipt(), extra: true } },
    { status: "accepted", receipt: receipt() }, { status: "absent" }, null,
    { status: "invalid", extra: "x".repeat(70000) },
  ])("refuses an unbound/malformed/oversized response: %j", async data => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    expect(await createClassOriginCharacter(intent())).toEqual(unavailable);
  });
  it("rejects campaign/copy receipt recovery outside the finite profile", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "recorded", receipt: { ...receipt(),
      canonical_intent: { ...intent(), fields: { ...intent().fields, campaign_id: actor } } } }, error: null });
    expect(await resolveClassOriginCreation(operation)).toEqual(unavailable);
  });
  it.each(["create", "resolve"])("refuses raw padded receipt names on %s before shared-schema trimming", async kind => {
    mocks.rpc.mockResolvedValue({ data: { status: "recorded", receipt: { ...receipt(),
      canonical_intent: { ...intent(), fields: { ...intent().fields, name: " Fixture " } } } }, error: null });
    expect(await (kind === "create" ? createClassOriginCharacter(intent()) : resolveClassOriginCreation(operation))).toEqual(unavailable);
  });
  it("returns bounded absence only on same-operation recovery", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "absent" }, error: null });
    expect(await resolveClassOriginCreation(operation)).toEqual({ status: "absent" });
    expect(mocks.rpc).toHaveBeenCalledTimes(1); // No alternate insert, retry or new ID.
  });
  it.each(["intent_conflict", "unsupported"])("refuses inappropriate %s on recovery", async status => {
    mocks.rpc.mockResolvedValue({ data: { status }, error: null });
    expect(await resolveClassOriginCreation(operation)).toEqual(unavailable);
  });
  it.each(["invalid", "unsupported", "intent_conflict"])("preserves finite create refusal %s", async status => {
    mocks.rpc.mockResolvedValue({ data: { status }, error: null });
    expect(await createClassOriginCharacter(intent())).toEqual({ status });
  });
  it("returns a generic uncertain result on a database denial without fallback", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "P0001", message: "auth_unavailable fixture-private", details: key } });
    expect(await createClassOriginCharacter(intent())).toEqual(unavailable);
    expect(mocks.rpc).toHaveBeenCalledTimes(1); expect(mocks.client).toHaveBeenCalledTimes(1);
  });
  it("does not retry an ambiguous thrown transport failure", async () => {
    mocks.rpc.mockRejectedValue(new Error(`fixture-transport-error ${key}`));
    expect(await createClassOriginCharacter(intent())).toEqual(unavailable); expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
});
