// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), client: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/character-command-context", () => ({ resolveCharacterCommandContext: mocks.verify }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.client }));
import { checkFirstClass, submitFirstClass } from "@/app/(app)/characters/[id]/builder/first-class/actions";

// Actual action and adapter; verifier/HTTP transport doubles do not establish
// native Auth, PostgREST or persistence.
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const account = id(1), target = id(2), operation = id(3), content = id(4), other = id(5);
const intent = () => ({ contract_version: 1, command: "add_class", character_id: target, operation_id: operation,
  expected_action_revision: "0", expected_class_revision: "0", fields: { content_id: content, content_version: 1, subclass: null } });
const context = () => ({ context_version: 1, actor_id: account, session_id: id(6), jwt_expires_at: "2026-10-22T23:00:00.000000Z" });
const receipt = () => ({ receipt_version: 1, receipt_kind: "class_transition", operation_id: operation, verified_actor_id: account,
  target_character_id: target, accepted_at: "2026-10-22T22:00:00.123456Z", canonical_intent: intent(),
  before_action_revision: "0", after_action_revision: "1", before_class_revision: "0", after_class_revision: "1", confirmation: null });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("INKBORNE_CLASS_ORIGIN_CREATION_UI", "true");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://first-class-actions.invalid"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-only");
  mocks.verify.mockResolvedValue({ status: "token_verified", context: context() });
  mocks.client.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: { status: "applied", receipt: receipt() }, error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("default-off first-class actions with actual server adapter", () => {
  it.each(["", "false", "TRUE", "1"])("does no Auth/client/transport work for flag %j", async flag => {
    vi.stubEnv("INKBORNE_CLASS_ORIGIN_CREATION_UI", flag);
    expect(await submitFirstClass(account, intent())).toEqual({ status: "disabled" });
    expect(await checkFirstClass(account, intent())).toEqual({ status: "disabled" });
    expect(mocks.verify).not.toHaveBeenCalled(); expect(mocks.client).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("returns only confirmed account/target/operation IDs from an exact applied receipt", async () => {
    expect(await submitFirstClass(account, intent())).toEqual({ status: "confirmed", account_id: account,
      character_id: target, operation_id: operation });
    expect(mocks.verify).toHaveBeenCalledExactlyOnceWith();
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("character_class_command_v1", { p_context: context(), p_request: intent() });
  });
  it.each(["submit", "recover"])("rejects switched cookie account before %s client construction", async kind => {
    mocks.verify.mockResolvedValue({ status: "token_verified", context: { ...context(), actor_id: other } });
    expect(await (kind === "submit" ? submitFirstClass(account, intent()) : checkFirstClass(account, intent())))
      .toEqual({ status: "unavailable" });
    expect(mocks.client).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([null, {}, { ...intent(), actor_id: account }, { ...intent(), command: "set_level" },
    { ...intent(), expected_action_revision: "1" }, { ...intent(), fields: { ...intent().fields, subclass: {} } }])(
    "refuses nonfinite input before verification: %j", async input => {
      expect(await submitFirstClass(account, input)).toEqual({ status: "invalid" });
      expect(await checkFirstClass(account, input)).toEqual({ status: "invalid" });
      expect(mocks.verify).not.toHaveBeenCalled();
    });
  it("refuses a malformed bound account before verification", async () => {
    expect(await submitFirstClass("bad", intent())).toEqual({ status: "invalid" }); expect(mocks.verify).not.toHaveBeenCalled();
  });
  it("recovers the same operation using only four SQL fields while validating the full original class/version", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "recorded", receipt: receipt() }, error: null });
    expect(await checkFirstClass(account, intent())).toEqual({ status: "confirmed", account_id: account,
      character_id: target, operation_id: operation });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("character_class_command_v1", { p_context: context(),
      p_request: { contract_version: 1, command: "resolve_class", character_id: target, operation_id: operation } });
    for (const fields of [{ ...intent().fields, content_id: other }, { ...intent().fields, content_version: 2 }]) {
      mocks.rpc.mockResolvedValue({ data: { status: "recorded", receipt: { ...receipt(), canonical_intent: { ...intent(), fields } } }, error: null });
      expect(await checkFirstClass(account, intent())).toEqual({ status: "unavailable" });
    }
  });
  it("retains absent and fixed conflict without exposing SQL details", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "absent" }, error: null });
    expect(await checkFirstClass(account, intent())).toEqual({ status: "absent" });
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "23505", message: "operation_intent_conflict", details: "private-fixture" } });
    expect(await submitFirstClass(account, intent())).toEqual({ status: "intent_conflict" });
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });
  it("returns generic uncertainty on malformed success or lost response, with no retry/fallback", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "applied", receipt: receipt(), token: "private-fixture" }, error: null });
    expect(await submitFirstClass(account, intent())).toEqual({ status: "unavailable" });
    mocks.rpc.mockRejectedValue(Error("private-fixture transport"));
    expect(await submitFirstClass(account, intent())).toEqual({ status: "unavailable" });
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });
});
