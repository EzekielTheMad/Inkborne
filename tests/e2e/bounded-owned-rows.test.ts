// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { type SupabaseClient } from "@supabase/supabase-js";
import { BoundedManifest } from "@/e2e/bounded/manifest";
import { captureOwnedRows } from "@/e2e/bounded/owned-rows";
let dir: string, manifest: BoundedManifest;
function setup() {
    dir = mkdtempSync(path.join(tmpdir(), "inkborne-audit-unit-"));
    manifest = new BoundedManifest(path.join(dir, "run.jsonl"), randomUUID());
    const attempt = manifest.reserve(randomUUID(), "builder"), id = randomUUID();
    manifest.recordCreated(attempt.attemptId, id);
    const calls: Array<{
        table: string;
        column: string;
        filter: string;
        id: string;
    }> = [];
    let mismatch = false;
    const admin = { from(table: string) {
            return { select(column: string) {
                    return { eq(filter: string, value: string) {
                            calls.push({ table, column, filter, id: value });
                            if (table === "characters")
                                return { single: async () => ({ data: { id, user_id: attempt.ownerId, name: mismatch ? "preexisting" : attempt.name }, error: null }) };
                            return Promise.resolve({ data: [{ [column]: table === "character_dm_notes" ? id : randomUUID() }], error: null });
                        } };
                } };
        } } as unknown as SupabaseClient;
    return { admin, calls, id, file: path.join(dir, "rows.json"), mismatch: () => { mismatch = true; } };
}
afterEach(() => {
    manifest?.close();
    if (dir)
        rmSync(dir, { recursive: true });
});
it("audits exact parent IDs and uses the actual DM-note primary key", async () => {
    const { admin, calls, id, file } = setup();
    await captureOwnedRows(manifest, admin, file);
    expect(calls.every(call => call.id === id)).toBe(true);
    expect(calls.find(call => call.table === "character_dm_notes")).toEqual({ table: "character_dm_notes", column: "character_id", filter: "character_id", id });
    const audit = JSON.parse(readFileSync(file, "utf8"));
    expect(audit.rows).toHaveLength(9);
    expect(audit.rows.find((row: {
        table: string;
    }) => row.table === "character_dm_notes").ids).toEqual([id]);
});
it("rejects a foreign-name parent before auditing children", async () => {
    const { admin, calls, file, mismatch } = setup();
    mismatch();
    await expect(captureOwnedRows(manifest, admin, file)).rejects.toThrow(/identity/);
    expect(calls).toHaveLength(1);
});
