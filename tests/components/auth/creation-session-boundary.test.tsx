import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({ client: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: mocks.client }));
import { CreationSessionBoundary } from "@/components/auth/creation-session-boundary";
import { parseCreationIntent } from "@/lib/character/pending-creation-schema";
import { creationStorageKey, getCreationScope, persistPendingCreation, readPendingCreation, setCreationAccount } from "@/lib/character/pending-creation-storage";

const account = "10000000-0000-4000-8000-000000000001", other = "10000000-0000-4000-8000-000000000004";
const operation = "10000000-0000-4000-8000-000000000002", system = "10000000-0000-4000-8000-000000000005";
const intent = () => parseCreationIntent({ contract_version: 1, operation_id: operation, command: "create_character",
  fields: { name: "Elara", system_id: system, campaign_id: null } })!;
let event: (kind: AuthChangeEvent, session: Session | null) => void;
const sessionFor = (id: string) => ({ user: { id } }) as Session;
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear(); setCreationAccount(account, sessionStorage);
  mocks.subscribe.mockImplementation(handler => { event = handler; return { data: { subscription: { unsubscribe: mocks.unsubscribe } } }; });
  mocks.client.mockReturnValue({ auth: { onAuthStateChange: mocks.subscribe } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("local creation account boundary (Auth events mocked)", () => {
  it("preserves pending during same-account refresh and a failed sign-out attempt with no confirmed transition", () => {
    const lease = getCreationScope(), pending = persistPendingCreation(intent(), lease, sessionStorage);
    render(<CreationSessionBoundary accountId={account} />);
    act(() => event("TOKEN_REFRESHED", sessionFor(account)));
    // A failed POST/SDK attempt does not emit SIGNED_OUT. No eager nav clear.
    expect(readPendingCreation(account, sessionStorage)).toEqual(pending);
    expect(getCreationScope().epoch).toBe(lease.epoch);
  });
  it("confirmed sign-out clears and rejects old writes, including after stale boundary remount/refresh", () => {
    const lease = getCreationScope(); persistPendingCreation(intent(), lease, sessionStorage);
    const first = render(<CreationSessionBoundary accountId={account} />);
    act(() => event("SIGNED_OUT", null));
    expect(sessionStorage.getItem(creationStorageKey(account))).toBeNull();
    expect(() => persistPendingCreation(intent(), lease, sessionStorage)).toThrow();
    first.unmount(); render(<CreationSessionBoundary accountId={account} />);
    act(() => event("TOKEN_REFRESHED", sessionFor(account)));
    expect(getCreationScope().accountId).toBeNull();
    expect(() => persistPendingCreation(intent(), lease, sessionStorage)).toThrow();
  });
  it("a confirmed local empty session after redirect clears pending without treating a network failure as sign-out", () => {
    persistPendingCreation(intent(), getCreationScope(), sessionStorage);
    render(<CreationSessionBoundary accountId={undefined} />);
    expect(readPendingCreation(account, sessionStorage)).not.toBeNull();
    act(() => event("INITIAL_SESSION", null));
    expect(sessionStorage.getItem(creationStorageKey(account))).toBeNull();
  });
  it("switching account invalidates the old lease before the next account can create", () => {
    const old = getCreationScope(); persistPendingCreation(intent(), old, sessionStorage);
    sessionStorage.setItem("unrelated", "preserve");
    render(<CreationSessionBoundary accountId={account} />);
    act(() => event("SIGNED_IN", sessionFor(other)));
    expect(getCreationScope().accountId).toBe(other);
    expect(sessionStorage.getItem(creationStorageKey(account))).toBeNull();
    expect(() => persistPendingCreation(intent(), old, sessionStorage)).toThrow();
    expect(sessionStorage.getItem("unrelated")).toBe("preserve");
  });
  it("subscription failure blocks writes but preserves bytes and unsubscribes on normal unmount", () => {
    const old = getCreationScope(); persistPendingCreation(intent(), old, sessionStorage);
    const bytes = sessionStorage.getItem(creationStorageKey(account));
    mocks.client.mockImplementationOnce(() => { throw new Error("unavailable"); });
    const failed = render(<CreationSessionBoundary accountId={account} />); failed.unmount();
    expect(sessionStorage.getItem(creationStorageKey(account))).toBe(bytes);
    expect(() => persistPendingCreation(intent(), old, sessionStorage)).toThrow();
    const normal = render(<CreationSessionBoundary accountId={account} />); normal.unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
