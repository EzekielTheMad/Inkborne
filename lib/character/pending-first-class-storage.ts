import { z } from "zod";
import { parseFirstClassIntent, type FirstClassIntent } from "./first-class-command-schema";
import { PENDING_FIRST_CLASS_PREFIX } from "./pending-command-namespaces";
import { creationLeaseIsCurrent, type CreationScope } from "./pending-creation-storage";
import { creationUUID } from "./pending-creation-schema";

export { PENDING_FIRST_CLASS_PREFIX } from "./pending-command-namespaces";
const recordSchema = z.strictObject({ storage_version: z.literal(1), account_id: creationUUID, intent: z.unknown() });
export type PendingFirstClass = Readonly<{ storage_version: 1; account_id: string; intent: FirstClassIntent }>;

export function firstClassStorageKey(accountId: string, characterId: string): string {
  if (!creationUUID.safeParse(accountId).success || !creationUUID.safeParse(characterId).success) {
    throw new Error("Invalid class save scope");
  }
  return PENDING_FIRST_CLASS_PREFIX + accountId + ":" + characterId;
}

/** Retain corrupt/unknown records for recovery; never silently replace them. */
export function readPendingFirstClass(accountId: string, characterId: string, storage: Storage): PendingFirstClass | null {
  const raw = storage.getItem(firstClassStorageKey(accountId, characterId));
  if (raw === null) return null;
  if (raw.length > 32768) throw new Error("Unfinished class save is unavailable");
  const record = recordSchema.safeParse(JSON.parse(raw) as unknown);
  const intent = record.success ? parseFirstClassIntent(record.data.intent) : null;
  if (!record.success || record.data.account_id !== accountId || !intent || intent.character_id !== characterId) {
    throw new Error("Unfinished class save is unavailable");
  }
  return Object.freeze({ storage_version: 1, account_id: accountId, intent });
}

/** Persist and read back the complete original intent BEFORE sending any save. */
export function persistPendingFirstClass(input: FirstClassIntent, lease: CreationScope, storage: Storage): PendingFirstClass {
  if (!creationLeaseIsCurrent(lease, storage)) throw new Error("Sign-in changed");
  const intent = parseFirstClassIntent(input);
  if (!intent) throw new Error("Invalid class save");
  const accountId = lease.accountId as string;
  const key = firstClassStorageKey(accountId, intent.character_id);
  if (storage.getItem(key) !== null) throw new Error("An original class save is already pending");
  const pending: PendingFirstClass = Object.freeze({ storage_version: 1, account_id: accountId, intent });
  const serialized = JSON.stringify(pending);
  storage.setItem(key, serialized);
  if (!creationLeaseIsCurrent(lease, storage) || storage.getItem(key) !== serialized) {
    throw new Error("Class save could not be retained");
  }
  return pending;
}

/** Call only after a strict confirmed receipt matches account, target and intent. */
export function clearConfirmedFirstClass(pending: PendingFirstClass, lease: CreationScope, storage: Storage): void {
  const key = firstClassStorageKey(pending.account_id, pending.intent.character_id);
  if (!creationLeaseIsCurrent(lease, storage) || lease.accountId !== pending.account_id
    || storage.getItem(key) !== JSON.stringify(pending)) throw new Error("Class save record changed");
  storage.removeItem(key);
  if (storage.getItem(key) !== null) throw new Error("Class save record could not clear");
}
