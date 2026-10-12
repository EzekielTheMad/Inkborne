import "server-only";
import { z } from "zod";
import { hitDieRequestSchema, hitDieSnapshotSchema, hitDiePlanResultSchema, MAX_ACTION_REVISION, type HitDieSnapshot } from "./durable-hit-die-schema";
import { canonicalHitDieJson, serializeHitDieIntent } from "./durable-hit-die-canonical";
import { hitDieDependencyFingerprint, planDurableHitDie } from "./durable-hit-die";
import { acceptedRollTotalSchema, hitDieReceiptSchema, nativeHitDieInstantSchema, type HitDieReceipt, type HitDieKernelResponse } from "./durable-hit-die-receipt";

/** Offline transition model only. No RPC/client, RNG, route or persistence. */
export interface HitDieModelStore {
  snapshot: HitDieSnapshot;
  gate: boolean;
  receipts: HitDieReceipt[];
  rolls: { id: string; character_id: string; operation_id: string; roll: HitDieReceipt["roll"] }[];
}
export interface HitDieModelInput {
  actorId: string | null; request: unknown; canonicalIntent: string; snapshot: unknown; candidate: unknown;
  nativeEvaluatedAt: string; nativeAcceptedAt: string; linkedRollId: string;
}

/** Parse only the explicitly constructed millisecond substring through Date.
 * Fractional microseconds remain bigint, including dates before Unix epoch. */
export function nativeInstantMicros(raw: string): bigint {
  nativeHitDieInstantSchema.parse(raw);
  const milliseconds = raw.slice(0, 23) + "Z";
  const millis = Date.parse(milliseconds);
  if (!Number.isFinite(millis) || new Date(millis).toISOString() !== milliseconds) throw new Error("Unsupported native instant");
  return BigInt(millis) * BigInt(1000) + BigInt(raw.slice(23, 26));
}
export function projectNativeInstant(raw: string): string {
  nativeInstantMicros(raw);
  return raw.slice(0, 23) + "Z";
}
function millisExpiry(raw: unknown): string {
  if (typeof raw !== "string" || !/^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(raw)) throw new Error("Unsupported expiry profile");
  nativeInstantMicros(raw.slice(0, -1) + "000Z");
  return raw;
}
export function supportedExpiryDeadline(snapshot: HitDieSnapshot, evaluation: string): string | null {
  const at = nativeInstantMicros(millisExpiry(evaluation).slice(0, -1) + "000Z");
  const effects = snapshot.character.state.active_effects;
  if (effects !== undefined && !Array.isArray(effects)) throw new Error("Unreadable active effects");
  let result: string | null = null;
  for (const entry of effects ?? []) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry) || !("expires_at" in entry)) throw new Error("Unreadable expiry");
    if (entry.expires_at === null) continue;
    const expiry = millisExpiry(entry.expires_at);
    const micros = nativeInstantMicros(expiry.slice(0, -1) + "000Z");
    if (micros > at && (result === null || expiry < result)) result = expiry;
  }
  return result;
}

export function readModelHitDieReceipt(store: HitDieModelStore, actor: string | null, raw: unknown, canonical: string): HitDieKernelResponse {
  const request = hitDieRequestSchema.safeParse(raw);
  if (!request.success || canonical !== serializeHitDieIntent(request.data)) return { status: "invalid" };
  if (!actor || actor !== store.snapshot.character.owner_id || request.data.character_id !== store.snapshot.character.id) return { status: "inaccessible" };
  const receipt = store.receipts.find(row => row.request.character_id === request.data.character_id && row.request.operation_id === request.data.operation_id);
  if (!receipt) return { status: "absent" };
  return receipt.canonical_intent === canonical ? { status: "replayed", receipt: structuredClone(receipt) } : { status: "operation_conflict" };
}

export function simulateHitDieCommit(store: HitDieModelStore, input: HitDieModelInput,
  controls: { fixtureReaderEnabled?: boolean; faultAfter?: "receipt" | "state" | "roll" } = {}): { store: HitDieModelStore; response: HitDieKernelResponse } {
  const refused = (status: "invalid" | "expired" | "unavailable" | "disabled" | "revision_conflict") => ({ store, response: { status } as HitDieKernelResponse });
  const lookup = readModelHitDieReceipt(store, input.actorId, input.request, input.canonicalIntent);
  if (lookup.status !== "absent") return { store, response: lookup };
  if (!store.gate) return refused("disabled");
  if (controls.fixtureReaderEnabled !== true || store.snapshot.character.archived) return refused("unavailable");
  const request = hitDieRequestSchema.parse(input.request);
  if (store.snapshot.character.revision === MAX_ACTION_REVISION) return refused("invalid");
  if (request.expected_revision !== store.snapshot.character.revision) return refused("revision_conflict");
  try {
    const snapshot = hitDieSnapshotSchema.parse(input.snapshot);
    const current = hitDieSnapshotSchema.parse(store.snapshot);
    if (canonicalHitDieJson(snapshot) !== canonicalHitDieJson(current) || hitDieDependencyFingerprint(current) !== request.dependency_fingerprint) return refused("revision_conflict");
    const candidate = hitDiePlanResultSchema.parse(input.candidate);
    if (candidate.status !== "planned" || candidate.canonical_intent !== input.canonicalIntent || canonicalHitDieJson(candidate.request) !== canonicalHitDieJson(request) ||
      !acceptedRollTotalSchema.safeParse(candidate.roll.total).success || !z.uuid().safeParse(input.linkedRollId).success) return refused("invalid");
    const evaluation = projectNativeInstant(input.nativeEvaluatedAt);
    const accepted = nativeInstantMicros(input.nativeAcceptedAt);
    const checked = nativeInstantMicros(millisExpiry(candidate.acceptance_checked_at).slice(0, -1) + "000Z");
    if (evaluation !== candidate.evaluated_at || accepted < nativeInstantMicros(input.nativeEvaluatedAt) || checked > accepted) return refused("invalid");
    const deadline = supportedExpiryDeadline(current, evaluation);
    if (deadline !== candidate.valid_until) return refused("invalid");
    if (deadline !== null && accepted >= nativeInstantMicros(deadline.slice(0, -1) + "000Z")) return refused("expired");
    // Recompute through the actual pure planner. Fixture acceptance time uses
    // evaluation; the separate native comparison above closes sub-ms expiry.
    const recomputed = planDurableHitDie(current, request, { enabled: true, evaluationInstant: evaluation,
      acceptanceInstant: candidate.acceptance_checked_at, acceptedDieFace: candidate.roll.groups[0].rolls[0] });
    if (canonicalHitDieJson(recomputed) !== canonicalHitDieJson(candidate)) return refused("invalid");
    const receipt = hitDieReceiptSchema.parse({ contract_version: 1, canonical_version: 1, request, canonical_intent: input.canonicalIntent,
      verified_actor_id: input.actorId, dependency_snapshot: current, dependency_fingerprint: request.dependency_fingerprint,
      before_revision: current.character.revision, after_revision: (BigInt(current.character.revision) + BigInt(1)).toString(), linked_roll_id: input.linkedRollId,
      roll: candidate.roll, patch: candidate.patch, evaluated_at: evaluation, native_evaluated_at: input.nativeEvaluatedAt,
      accepted_at: input.nativeAcceptedAt, valid_until: deadline });
    const next = structuredClone(store);
    next.receipts.push(receipt);
    if (controls.faultAfter === "receipt") throw new ModelFault();
    next.snapshot.character.state = { ...next.snapshot.character.state, ...candidate.patch };
    next.snapshot.character.revision = receipt.after_revision;
    if (controls.faultAfter === "state") throw new ModelFault();
    if (next.rolls.some(roll => roll.id === input.linkedRollId || (roll.character_id === request.character_id && roll.operation_id === request.operation_id))) throw new ModelFault();
    next.rolls.push({ id: input.linkedRollId, character_id: request.character_id, operation_id: request.operation_id, roll: structuredClone(candidate.roll) });
    if (controls.faultAfter === "roll") throw new ModelFault();
    return { store: next, response: { status: "committed", receipt: structuredClone(receipt) } };
  } catch (error) {
    if (error instanceof ModelFault) throw error;
    return refused("invalid");
  }
}
class ModelFault extends Error { constructor() { super("Injected model fault; no transition published"); } }
