import { type BoundedManifest } from "./manifest";
export interface CleanupAdapter {
    lookup(id: string): Promise<{
        id: string;
        user_id: string;
        name: string;
    } | null>;
    deleteExact(row: {
        id: string;
        ownerId: string;
        name: string;
    }): Promise<void>;
    verifyAbsent(id: string): Promise<void>;
}
/** Plan and deletion share identity validation. No prefix query and no automatic teardown. */
export async function cleanupRun(manifest: BoundedManifest, approvedOwnerIds: string[], confirmRunId: string, execute: boolean, adapter: CleanupAdapter) {
    const scope = manifest.cleanupScope(confirmRunId);
    if (scope.some(row => !approvedOwnerIds.includes(row.ownerId)))
        throw new Error("Manifest contains an owner outside the two approved accounts");
    // Check the whole proposed scope before the first deletion.
    for (const row of scope) {
        const actual = await adapter.lookup(row.id);
        if (actual && (actual.id !== row.id || actual.user_id !== row.ownerId || actual.name !== row.name))
            throw new Error("Exact-ID cleanup identity check failed; no deletion attempted");
    }
    if (execute) {
        for (const row of scope) {
            const actual = await adapter.lookup(row.id);
            if (actual) {
                if (actual.id !== row.id || actual.user_id !== row.ownerId || actual.name !== row.name)
                    throw new Error("Exact-ID cleanup identity changed; stop and reconcile");
                await adapter.deleteExact(row);
            }
            await adapter.verifyAbsent(row.id);
            manifest.recordCleaned(row.id);
        }
    }
    return scope.map(row => row.id);
}
