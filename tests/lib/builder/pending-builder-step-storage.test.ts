import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseBuilderStepIntent } from "@/lib/builder/builder-step-command";
import { builderStepStorageKey, clearConfirmedBuilderStep, persistPendingBuilderStep,
  readPendingBuilderStep } from "@/lib/builder/pending-builder-step-storage";
import { blockCreationScope, endCreationSession, getCreationScope, setCreationAccount } from "@/lib/character/pending-creation-storage";

// Browser persistence and scope races; no native save/Auth acceptance is implied.
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const account = id(1), target = id(2), operation = id(3), other = id(4);
const intent = (characterId = target) => parseBuilderStepIntent({ contract_version: 1, operation_id: operation,
  character_id: characterId, command: "save_hp_roll", fields: { class_slug: "fighter", level: 2, method: "rolled", value: null } })!;
beforeEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); setCreationAccount(account, sessionStorage); });

describe("retained ordinary builder saves", () => {
  it("retains the complete original across same-account initialization", () => {
    const pending = persistPendingBuilderStep(intent(), getCreationScope(), sessionStorage);
    const key = builderStepStorageKey(account, target), bytes = sessionStorage.getItem(key);
    setCreationAccount(account, sessionStorage);
    expect(readPendingBuilderStep(account, target, sessionStorage)).toEqual(pending);
    expect(sessionStorage.getItem(key)).toBe(bytes);
  });

  it("keeps a valid maximum narrative over the first-class 32KiB limit", () => {
    const original = parseBuilderStepIntent({ ...intent(), command: "background_narrative",
      fields: { key: "bonds", values: Array.from({ length: 20 }, () => "字".repeat(2000)) } })!;
    const pending = persistPendingBuilderStep(original, getCreationScope(), sessionStorage);
    expect(readPendingBuilderStep(account, target, sessionStorage)).toEqual(pending);
    expect(sessionStorage.getItem(builderStepStorageKey(account, target))!.length).toBeGreaterThan(32768);
  });

  it.each(["{broken", "x".repeat(270000),
    JSON.stringify({ storage_version: 1, account_id: other, intent: intent() }),
    JSON.stringify({ storage_version: 1, account_id: account, intent: intent(other) }),
    JSON.stringify({ storage_version: 2, account_id: account, intent: intent() }),
    JSON.stringify({ storage_version: 1, account_id: account, intent: { ...intent(), token: "unknown" } }),
  ])("retains unknown/corrupt records and forbids replacement", bytes => {
    const key = builderStepStorageKey(account, target); sessionStorage.setItem(key, bytes);
    expect(() => readPendingBuilderStep(account, target, sessionStorage)).toThrow();
    expect(() => persistPendingBuilderStep(intent(), getCreationScope(), sessionStorage)).toThrow();
    expect(sessionStorage.getItem(key)).toBe(bytes);
  });

  it("never replaces a pending valid original or another character's operation", () => {
    const lease = getCreationScope(), pending = persistPendingBuilderStep(intent(), lease, sessionStorage);
    const next = persistPendingBuilderStep(intent(other), lease, sessionStorage);
    expect(() => persistPendingBuilderStep({ ...intent(), operation_id: other }, lease, sessionStorage)).toThrow();
    clearConfirmedBuilderStep(pending, lease, sessionStorage);
    expect(readPendingBuilderStep(account, target, sessionStorage)).toBeNull();
    expect(readPendingBuilderStep(account, other, sessionStorage)).toEqual(next);
  });

  it.each(["signout", "account"])("cleans every builder original after %s and rejects old callbacks", change => {
    const lease = getCreationScope(), pending = persistPendingBuilderStep(intent(), lease, sessionStorage);
    persistPendingBuilderStep(intent(other), lease, sessionStorage); sessionStorage.setItem("unrelated", "retain");
    if (change === "signout") expect(endCreationSession()).toBe(true);
    else setCreationAccount(other, sessionStorage);
    expect(readPendingBuilderStep(account, target, sessionStorage)).toBeNull();
    expect(readPendingBuilderStep(account, other, sessionStorage)).toBeNull();
    expect(() => clearConfirmedBuilderStep(pending, lease, sessionStorage)).toThrow();
    expect(() => persistPendingBuilderStep(intent(), lease, sessionStorage)).toThrow();
    expect(sessionStorage.getItem("unrelated")).toBe("retain");
  });

  it("blocks old leases without erasing uncertain records when the account is unknown", () => {
    const lease = getCreationScope(), pending = persistPendingBuilderStep(intent(), lease, sessionStorage);
    blockCreationScope();
    expect(() => clearConfirmedBuilderStep(pending, lease, sessionStorage)).toThrow();
    expect(readPendingBuilderStep(account, target, sessionStorage)).toEqual(pending);
  });

  it("cannot clear substituted fields under the same operation", () => {
    const lease = getCreationScope(), pending = persistPendingBuilderStep(intent(), lease, sessionStorage);
    const key = builderStepStorageKey(account, target), bytes = JSON.stringify({ ...pending,
      intent: { ...intent(), fields: { ...intent().fields, level: 3 } } });
    sessionStorage.setItem(key, bytes);
    expect(() => clearConfirmedBuilderStep(pending, lease, sessionStorage)).toThrow();
    expect(sessionStorage.getItem(key)).toBe(bytes);
  });

  it("requires durable write/readback and invalidates callbacks even if sign-out cleanup fails", () => {
    const lease = getCreationScope();
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
    expect(() => persistPendingBuilderStep(intent(), lease, sessionStorage)).toThrow(); write.mockRestore();
    const pending = persistPendingBuilderStep(intent(), lease, sessionStorage);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw Error("denied"); });
    expect(endCreationSession()).toBe(false);
    expect(() => clearConfirmedBuilderStep(pending, lease, sessionStorage)).toThrow();
    expect(readPendingBuilderStep(account, target, sessionStorage)).toEqual(pending);
  });
});
