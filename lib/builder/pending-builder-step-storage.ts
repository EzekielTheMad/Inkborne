import { z } from "zod";
import { parseBuilderStepIntent, type BuilderStepIntent } from "./builder-step-command";
import { PENDING_BUILDER_STEP_PREFIX } from "@/lib/character/pending-command-namespaces";
import { creationLeaseIsCurrent, type CreationScope } from "@/lib/character/pending-creation-storage";
import { creationUUID } from "@/lib/character/pending-creation-schema";

export { PENDING_BUILDER_STEP_PREFIX } from "@/lib/character/pending-command-namespaces";
// Includes the account envelope and the largest bounded narrative request.
const maximumRecordBytes = 262144;
const recordSchema = z.strictObject({ storage_version: z.literal(1), account_id: creationUUID, intent: z.unknown() });
export type PendingBuilderStep = Readonly<{ storage_version: 1; account_id: string; intent: BuilderStepIntent }>;

export function builderStepStorageKey(accountId: string, characterId: string): string {
  if (!creationUUID.safeParse(accountId).success || !creationUUID.safeParse(characterId).success) {
    throw new Error("Invalid builder save scope");
  }
  return PENDING_BUILDER_STEP_PREFIX + accountId + ":" + characterId;
}

/** Unknown or corrupt bytes remain available for recovery; never replace them. */
export function readPendingBuilderStep(accountId: string, characterId: string, storage: Storage): PendingBuilderStep | null {
  const raw = storage.getItem(builderStepStorageKey(accountId, characterId));
  if (raw === null) return null;
  if (new TextEncoder().encode(raw).byteLength > maximumRecordBytes) throw new Error("Unfinished builder save is unavailable");
  const record = recordSchema.safeParse(JSON.parse(raw) as unknown);
  const intent = record.success ? parseBuilderStepIntent(record.data.intent) : null;
  if (!record.success || record.data.account_id !== accountId || !intent || intent.character_id !== characterId) {
    throw new Error("Unfinished builder save is unavailable");
  }
  return Object.freeze({ storage_version: 1, account_id: accountId, intent });
}

/** Store and read back the entire original operation before sending a request. */
export function persistPendingBuilderStep(input: BuilderStepIntent, lease: CreationScope, storage: Storage): PendingBuilderStep {
  if (!creationLeaseIsCurrent(lease, storage)) throw new Error("Sign-in changed");
  const intent = parseBuilderStepIntent(input);
  if (!intent) throw new Error("Invalid builder save");
  const accountId = lease.accountId as string;
  const key = builderStepStorageKey(accountId, intent.character_id);
  if (storage.getItem(key) !== null) throw new Error("An original builder save is already pending");
  const pending: PendingBuilderStep = Object.freeze({ storage_version: 1, account_id: accountId, intent });
  const serialized = JSON.stringify(pending);
  if (new TextEncoder().encode(serialized).byteLength > maximumRecordBytes) throw new Error("Builder save exceeds browser storage bounds");
  storage.setItem(key, serialized);
  if (!creationLeaseIsCurrent(lease, storage) || storage.getItem(key) !== serialized) {
    throw new Error("Builder save could not be retained");
  }
  return pending;
}

/** Only an exact owned receipt may authorize clearing this exact stored record. */
export function clearConfirmedBuilderStep(pending: PendingBuilderStep, lease: CreationScope, storage: Storage): void {
  const key = builderStepStorageKey(pending.account_id, pending.intent.character_id);
  if (!creationLeaseIsCurrent(lease, storage) || lease.accountId !== pending.account_id
    || storage.getItem(key) !== JSON.stringify(pending)) throw new Error("Builder save record changed");
  storage.removeItem(key);
  if (storage.getItem(key) !== null) throw new Error("Builder save record could not clear");
}
