// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { BoundedManifest } from "@/e2e/bounded/manifest";
import { cleanupRun, type CleanupAdapter } from "@/e2e/bounded/cleanup";
let dir: string, manifest: BoundedManifest;
function setup() {
    dir = mkdtempSync(path.join(tmpdir(), "inkborne-cleanup-unit-"));
    manifest = new BoundedManifest(path.join(dir, "run.jsonl"), randomUUID());
    const ownerId = randomUUID(), attempt = manifest.reserve(ownerId, "builder"), id = randomUUID();
    manifest.recordCreated(attempt.attemptId, id);
    const row = { id, user_id: ownerId, name: attempt.name };
    const adapter: CleanupAdapter = { lookup: vi.fn(async () => row), deleteExact: vi.fn(async () => { }), verifyAbsent: vi.fn(async () => { }) };
    return { ownerId, id, row, adapter };
}
afterEach(() => {
    manifest?.close();
    if (dir)
        rmSync(dir, { recursive: true });
});
it("plans only exact recorded IDs without deletion or marking cleanup complete", async () => {
    const { ownerId, id, adapter } = setup();
    expect(await cleanupRun(manifest, [ownerId], manifest.runId, false, adapter)).toEqual([id]);
    expect(adapter.lookup).toHaveBeenCalledWith(id);
    expect(adapter.deleteExact).not.toHaveBeenCalled();
    expect(manifest.cleanupScope(manifest.runId)).toHaveLength(1);
});
it("rejects a preexisting-row identity mismatch before deletion", async () => {
    const { ownerId, row, adapter } = setup();
    adapter.lookup = vi.fn(async () => ({ ...row, name: "preexisting" }));
    await expect(cleanupRun(manifest, [ownerId], manifest.runId, true, adapter)).rejects.toThrow(/identity/);
    expect(adapter.deleteExact).not.toHaveBeenCalled();
});
it("requires run confirmation and approved account ownership", async () => {
    const { ownerId, adapter } = setup();
    await expect(cleanupRun(manifest, [ownerId], randomUUID(), true, adapter)).rejects.toThrow(/exact run/);
    await expect(cleanupRun(manifest, [randomUUID()], manifest.runId, true, adapter)).rejects.toThrow(/owner outside/);
    expect(adapter.lookup).not.toHaveBeenCalled();
});
it("preserves an ambiguous deletion for exact-ID reconciliation and checks children on retry", async () => {
    const { ownerId, adapter } = setup();
    adapter.deleteExact = vi.fn(async () => { throw new Error("response lost"); });
    await expect(cleanupRun(manifest, [ownerId], manifest.runId, true, adapter)).rejects.toThrow(/response lost/);
    expect(manifest.cleanupScope(manifest.runId)).toHaveLength(1);
    adapter.lookup = vi.fn(async () => null);
    await cleanupRun(manifest, [ownerId], manifest.runId, true, adapter);
    expect(adapter.verifyAbsent).toHaveBeenCalledOnce();
    expect(manifest.cleanupScope(manifest.runId)).toHaveLength(0);
});
it("does not record cleanup success when child verification fails", async () => {
    const { ownerId, adapter } = setup();
    adapter.verifyAbsent = vi.fn(async () => { throw new Error("child remains"); });
    await expect(cleanupRun(manifest, [ownerId], manifest.runId, true, adapter)).rejects.toThrow(/child remains/);
    expect(manifest.cleanupScope(manifest.runId)).toHaveLength(1);
});
