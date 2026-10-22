import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseFirstClassIntent } from "@/lib/character/first-class-command-schema";
import { clearConfirmedFirstClass, firstClassStorageKey, persistPendingFirstClass, readPendingFirstClass } from "@/lib/character/pending-first-class-storage";
import { blockCreationScope, endCreationSession, getCreationScope, setCreationAccount } from "@/lib/character/pending-creation-storage";

// Local persistence and races only; this does not prove Auth or database saves.
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const account = id(1), target = id(2), operation = id(3), content = id(4), other = id(5);
const intent = (characterId = target) => parseFirstClassIntent({ contract_version: 1, command: "add_class",
  character_id: characterId, operation_id: operation, expected_action_revision: "0", expected_class_revision: "0",
  fields: { content_id: content, content_version: 1, subclass: null } })!;

beforeEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); setCreationAccount(account, sessionStorage); });

describe("unfinished first-class saves", () => {
  it("retains the complete original operation and class version across same-account initialization", () => {
    const pending = persistPendingFirstClass(intent(), getCreationScope(), sessionStorage);
    const bytes = sessionStorage.getItem(firstClassStorageKey(account, target));
    setCreationAccount(account, sessionStorage);
    expect(readPendingFirstClass(account, target, sessionStorage)).toEqual(pending);
    expect(sessionStorage.getItem(firstClassStorageKey(account, target))).toBe(bytes);
    expect(Object.isFrozen(pending.intent)).toBe(true);
    expect(Object.isFrozen(pending.intent.fields)).toBe(true);
  });

  it("does not replace any existing operation, including a corrupt one", () => {
    const key = firstClassStorageKey(account, target);
    for (const bytes of ["{corrupt", JSON.stringify({ storage_version: 1, account_id: account, intent: intent() })]) {
      sessionStorage.setItem(key, bytes);
      expect(() => persistPendingFirstClass(intent(), getCreationScope(), sessionStorage)).toThrow();
      expect(sessionStorage.getItem(key)).toBe(bytes);
    }
  });

  it.each([
    "{broken", "x".repeat(33000),
    JSON.stringify({ storage_version: 1, account_id: other, intent: intent() }),
    JSON.stringify({ storage_version: 1, account_id: account, intent: intent(other) }),
    JSON.stringify({ storage_version: 2, account_id: account, intent: intent() }),
    JSON.stringify({ storage_version: 1, account_id: account, intent: { ...intent(), expected_action_revision: "1" } }),
  ])("blocks unreadable or mismatched records and preserves their bytes", bytes => {
    const key = firstClassStorageKey(account, target); sessionStorage.setItem(key, bytes);
    expect(() => readPendingFirstClass(account, target, sessionStorage)).toThrow();
    expect(sessionStorage.getItem(key)).toBe(bytes);
  });

  it("keeps separate characters pending and clears only the confirmed target", () => {
    const lease = getCreationScope();
    const first = persistPendingFirstClass(intent(), lease, sessionStorage);
    const second = persistPendingFirstClass(intent(other), lease, sessionStorage);
    sessionStorage.setItem("unrelated", "retain");
    clearConfirmedFirstClass(first, lease, sessionStorage);
    expect(readPendingFirstClass(account, target, sessionStorage)).toBeNull();
    expect(readPendingFirstClass(account, other, sessionStorage)).toEqual(second);
    expect(sessionStorage.getItem("unrelated")).toBe("retain");
  });

  it("invalidates all old callbacks before account-transition cleanup", () => {
    const lease = getCreationScope(), pending = persistPendingFirstClass(intent(), lease, sessionStorage);
    sessionStorage.setItem("unrelated", "retain");
    setCreationAccount(other, sessionStorage);
    expect(readPendingFirstClass(account, target, sessionStorage)).toBeNull();
    expect(() => persistPendingFirstClass(intent(), lease, sessionStorage)).toThrow();
    expect(() => clearConfirmedFirstClass(pending, lease, sessionStorage)).toThrow();
    expect(sessionStorage.getItem("unrelated")).toBe("retain");
  });

  it("confirmed signout clears every character save and invalidates the old lease", () => {
    const lease = getCreationScope(), pending = persistPendingFirstClass(intent(), lease, sessionStorage);
    persistPendingFirstClass(intent(other), lease, sessionStorage);
    expect(endCreationSession()).toBe(true);
    expect(readPendingFirstClass(account, target, sessionStorage)).toBeNull();
    expect(readPendingFirstClass(account, other, sessionStorage)).toBeNull();
    expect(() => clearConfirmedFirstClass(pending, lease, sessionStorage)).toThrow();
  });

  it("keeps uncertain bytes while an unknown account boundary blocks new writes", () => {
    const lease = getCreationScope(), pending = persistPendingFirstClass(intent(), lease, sessionStorage);
    const key = firstClassStorageKey(account, target), bytes = sessionStorage.getItem(key);
    blockCreationScope();
    expect(() => clearConfirmedFirstClass(pending, lease, sessionStorage)).toThrow();
    expect(() => persistPendingFirstClass(intent(other), lease, sessionStorage)).toThrow();
    expect(sessionStorage.getItem(key)).toBe(bytes);
  });

  it("cannot clear a substituted original, even under the same operation ID", () => {
    const lease = getCreationScope(), pending = persistPendingFirstClass(intent(), lease, sessionStorage);
    const key = firstClassStorageKey(account, target);
    const changed = JSON.stringify({ ...pending, intent: { ...pending.intent, fields: { ...pending.intent.fields, content_version: 2 } } });
    sessionStorage.setItem(key, changed);
    expect(() => clearConfirmedFirstClass(pending, lease, sessionStorage)).toThrow();
    expect(sessionStorage.getItem(key)).toBe(changed);
  });

  it("requires successful durable write and exact readback", () => {
    const lease = getCreationScope();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
    expect(() => persistPendingFirstClass(intent(), lease, sessionStorage)).toThrow();
    expect(readPendingFirstClass(account, target, sessionStorage)).toBeNull();
  });

  it("failed cleanup still blocks all old callbacks", () => {
    const lease = getCreationScope(), pending = persistPendingFirstClass(intent(), lease, sessionStorage);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("denied"); });
    expect(endCreationSession()).toBe(false);
    expect(() => clearConfirmedFirstClass(pending, lease, sessionStorage)).toThrow();
    expect(() => persistPendingFirstClass(intent(other), lease, sessionStorage)).toThrow();
  });
});
