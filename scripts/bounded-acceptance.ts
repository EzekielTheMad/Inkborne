import { BoundedManifest } from "../e2e/bounded/manifest";
import path from "node:path";
import { readRunnerSettings, requireLiveGate } from "../e2e/bounded/settings";
import { verifyExistingAccounts } from "../e2e/bounded/runtime";
import { cleanupRun } from "../e2e/bounded/cleanup";
import { CHARACTER_CHILD_TABLES, childRowIdColumn, captureOwnedRows } from "../e2e/bounded/owned-rows";
async function main() {
    const args = process.argv.slice(2);
    const value = (name: string) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
    const mode = args[0];
    if (!["preflight", "audit", "cleanup-plan", "cleanup"].includes(mode))
        throw new Error("Choose preflight, audit, cleanup-plan, or separately confirmed cleanup");
    const envFile = value("--env-file");
    if (!envFile)
        throw new Error("Specify an existing approved runner --env-file; configuration is never copied");
    const settings = readRunnerSettings(envFile);
    let manifest: BoundedManifest | undefined;
    if (mode !== "preflight") {
        requireLiveGate(value("--project"), value("--run-id"));
        const file = value("--manifest");
        if (!file)
            throw new Error("An existing --manifest is required");
        // Cleanup never creates a new manifest or discovers characters by prefix.
        const { existsSync } = await import("node:fs");
        if (!existsSync(file))
            throw new Error("Cleanup manifest does not exist");
        manifest = new BoundedManifest(file, value("--run-id")!);
    }
    try {
        const accounts = await verifyExistingAccounts(settings);
        try {
            console.log("Approved project auth health, two existing distinct accounts, and trusted read access verified.");
            if (!manifest)
                return;
            if (mode === "audit") {
                if (manifest.attempts.some(row => ![accounts.ownerId, accounts.secondaryId].includes(row.ownerId)))
                    throw new Error("Manifest contains an owner outside the two approved accounts");
                await captureOwnedRows(manifest, accounts.admin, path.join(path.dirname(manifest.file), "owned-rows.json"));
                console.log("Exact-ID child audit captured; no application mutation performed.");
                return;
            }
            if (mode === "cleanup" && value("--confirm-cleanup-run") !== manifest.runId)
                throw new Error("Deletion requires --confirm-cleanup-run with the exact run ID");
            const ids = await cleanupRun(manifest, [accounts.ownerId, accounts.secondaryId], value("--run-id")!, mode === "cleanup", {
                async lookup(id) {
                    const { data, error } = await accounts.admin.from("characters").select("id,user_id,name").eq("id", id).maybeSingle();
                    if (error)
                        throw new Error("Exact-ID cleanup lookup failed");
                    return data;
                },
                async deleteExact(row) {
                    const deleted = await accounts.admin.from("characters").delete().eq("id", row.id).eq("user_id", row.ownerId).eq("name", row.name).select("id");
                    if (deleted.error || deleted.data?.length !== 1)
                        throw new Error("Exact-ID deletion outcome uncertain; inspect manifest IDs before retrying");
                },
                async verifyAbsent(id) {
                    for (const table of ["characters", ...CHARACTER_CHILD_TABLES]) {
                        const column = table === "characters" ? "id" : childRowIdColumn(table as (typeof CHARACTER_CHILD_TABLES)[number]);
                        const result = await accounts.admin.from(table).select(column, { count: "exact", head: true }).eq(table === "characters" ? "id" : "character_id", id);
                        if (result.error || result.count !== 0)
                            throw new Error("Exact-ID cleanup verification failed; retain journal for reconciliation");
                    }
                },
            });
            console.log(JSON.stringify({ runId: manifest.runId, cleanupIds: ids, execute: mode === "cleanup" }));
            if (mode === "cleanup")
                console.log("Recorded exact IDs and inspected child rows are absent; cleanup receipts persisted.");
        }
        finally {
            await accounts.close();
        }
    }
    finally {
        manifest?.close();
    }
}
// Keep failures sanitized: SDK/network errors can contain request details.
main().catch(error => {
    const safe = error instanceof Error && /^(Choose |Specify |Missing runner|Runner URL|Two distinct|Live execution|An existing|Cleanup manifest|Approved|Auth health failed|Existing |Trusted |Manifest |Exact-ID |Deletion requires|Recorded |Run ID|Incomplete journal|Reconcile|Task account)/.test(error.message) ? error.message : "Bounded runner failed; inspect local code/status without dumping credentials";
    console.error(safe);
    process.exitCode = 1;
});
