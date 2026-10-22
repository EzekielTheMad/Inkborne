import { z } from "zod";
import { creationUUID, parseCreationIntent, type CreationIntent } from "./pending-creation-schema";
import { isPendingCommandKey, pendingCommandBelongsToAccount, PENDING_CREATION_PREFIX } from "./pending-command-namespaces";

export { PENDING_CREATION_PREFIX } from "./pending-command-namespaces";
const accountKey = "inkborne:creation-account:v1";
const recordSchema = z.strictObject({ storage_version: z.literal(1), account_id: creationUUID, intent: z.unknown() });
export type PendingCreation = Readonly<{ storage_version: 1; account_id: string; intent: CreationIntent }>;
export type CreationScope = Readonly<{ accountId: string | null | undefined; epoch: number; storageReady: boolean }>;
const initialScope: CreationScope = Object.freeze({ accountId: undefined, epoch: 0, storageReady: false });
let scope = initialScope;
const listeners = new Set<() => void>();

export const creationStorageKey = (accountId: string) => PENDING_CREATION_PREFIX + accountId;
export const getCreationScope = () => scope;
export const getServerCreationScope = () => initialScope;
export function subscribeCreationScope(listener: () => void) {
  listeners.add(listener); return () => { listeners.delete(listener); };
}
function announce(next: CreationScope) {
  scope = Object.freeze(next);
  for (const listener of listeners) listener();
}
export function blockCreationScope(): void {
  announce({ accountId: null, epoch: scope.epoch + 1, storageReady: false });
}
function keys(storage: Storage): string[] {
  if (storage.length > 4096) throw new Error("Creation storage unavailable");
  const result: string[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key && isPendingCommandKey(key)) result.push(key);
  }
  return result;
}

// Only the authenticated account boundary/auth events activate a scope.
// Invalidate the in-memory lease BEFORE touching storage, including on failure.
export function setCreationAccount(accountId: string | null, storage: Storage): boolean {
  const epoch = scope.epoch + 1;
  announce({ accountId: null, epoch, storageReady: false });
  try {
    if (accountId !== null && !creationUUID.safeParse(accountId).success) throw new Error("Invalid account");
    const previous = storage.getItem(accountKey);
    for (const key of keys(storage)) {
      if (accountId === null || (previous !== null && previous !== accountId) || !pendingCommandBelongsToAccount(key, accountId)) {
        storage.removeItem(key);
      }
    }
    if (accountId === null) storage.removeItem(accountKey);
    else storage.setItem(accountKey, accountId);
    announce({ accountId, epoch, storageReady: true });
    return true;
  } catch { return false; }
}

export function endCreationSession(): boolean {
  // Even denied storage access must prevent every pending callback/new write.
  blockCreationScope();
  try { return setCreationAccount(null, window.sessionStorage); } catch { return false; }
}

export function creationLeaseIsCurrent(lease: CreationScope, storage: Storage): boolean {
  return lease.storageReady && lease.accountId !== null && lease.accountId !== undefined
    && scope.accountId === lease.accountId && scope.epoch === lease.epoch && scope.storageReady
    && storage.getItem(accountKey) === lease.accountId;
}

export function readPendingCreation(accountId: string, storage: Storage): PendingCreation | null {
  const raw = storage.getItem(creationStorageKey(accountId));
  if (raw === null) return null;
  if (raw.length > 32768) throw new Error("Unfinished creation record is unavailable");
  const record = recordSchema.safeParse(JSON.parse(raw) as unknown);
  const intent = record.success ? parseCreationIntent(record.data.intent) : null;
  if (!record.success || record.data.account_id !== accountId || !intent) {
    throw new Error("Unfinished creation record is unavailable");
  }
  return Object.freeze({ storage_version: 1, account_id: accountId, intent });
}

export function persistPendingCreation(intent: CreationIntent, lease: CreationScope, storage: Storage): PendingCreation {
  if (!creationLeaseIsCurrent(lease, storage)) throw new Error("Sign-in changed");
  const accountId = lease.accountId as string;
  if (storage.getItem(creationStorageKey(accountId)) !== null) throw new Error("An original request is already pending");
  const parsed = parseCreationIntent(intent);
  if (!parsed) throw new Error("Invalid creation intent");
  const pending: PendingCreation = Object.freeze({ storage_version: 1, account_id: accountId, intent: parsed });
  const serialized = JSON.stringify(pending);
  storage.setItem(creationStorageKey(accountId), serialized);
  if (!creationLeaseIsCurrent(lease, storage) || storage.getItem(creationStorageKey(accountId)) !== serialized) {
    throw new Error("Creation request could not be retained");
  }
  return pending;
}

// Call only after a strict confirmed result matches account + operation.
export function clearConfirmedCreation(pending: PendingCreation, lease: CreationScope, storage: Storage): void {
  if (!creationLeaseIsCurrent(lease, storage) || lease.accountId !== pending.account_id
    || storage.getItem(creationStorageKey(pending.account_id)) !== JSON.stringify(pending)) throw new Error("Creation record changed");
  storage.removeItem(creationStorageKey(pending.account_id));
  if (storage.getItem(creationStorageKey(pending.account_id)) !== null) throw new Error("Creation record could not clear");
}
