// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), client: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/character-command-context", () => ({ resolveCharacterCommandContext: mocks.verify }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.client }));
import { addFirstClassForAccount, resolveFirstClassForAccount } from "@/lib/supabase/character-class-command-server";
import { parseFirstClassIntent, parseFirstClassReceipt, sameFirstClassIntent } from "@/lib/character/first-class-command-schema";

// Local transport/schema evidence only. Context and RPC doubles establish no
// provider verification, installed HTTP endpoint, native roles or saved character.
const actor = "10000000-0000-4000-8000-000000000001", session = "10000000-0000-4000-8000-000000000002";
const target = "10000000-0000-4000-8000-000000000003", operation = "10000000-0000-4000-8000-000000000004";
const content = "10000000-0000-4000-8000-000000000005", other = "10000000-0000-4000-8000-000000000006";
const url = "https://first-class-transport.invalid", key = "fixture-server-credential";
const context = () => Object.freeze({ context_version: 1, actor_id: actor, session_id: session,
  jwt_expires_at: "2026-10-22T23:00:00.000000Z" });
const intent = () => ({ contract_version: 1, command: "add_class", character_id: target, operation_id: operation,
  expected_action_revision: "0", expected_class_revision: "0", fields: { content_id: content, content_version: 1, subclass: null } });
const receipt = () => ({ receipt_version: 1, receipt_kind: "class_transition", operation_id: operation,
  verified_actor_id: actor, target_character_id: target, accepted_at: "2026-10-22T22:00:00.123456Z", canonical_intent: intent(),
  before_action_revision: "0", after_action_revision: "1", before_class_revision: "0", after_class_revision: "1", confirmation: null });
const unavailable = { status: "unavailable", reason: "character_class_unavailable" };
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", key);
  mocks.verify.mockResolvedValue({ status: "token_verified", context: context() });
  mocks.client.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: { status: "applied", receipt: receipt() }, error: null });
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("strict reusable first-class shapes", () => {
  it("copies and freezes both original intent levels and compares values independent of object key order", () => {
    const input = intent(), parsed = parseFirstClassIntent(input);
    expect(parsed).toEqual(input); expect(parsed).not.toBe(input);
    expect(Object.isFrozen(parsed)).toBe(true); expect(Object.isFrozen(parsed!.fields)).toBe(true);
    input.fields.content_version = 2;
    expect(parsed!.fields.content_version).toBe(1);
    expect(sameFirstClassIntent(parsed, { fields: { subclass: null, content_version: 1, content_id: content },
      expected_class_revision: "0", operation_id: operation, expected_action_revision: "0", character_id: target,
      command: "add_class", contract_version: 1 })).toBe(true);
    expect(sameFirstClassIntent(parsed, input)).toBe(false);
  });
  it.each([null, [], {}, { ...intent(), actor_id: actor }, { ...intent(), context: context() },
    { ...intent(), expected_action_revision: "1" }, { ...intent(), expected_class_revision: 0 },
    { ...intent(), fields: { ...intent().fields, content_version: 0 } },
    { ...intent(), fields: { ...intent().fields, content_version: 2147483648 } },
    { ...intent(), fields: { ...intent().fields, content_version: 1.5 } },
    { ...intent(), fields: { ...intent().fields, subclass: { content_id: other, content_version: 1 } } },
    { ...intent(), fields: { ...intent().fields, content_id: "ABCDEF00-0000-4000-8000-000000000001" } },
    { ...intent(), fields: { ...intent().fields, extra: true } },
    { ...intent(), fields: { ...intent().fields, content_id: "bad" } },
  ])("rejects unsupported/noncanonical finite intent before verification: %j", async input => {
    expect(parseFirstClassIntent(input)).toBeNull();
    expect(await addFirstClassForAccount(actor, input)).toEqual({ status: "invalid" });
    expect(await resolveFirstClassForAccount(actor, input)).toEqual({ status: "invalid" });
    expect(mocks.verify).not.toHaveBeenCalled(); expect(mocks.client).not.toHaveBeenCalled();
  });
  it.each(["set_level", "set_subclass", "remove_class", "reorder_classes", "confirm_origin", "create_character", "resolve_class"])(
    "refuses unsupported operation %s without transport", async command => {
      expect(await addFirstClassForAccount(actor, { ...intent(), command })).toEqual({ status: "invalid" });
      expect(mocks.verify).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
    });
  it("bounds deep/cyclic/non-JSON/oversized input and throwing getters before schema recursion", async () => {
    const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
    let deep: unknown = {}; for (let count = 0; count < 45; count++) deep = { child: deep };
    const throwing = Object.defineProperty({}, "fields", { enumerable: true, get() { throw Error("fixture-private"); } });
    for (const input of [cyclic, deep, { ...intent(), extra: () => "ignored" }, throwing,
      { ...intent(), extra: "x".repeat(32769) }, new Date(), { ...intent(), fields: { ...intent().fields, content_version: NaN } }]) {
      expect(parseFirstClassIntent(input)).toBeNull();
      expect(await addFirstClassForAccount(actor, input)).toEqual({ status: "invalid" });
    }
    expect(mocks.verify).not.toHaveBeenCalled();
  });
  it("accepts only the exact first0→1 receipt and preserves native microseconds", () => {
    expect(parseFirstClassReceipt(receipt())).toEqual(receipt());
    expect(parseFirstClassReceipt({ ...receipt(), after_class_revision: "2" })).toBeNull();
    expect(parseFirstClassReceipt({ ...receipt(), accepted_at: "2026-10-22T22:00:00.1234567Z" })).toBeNull();
    expect(parseFirstClassReceipt({ ...receipt(), accepted_at: "2026-02-30T22:00:00.123456Z" })).toBeNull();
    expect(parseFirstClassReceipt({ ...receipt(), canonical_intent: { ...intent(), operation_id: other } })).toBeNull();
  });
});

describe("account-bound server-only first-class transport", () => {
  it("obtains context itself and sends one exact add RPC from a fresh cookie-free service client", async () => {
    expect(await addFirstClassForAccount(actor, intent())).toEqual({ status: "applied", receipt: receipt() });
    expect(mocks.verify).toHaveBeenCalledExactlyOnceWith();
    expect(mocks.client).toHaveBeenCalledExactlyOnceWith(url, key,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("character_class_command_v1", { p_context: context(), p_request: intent() });
  });
  it("resolves the original target/operation and binds the entire original receipt before returning recorded", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "recorded", receipt: receipt() }, error: null });
    expect(await resolveFirstClassForAccount(actor, intent())).toEqual({ status: "recorded", receipt: receipt() });
    expect(mocks.verify).toHaveBeenCalledExactlyOnceWith();
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("character_class_command_v1", { p_context: context(),
      p_request: { contract_version: 1, command: "resolve_class", character_id: target, operation_id: operation } });
  });
  it.each(["add", "resolve"])("rejects stale-account %s before constructing a service client", async kind => {
    mocks.verify.mockResolvedValue({ status: "token_verified", context: { ...context(), actor_id: other } });
    expect(await (kind === "add" ? addFirstClassForAccount(actor, intent()) : resolveFirstClassForAccount(actor, intent())))
      .toEqual(unavailable);
    expect(mocks.verify).toHaveBeenCalledExactlyOnceWith(); expect(mocks.client).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([null, {}, "bad", "00000000-0000-0000-0000-000000000000", "ffffffff-ffff-ffff-ffff-ffffffffffff"])(
    "requires a canonical bound account identifier: %j", async account => {
      expect(await addFirstClassForAccount(account, intent())).toEqual({ status: "invalid" });
      expect(await resolveFirstClassForAccount(account, intent())).toEqual({ status: "invalid" });
      expect(mocks.verify).not.toHaveBeenCalled(); expect(mocks.client).not.toHaveBeenCalled();
    });
  it("copies the original intent before verification awaits, so later caller mutation cannot change the command", async () => {
    const input = intent();
    mocks.verify.mockImplementation(async () => { input.fields.content_version = 2;
      return { status: "token_verified", context: context() }; });
    expect((await addFirstClassForAccount(actor, input)).status).toBe("applied");
    expect(mocks.rpc.mock.calls[0][1].p_request.fields.content_version).toBe(1);
  });
  it("does not retain a service client, verified session or account between invocations", async () => {
    await addFirstClassForAccount(actor, intent());
    mocks.verify.mockResolvedValue({ status: "token_verified", context: { ...context(), actor_id: other } });
    expect(await addFirstClassForAccount(actor, intent())).toEqual(unavailable);
    expect(mocks.verify).toHaveBeenCalledTimes(2); expect(mocks.client).toHaveBeenCalledTimes(1);
  });
  it.each(["absent", "throw"])("fails closed when context is %s", async mode => {
    if (mode === "throw") mocks.verify.mockRejectedValue(Error(`fixture-secret ${key}`));
    else mocks.verify.mockResolvedValue({ status: "unavailable", reason: "auth_unavailable" });
    expect(await addFirstClassForAccount(actor, intent())).toEqual(unavailable); expect(mocks.client).not.toHaveBeenCalled();
  });
  it.each(["", "   "])("refuses blank service credentials %j", async value => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", value);
    expect(await addFirstClassForAccount(actor, intent())).toEqual(unavailable); expect(mocks.client).not.toHaveBeenCalled();
  });
  it("refuses a changed project URL after verification", async () => {
    mocks.verify.mockImplementation(async () => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://other-project.invalid");
      return { status: "token_verified", context: context() }; });
    expect(await addFirstClassForAccount(actor, intent())).toEqual(unavailable); expect(mocks.client).not.toHaveBeenCalled();
  });
  it("accepts native replay only on submit and recorded only on resolution", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "replayed", receipt: receipt() }, error: null });
    expect(await addFirstClassForAccount(actor, intent())).toEqual({ status: "replayed", receipt: receipt() });
    expect(await resolveFirstClassForAccount(actor, intent())).toEqual(unavailable);
    mocks.rpc.mockResolvedValue({ data: { status: "recorded", receipt: receipt() }, error: null });
    expect(await addFirstClassForAccount(actor, intent())).toEqual(unavailable);
    expect(await resolveFirstClassForAccount(actor, intent())).toEqual({ status: "recorded", receipt: receipt() });
  });
  it.each([
    { ...receipt(), verified_actor_id: other }, { ...receipt(), target_character_id: other },
    { ...receipt(), operation_id: other }, { ...receipt(), receipt_kind: "bootstrap_new" },
    { ...receipt(), before_action_revision: "1", after_action_revision: "2" },
    { ...receipt(), before_class_revision: "1", after_class_revision: "2" },
    { ...receipt(), confirmation: {} }, { ...receipt(), extra: true },
    { ...receipt(), canonical_intent: { ...intent(), fields: { ...intent().fields, content_version: 2 } } },
    { ...receipt(), canonical_intent: { ...intent(), fields: { ...intent().fields, subclass: {} } } },
    { ...receipt(), canonical_intent: { ...intent(), character_id: other } },
    { ...receipt(), canonical_intent: { ...intent(), actor_id: actor } },
    { ...receipt(), accepted_at: "2026-10-22T22:00:00.123Z" },
  ])("refuses mismatched or broadened raw receipts on submit and recovery: %j", async value => {
    mocks.rpc.mockResolvedValue({ data: { status: "applied", receipt: value }, error: null });
    expect(await addFirstClassForAccount(actor, intent())).toEqual(unavailable);
    mocks.rpc.mockResolvedValue({ data: { status: "recorded", receipt: value }, error: null });
    expect(await resolveFirstClassForAccount(actor, intent())).toEqual(unavailable);
  });
  it.each([null, [], { status: "accepted", receipt: receipt() }, { status: "applied", receipt: receipt(), context: context() },
    { status: "invalid", extra: true }, { status: "absent", error: key }, { status: "invalid", extra: "x".repeat(65537) }])(
    "returns no raw malformed/extra/oversized transport fields: %j", async data => {
      mocks.rpc.mockResolvedValue({ data, error: null });
      expect(await addFirstClassForAccount(actor, intent())).toEqual(unavailable);
    });
  it("returns absence only for original-intent resolution and never performs a fallback or new operation", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "absent" }, error: null });
    expect(await addFirstClassForAccount(actor, intent())).toEqual(unavailable);
    expect(await resolveFirstClassForAccount(actor, intent())).toEqual({ status: "absent" });
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });
  it("preserves the finite SQL invalid response", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "invalid" }, error: null });
    expect(await addFirstClassForAccount(actor, intent())).toEqual({ status: "invalid" });
  });
  it("maps only the exact controlled submit conflict, retaining no SQL details", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "23505", message: "operation_intent_conflict", details: key } });
    expect(await addFirstClassForAccount(actor, intent())).toEqual({ status: "intent_conflict" });
    expect(await resolveFirstClassForAccount(actor, intent())).toEqual(unavailable);
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "23505", message: `other_unique_violation ${key}` } });
    expect(await addFirstClassForAccount(actor, intent())).toEqual(unavailable);
  });
  it.each(["P0001", "23514", "42501", "40001", "40P01"])("keeps %s denial uncertain and generic without retries", async code => {
    mocks.rpc.mockResolvedValue({ data: { status: "applied", receipt: receipt() },
      error: { code, message: `fixture-private ${key}`, details: context() } });
    expect(await addFirstClassForAccount(actor, intent())).toEqual(unavailable);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("does not retry a lost response that may follow commit", async () => {
    mocks.rpc.mockRejectedValue(Error(`fixture-private ${key}`));
    expect(await addFirstClassForAccount(actor, intent())).toEqual(unavailable);
    expect(mocks.rpc).toHaveBeenCalledTimes(1); expect(mocks.client).toHaveBeenCalledTimes(1);
  });
});
