import { z } from "zod";

export const HIT_DIE_CANONICAL_VERSION = 1 as const;

/** Object keys sorted; arrays retain source order; only finite JSON accepted.
 * Shared by request construction and result validation, with no schema cycle. */
export function canonicalHitDieJson(value: unknown): string {
  const json = z.json().parse(value);
  function ordered(entry: typeof json): typeof json {
    if (Array.isArray(entry)) return entry.map(ordered);
    if (entry !== null && typeof entry === "object") {
      return Object.fromEntries(Object.keys(entry).sort().map(key => [key, ordered(entry[key])]));
    }
    return entry;
  }
  return JSON.stringify(ordered(json));
}

/** Caller validates the request first. Operation ID is the separate lookup key;
 * this exact encoding binds all semantic intent fields to that operation. */
export function serializeHitDieIntent(request: {
  contract_version: number; character_id: string; command: string;
  class_slug: string; expected_revision: string; dependency_fingerprint: string;
}): string {
  return canonicalHitDieJson({ canonical_version: HIT_DIE_CANONICAL_VERSION,
    contract_version: request.contract_version, character_id: request.character_id,
    command: request.command, class_slug: request.class_slug,
    expected_revision: request.expected_revision, dependency_fingerprint: request.dependency_fingerprint });
}
