// Browser housekeeping only. These prefixes do not establish authentication.
export const PENDING_CREATION_PREFIX = "inkborne:pending-creation:v1:";
export const PENDING_FIRST_CLASS_PREFIX = "inkborne:pending-first-class:v1:";

export function pendingCommandBelongsToAccount(key: string, accountId: string): boolean {
  return key === PENDING_CREATION_PREFIX + accountId
    || key.startsWith(PENDING_FIRST_CLASS_PREFIX + accountId + ":");
}

export function isPendingCommandKey(key: string): boolean {
  return key.startsWith(PENDING_CREATION_PREFIX) || key.startsWith(PENDING_FIRST_CLASS_PREFIX);
}
