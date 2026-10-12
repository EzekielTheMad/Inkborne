import type { NpcData } from "@/lib/schemas/content-types/npc";

export interface NpcJsonLimits { bytes: number; depth: number; nodes: number; members: number }
export const NPC_JSON_LIMITS: Readonly<NpcJsonLimits> = Object.freeze({ bytes: 131_072, depth: 8, nodes: 2_048, members: 512 });
export type NpcJsonPath = ReadonlyArray<string | number>;
export interface NpcJsonLocation { byteOffset: number; line: number; column: number }
export interface NpcJsonDiagnostic { code: string; path: string; message: string; location: NpcJsonLocation }
export interface NpcJsonCandidate { format: "inkborne-npc"; format_version: 1; name: string; data: NpcData; effects: [] }
export interface NpcJsonOrigin { path: string; location: NpcJsonLocation }
export type NpcJsonDecoded =
  | { success: true; candidate: NpcJsonCandidate; safeFilename: string; origins: NpcJsonOrigin[] }
  | { success: false; diagnostics: NpcJsonDiagnostic[] };
/** Local validation/display evidence, never authorization or a database import receipt. */
export interface NpcJsonReview {
  candidate: NpcJsonCandidate;
  provenance: { format: "inkborne_npc_json_v1"; safeFilename: string; sourceBytes: number; sourceSha256: string; origins: NpcJsonOrigin[] };
}
export type NpcJsonReviewResult = { success: true; review: NpcJsonReview } | { success: false; diagnostics: NpcJsonDiagnostic[] };
