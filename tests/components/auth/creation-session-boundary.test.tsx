import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({ client: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(), getUser: vi.fn() }));
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
  mocks.getUser.mockResolvedValue({ data: { user: { id: account } }, error: null });
  mocks.client.mockReturnValue({ auth: { onAuthStateChange: mocks.subscribe, getUser: mocks.getUser } });
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
    expect(mocks.getUser).not.toHaveBeenCalled();
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
  it("activates a mounted server-action null→account transition only after a fresh matching browser lookup", async () => {
    setCreationAccount(null, sessionStorage);
    let finish!: (value: unknown) => void;
    mocks.getUser.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const boundary = render(<CreationSessionBoundary accountId={null} />);
    const old = getCreationScope();
    boundary.rerender(<CreationSessionBoundary accountId={account} />);
    expect(getCreationScope().accountId).toBeNull();
    expect(getCreationScope().storageReady).toBe(false);
    expect(getCreationScope().epoch).toBeGreaterThan(old.epoch);
    expect(mocks.getUser).toHaveBeenCalledExactlyOnceWith();
    await act(async () => { finish({ data: { user: { id: account } }, error: null }); });
    expect(getCreationScope()).toMatchObject({ accountId: account, storageReady: true });
    const pending = persistPendingCreation(intent(), getCreationScope(), sessionStorage);
    expect(readPendingCreation(account, sessionStorage)).toEqual(pending);
  });
  it("same-account server refresh keeps the original lease and does not issue a reactivation lookup", () => {
    const lease = getCreationScope(), pending = persistPendingCreation(intent(), lease, sessionStorage);
    const boundary = render(<CreationSessionBoundary accountId={account} />);
    boundary.rerender(<CreationSessionBoundary accountId={account} />);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(getCreationScope().epoch).toBe(lease.epoch);
    expect(readPendingCreation(account, sessionStorage)).toEqual(pending);
  });
  it("preserves an established SDK sign-in lease when its server prop arrives afterward", () => {
    setCreationAccount(null, sessionStorage);
    const boundary = render(<CreationSessionBoundary accountId={null} />);
    act(() => event("SIGNED_IN", sessionFor(account)));
    const lease = getCreationScope(), pending = persistPendingCreation(intent(), lease, sessionStorage);
    boundary.rerender(<CreationSessionBoundary accountId={account} />);
    expect(mocks.getUser).not.toHaveBeenCalled(); expect(getCreationScope().epoch).toBe(lease.epoch);
    expect(readPendingCreation(account, sessionStorage)).toEqual(pending);
  });
  it.each(["mismatch", "error", "throw"])("keeps pending bytes and the lease blocked after a new server prop lookup %s", async mode => {
    const lease = getCreationScope(), pending = persistPendingCreation(intent(), lease, sessionStorage);
    if (mode === "throw") mocks.getUser.mockRejectedValue(Error("fixture-private"));
    else mocks.getUser.mockResolvedValue({ data: { user: { id: mode === "mismatch" ? account : other } },
      error: mode === "error" ? { message: "fixture-private" } : null });
    const boundary = render(<CreationSessionBoundary accountId={account} />);
    await act(async () => { boundary.rerender(<CreationSessionBoundary accountId={other} />); });
    expect(getCreationScope()).toMatchObject({ accountId: null, storageReady: false });
    expect(readPendingCreation(account, sessionStorage)).toEqual(pending);
    expect(() => persistPendingCreation(intent(), lease, sessionStorage)).toThrow();
  });
  it.each(["signout", "other-account", "unmount"])("disqualifies a late matching lookup after %s", async change => {
    setCreationAccount(null, sessionStorage);
    let finish!: (value: unknown) => void;
    mocks.getUser.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const boundary = render(<CreationSessionBoundary accountId={null} />);
    boundary.rerender(<CreationSessionBoundary accountId={account} />);
    if (change === "unmount") boundary.unmount();
    else act(() => { if (change === "signout") event("SIGNED_OUT", null); else event("SIGNED_IN", sessionFor(other)); });
    const afterChange = getCreationScope();
    await act(async () => { finish({ data: { user: { id: account } }, error: null }); });
    expect(getCreationScope()).toEqual(afterChange);
    expect(getCreationScope().accountId).not.toBe(account);
  });
  it("positive INITIAL_SESSION and TOKEN_REFRESHED alone cannot revive a confirmed signed-out lease", () => {
    const boundary = render(<CreationSessionBoundary accountId={account} />);
    act(() => event("SIGNED_OUT", null));
    act(() => event("INITIAL_SESSION", sessionFor(account)));
    act(() => event("TOKEN_REFRESHED", sessionFor(account)));
    boundary.rerender(<CreationSessionBoundary accountId={account} />);
    expect(getCreationScope().accountId).toBeNull(); expect(mocks.getUser).not.toHaveBeenCalled();
  });
});
