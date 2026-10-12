import { decodeNpcJson } from "./codec";
import { NPC_JSON_LIMITS, type NpcJsonReviewResult } from "./types";

function freeze(value: unknown): void {
  if (!value || typeof value !== "object") return;
  for (const child of Object.values(value)) freeze(child);
  Object.freeze(value);
}
/** Original byte evidence is external to narrative data; this local review has no write authority. */
export async function createNpcJsonReview(bytes: Uint8Array, filename: string, expectedSize = bytes.byteLength): Promise<NpcJsonReviewResult> {
  if (bytes.byteLength < 1 || bytes.byteLength > NPC_JSON_LIMITS.bytes) return { success: false, diagnostics: [{ code: "BYTE_LIMIT", path: "/", message: "JSON file must fit the finite byte limit.", location: { byteOffset: 0, line: 1, column: 1 } }] };
  const original = new Uint8Array(bytes.byteLength); original.set(bytes);
  const decoded = decodeNpcJson(original, filename, { expectedSize });
  if (!decoded.success) return decoded;
  // Native crypto only. Failure cannot become an accepted review with invented hash evidence.
  let sourceSha256: string;
  try {
    const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", original.buffer));
    sourceSha256 = [...digest].map(value => value.toString(16).padStart(2, "0")).join("");
  } catch { return { success: false, diagnostics: [{ code: "HASH_UNAVAILABLE", path: "/", message: "Original-byte hash is unavailable; local review was not accepted.", location: { byteOffset: 0, line: 1, column: 1 } }] }; }
  const result: NpcJsonReviewResult = { success: true, review: { candidate: decoded.candidate,
    provenance: { format: "inkborne_npc_json_v1", safeFilename: decoded.safeFilename, sourceBytes: original.byteLength, sourceSha256, origins: decoded.origins } } };
  freeze(result); return result;
}
