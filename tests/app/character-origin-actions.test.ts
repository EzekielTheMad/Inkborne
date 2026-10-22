// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), client: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/character-command-context", () => ({ resolveCharacterCommandContext: mocks.verify }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.client }));
import { checkOriginCreation, submitOriginCreation } from "@/app/(app)/characters/new/origin-actions";

// Executes the actual action AND production adapter. Only verified-context and
// transport dependencies are mocked; this establishes no provider/native proof.
const actor = "10000000-0000-4000-8000-000000000001", session = "10000000-0000-4000-8000-000000000002";
const operation = "10000000-0000-4000-8000-000000000003", system = "10000000-0000-4000-8000-000000000004";
const target = "10000000-0000-4000-8000-000000000005";
const intent = () => ({ contract_version: 1, operation_id: operation, command: "create_character",
  fields: { name: "Elara", system_id: system, campaign_id: null } });
const context = () => ({ context_version: 1, actor_id: actor, session_id: session, jwt_expires_at: "2026-10-22T22:00:00.000000Z" });
const receipt = () => ({ receipt_version: 1, receipt_kind: "bootstrap_new", operation_id: operation,
  verified_actor_id: actor, target_character_id: target, accepted_at: "2026-10-22T21:00:00.123456Z", canonical_intent: intent(),
  initial_action_revision: "0", initial_class_revision: "0", initial_producer_revision: "0", copy_lineage: null });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("INKBORNE_CLASS_ORIGIN_CREATION_UI", "true");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fixture.invalid"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-only");
  mocks.verify.mockResolvedValue({ status: "token_verified", context: context() });
  mocks.client.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: { status: "recorded", receipt: receipt() }, error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("disabled-by-default creation UI actions", () => {
  it.each(["", "false", "TRUE", "1"])("does nothing without exact local enablement %j", async flag => {
    vi.stubEnv("INKBORNE_CLASS_ORIGIN_CREATION_UI", flag);
    expect(await submitOriginCreation(actor, intent())).toEqual({ status: "disabled" });
    expect(await checkOriginCreation(actor, intent())).toEqual({ status: "disabled" });
    expect(mocks.verify).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("derives authority once and exposes only the confirmed IDs", async () => {
    expect(await submitOriginCreation(actor, intent())).toEqual({ status: "confirmed", account_id: actor, operation_id: operation, character_id: target });
    expect(mocks.verify).toHaveBeenCalledExactlyOnceWith();
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("character_creation_command_v1", { p_context: context(), p_request: intent() });
    expect(mocks.client).toHaveBeenCalledExactlyOnceWith("https://fixture.invalid", "fixture-only", { auth: { persistSession: false, autoRefreshToken: false } });
  });
  it.each(["create", "recover"])("rejects a stale page account before any %s RPC", async kind => {
    mocks.verify.mockResolvedValue({ status: "token_verified", context: { ...context(), actor_id: target } });
    expect(await (kind === "create" ? submitOriginCreation(actor, intent()) : checkOriginCreation(actor, intent()))).toEqual({ status: "unavailable" });
    expect(mocks.verify).toHaveBeenCalledTimes(1); expect(mocks.client).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([null, {}, { ...intent(), actor_id: actor }, { ...intent(), token: "browser-token" },
    { ...intent(), fields: { ...intent().fields, name: " Elara " } }])("refuses non-original input before Auth %j", async input => {
    expect(await submitOriginCreation(actor, input)).toEqual({ status: "invalid" });
    expect(mocks.verify).not.toHaveBeenCalled();
  });
  it("refuses a malformed expected account without transport", async () => {
    expect(await submitOriginCreation("not-an-account", intent())).toEqual({ status: "invalid" });
    expect(mocks.verify).not.toHaveBeenCalled();
  });
  it("recovery reuses only the stored operation and verifies the full original intent", async () => {
    expect((await checkOriginCreation(actor, intent())).status).toBe("confirmed");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("character_creation_command_v1", { p_context: context(),
      p_request: { contract_version: 1, command: "resolve_creation", operation_id: operation } });
    mocks.rpc.mockResolvedValue({ data: { status: "recorded", receipt: { ...receipt(),
      canonical_intent: { ...intent(), fields: { ...intent().fields, name: "Other request" } } } }, error: null });
    expect(await checkOriginCreation(actor, intent())).toEqual({ status: "intent_conflict" });
  });
  it.each(["invalid", "unsupported", "intent_conflict"])("preserves create refusal %s without fallback", async status => {
    mocks.rpc.mockResolvedValue({ data: { status }, error: null });
    expect(await submitOriginCreation(actor, intent())).toEqual({ status }); expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("retains absence and ambiguous transport errors as unconfirmed outcomes", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "absent" }, error: null });
    expect(await checkOriginCreation(actor, intent())).toEqual({ status: "absent" });
    mocks.rpc.mockRejectedValue(new Error("private transport details"));
    expect(await submitOriginCreation(actor, intent())).toEqual({ status: "unavailable" });
    expect(mocks.rpc).toHaveBeenCalledTimes(2); // One per explicit action; no automatic retry.
  });
});
