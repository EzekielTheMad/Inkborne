import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

export const hashParentEvidence = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export function readParentEvidence(file: string, base: string) {
  const lexical = path.resolve(file), actual = fs.realpathSync(lexical), allowed = fs.realpathSync(base);
  for (const candidate of [lexical, actual]) {
    assert(candidate.startsWith(allowed + path.sep), "public evidence escaped its root");
    assert(!candidate.split(/[\\/]/).some(part => /private|credential|secret/i.test(part)), "public evidence required");
  }
  assert(fs.statSync(actual).isFile() && fs.statSync(actual).size <= 32 * 1024 * 1024, "finite public evidence file required"); const bytes = fs.readFileSync(actual);
  return { path: actual, sha256: hashParentEvidence(bytes), data: JSON.parse(bytes.toString("utf8")) as unknown };
}
export type ParentFile = ReturnType<typeof readParentEvidence>;
export function parentFileLink(file: ParentFile) { return { path: file.path, sha256: file.sha256 }; }
export function readParentLink(link: { path: string; sha256: string }, base: string) {
  const file = readParentEvidence(link.path, base); assert.equal(file.sha256, link.sha256); return file;
}
export function assertParentFilesUnchanged(files: ParentFile[]) {
  for (const file of files) assert.equal(hashParentEvidence(fs.readFileSync(file.path)), file.sha256, "evidence changed during recording");
}
export type ParentRuntime = {
  engineId: string; databaseId: string; runId: string; journalPath: string;
  verify: () => void; json: (query: string, options?: { role?: string; variables?: string[]; timeout?: number }) => unknown;
  closure: () => unknown; cleanup: () => Promise<{ allCapturedBackendsGone: boolean; allClientsExited: boolean }>; finish: () => void;
};
// Reuse the already reviewed finite transport rather than create another native
// runner. Exact hashes make external source drift a refusal before any import.
export async function openParentEvidenceRuntime(runtimeDirectory: string) {
  const expected = {
    "parent-admission-sessions-20261025.mjs": "3706b2521365766b7de62504fed312e020c5e7e58b1f177cfceab808eb49c639",
    "parent-admission-closure-20261025.sql": "295e3a374a1b34625c1da1b51ea51f1b60cb0edabe5623906cb86fca220cbf6b",
  };
  for (const [file, digest] of Object.entries(expected)) assert.equal(hashParentEvidence(fs.readFileSync(path.join(runtimeDirectory, file))), digest, "reviewed native transport changed");
  const helper = await import(pathToFileURL(path.join(runtimeDirectory, "parent-admission-sessions-20261025.mjs")).href) as {
    createRuntime: (purpose: "parent-native") => ParentRuntime; assertClosure: (value: unknown, parentInstalled: boolean) => void;
    assertParentProfiles: (value: unknown) => void;
  };
  return { runtime: helper.createRuntime("parent-native"), assertClosure: helper.assertClosure, assertParentProfiles: helper.assertParentProfiles, expected };
}
