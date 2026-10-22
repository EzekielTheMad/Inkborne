import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseCreationIntent } from "@/lib/character/pending-creation-schema";
import { blockCreationScope, clearConfirmedCreation, creationStorageKey, endCreationSession, getCreationScope,
  persistPendingCreation, readPendingCreation, setCreationAccount } from "@/lib/character/pending-creation-storage";

// Local browser storage/race coverage, not Auth or database acceptance.
const account = "10000000-0000-4000-8000-000000000001";
const other = "10000000-0000-4000-8000-000000000004";
const operation = "10000000-0000-4000-8000-000000000002";
const system = "10000000-0000-4000-8000-000000000005";
function intent() {
  return parseCreationIntent({ contract_version: 1, operation_id: operation, command: "create_character",
    fields: { name: "Elara", system_id: system, campaign_id: null } })!;
}
beforeEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); setCreationAccount(account, sessionStorage); });

describe("immutable pending creation", () => {
  it("persists and restores the complete immutable intent before a request can use it", () => {
    const pending = persistPendingCreation(intent(), getCreationScope(), sessionStorage);
    expect(readPendingCreation(account, sessionStorage)).toEqual(pending);
    expect(Object.isFrozen(pending.intent)).toBe(true);
    expect(Object.isFrozen(pending.intent.fields)).toBe(true);
    setCreationAccount(account, sessionStorage); // Same-account reload/initialization.
    expect(readPendingCreation(account, sessionStorage)).toEqual(pending);
  });
  it("refuses overwriting an uncertain operation and leaves its exact bytes intact", () => {
    const lease = getCreationScope();
    persistPendingCreation(intent(), lease, sessionStorage);
    const original = sessionStorage.getItem(creationStorageKey(account));
    expect(() => persistPendingCreation(intent(), lease, sessionStorage)).toThrow();
    expect(sessionStorage.getItem(creationStorageKey(account))).toBe(original);
  });
  it.each(["{broken", JSON.stringify({ storage_version: 1, account_id: other, intent: intent() }), "x".repeat(33000)])(
    "keeps unreadable data and refuses recovery parsing (%s)", raw => {
      sessionStorage.setItem(creationStorageKey(account), raw);
      expect(() => readPendingCreation(account, sessionStorage)).toThrow();
      expect(sessionStorage.getItem(creationStorageKey(account))).toBe(raw);
    });
  it("confirmed matching operation clears only its own stored record", () => {
    sessionStorage.setItem("unrelated", "preserve");
    const lease = getCreationScope(), pending = persistPendingCreation(intent(), lease, sessionStorage);
    clearConfirmedCreation(pending, lease, sessionStorage);
    expect(readPendingCreation(account, sessionStorage)).toBeNull();
    expect(sessionStorage.getItem("unrelated")).toBe("preserve");
  });
  it("rejects a late clear after the stored original changes", () => {
    const lease = getCreationScope(), pending = persistPendingCreation(intent(), lease, sessionStorage);
    const changed = JSON.stringify({ ...pending, intent: { ...intent(), fields: { ...intent().fields, name: "Changed" } } });
    sessionStorage.setItem(creationStorageKey(account), changed);
    expect(() => clearConfirmedCreation(pending, lease, sessionStorage)).toThrow();
    expect(sessionStorage.getItem(creationStorageKey(account))).toBe(changed);
  });
  it("account transition clears only the namespace and rejects old writes/clears", () => {
    sessionStorage.setItem("unrelated", "preserve");
    const oldLease = getCreationScope(), pending = persistPendingCreation(intent(), oldLease, sessionStorage);
    setCreationAccount(other, sessionStorage);
    expect(sessionStorage.getItem(creationStorageKey(account))).toBeNull();
    expect(() => persistPendingCreation(intent(), oldLease, sessionStorage)).toThrow();
    expect(() => clearConfirmedCreation(pending, oldLease, sessionStorage)).toThrow();
    expect(sessionStorage.getItem("unrelated")).toBe("preserve");
  });
  it("confirmed sign-out rejects late writes even if storage access then fails", () => {
    const oldLease = getCreationScope(), pending = persistPendingCreation(intent(), oldLease, sessionStorage);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("denied"); });
    expect(endCreationSession()).toBe(false);
    expect(getCreationScope().storageReady).toBe(false);
    expect(() => persistPendingCreation(intent(), oldLease, sessionStorage)).toThrow();
    expect(() => clearConfirmedCreation(pending, oldLease, sessionStorage)).toThrow();
  });
  it("an unavailable boundary blocks old leases without deleting the original", () => {
    const lease = getCreationScope(); persistPendingCreation(intent(), lease, sessionStorage);
    const original = sessionStorage.getItem(creationStorageKey(account));
    blockCreationScope();
    expect(() => persistPendingCreation(intent(), lease, sessionStorage)).toThrow();
    expect(sessionStorage.getItem(creationStorageKey(account))).toBe(original);
  });
  it("requires storage write/readback success", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
    expect(() => persistPendingCreation(intent(), getCreationScope(), sessionStorage)).toThrow();
  });
});
