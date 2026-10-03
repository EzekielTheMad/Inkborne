import { writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";
import { BoundedManifest } from "../manifest";
import { runDirectory } from "../run-paths";
import { readRunnerSettings } from "../settings";
import { verifyExistingAccounts } from "../runtime";
import { browserLogin } from "../browser-login";
import { captureOwnedRows } from "../owned-rows";

test("bounded private owner, nonowner, anonymous and guarded concurrent writes", async ({ browser, baseURL }) => {
    const settings = readRunnerSettings(process.env.INKBORNE_RUNNER_ENV_FILE!);
    const accounts = await verifyExistingAccounts(settings);
    const anonymous = createClient(settings.NEXT_PUBLIC_SUPABASE_URL, settings.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    let manifest: BoundedManifest | undefined;
    try {
        const runId = process.env.INKBORNE_BOUNDED_RUN_ID!;
        const dir = runDirectory(runId);
        manifest = new BoundedManifest(path.join(dir, "fixtures.jsonl"), runId);
        const fixture = manifest.attempts.find(attempt => attempt.characterId && !attempt.cleaned);
        if (!fixture || fixture.ownerId !== accounts.ownerId)
            throw new Error("Access checks require the recorded primary-account fixture");
        const id = fixture.characterId!;
        const readOwner = async () => {
            const result = await accounts.primary.from("characters")
                .select("id,user_id,name,visibility,choices,base_stats").eq("id", id).single();
            expect(result.error).toBeNull();
            expect(result.data?.user_id).toBe(fixture.ownerId);
            expect(result.data?.name).toBe(fixture.name);
            return result.data!;
        };
        const baseline = await readOwner();
        expect(baseline.visibility).toBe("private");
        const results: Array<Record<string, unknown>> = [];
        for (const [role, client] of [["nonowner", accounts.secondary], ["anonymous", anonymous]] as const) {
            for (const operation of ["read", "update"] as const) {
                const result = operation === "read"
                    ? await client.from("characters").select("id").eq("id", id)
                    : await client.from("characters").update({ name: "Unauthorized bounded probe" }).eq("id", id).select("id");
                // A timeout/network/other failure is not evidence of access denial.
                if (result.error) expect(result.error.code).toBe("42501");
                else expect(result.data).toEqual([]);
                expect((await readOwner()).name).toBe(baseline.name);
                results.push({ role, operation, accepted: true,
                    outcome: result.error ? "permission_denied_42501" : "zero_visible_or_updated_rows" });
            }
            const refs = await client.from("character_content_refs").select("id").eq("character_id", id);
            if (refs.error) expect(refs.error.code).toBe("42501");
            else expect(refs.data).toEqual([]);
            results.push({ role, operation: "reference_read", accepted: true,
                outcome: refs.error ? "permission_denied_42501" : "zero_visible_rows" });
        }
        const secondaryContext = await browser.newContext({ baseURL });
        const anonymousContext = await browser.newContext({ baseURL });
        try {
            const secondaryPage = await secondaryContext.newPage();
            await browserLogin(secondaryPage, settings, "secondary");
            for (const route of [`/characters/${id}`, `/characters/${id}/builder`]) {
                const response = await secondaryPage.goto(route);
                expect(response?.status()).toBe(404);
                await expect(secondaryPage.getByText(fixture.name, { exact: true })).toHaveCount(0);
            }
            results.push({ role: "nonowner", operation: "sheet_and_builder_routes", accepted: true, outcome: "404_without_fixture_name" });
            const anonymousPage = await anonymousContext.newPage();
            for (const route of [`/characters/${id}`, `/characters/${id}/builder`]) {
                await anonymousPage.goto(route);
                await expect(anonymousPage).toHaveURL(/\/login(?:\?|$)/);
                await expect(anonymousPage.getByRole("button", { name: /sign in/i })).toBeVisible();
                await expect(anonymousPage.getByText(fixture.name, { exact: true })).toHaveCount(0);
            }
            results.push({ role: "anonymous", operation: "sheet_and_builder_routes", accepted: true, outcome: "login_redirect_without_fixture_name" });
        } finally {
            await Promise.all([secondaryContext.close(), anonymousContext.close()]);
        }
        // Two concurrent writes use the application's ability-save compare-and-set
        // filters. This verifies the hosted filter contract, not browser conflict UI
        // or unguarded whole-state writes.
        const candidates = [baseline.base_stats.strength === 14 ? 12 : 14, baseline.base_stats.strength === 13 ? 11 : 13].map(strength => ({ ...baseline.base_stats, strength }));
        try {
            const writes = await Promise.all(candidates.map(base_stats => accounts.primary.from("characters")
                .update({ base_stats, choices: baseline.choices }).eq("id", id)
                .eq("choices", JSON.stringify(baseline.choices))
                .eq("base_stats", JSON.stringify(baseline.base_stats)).select("id")));
            for (const write of writes) expect(write.error).toBeNull();
            expect(writes.map(write => write.data?.length ?? 0).sort()).toEqual([0, 1]);
            const winner = writes.findIndex(write => write.data?.length === 1);
            const persisted = await readOwner();
            expect(persisted.base_stats).toEqual(candidates[winner]);
            expect(persisted.choices).toEqual(baseline.choices);
            results.push({ role: "owner", operation: "guarded_concurrent_ability_writes",
                accepted: true, confirmedWriters: 1, staleWriters: 1,
                limitation: "SDK filters match application contract; browser conflict recovery not tested" });
        } finally {
            const current = await readOwner();
            // Never overwrite an unrecognized concurrent edit during restoration.
            expect(current.choices).toEqual(baseline.choices);
            expect([baseline.base_stats, ...candidates]).toContainEqual(current.base_stats);
            const restored = await accounts.primary.from("characters")
                .update({ base_stats: baseline.base_stats, choices: baseline.choices }).eq("id", id)
                .eq("choices", JSON.stringify(current.choices))
                .eq("base_stats", JSON.stringify(current.base_stats)).select("id").single();
            expect(restored.error).toBeNull();
            expect(restored.data?.id).toBe(id);
            expect((await readOwner()).base_stats).toEqual(baseline.base_stats);
        }
        writeFileSync(path.join(dir, "access-results.json"), JSON.stringify({
            runId, characterId: id, capturedAt: new Date().toISOString(),
            fixtureVisibility: baseline.visibility, originalAbilityScoresRestored: true, results }, null, 2)+"\n");
        await captureOwnedRows(manifest, accounts.admin, path.join(dir, "owned-rows.json"));
    } finally {
        try { manifest?.close(); } finally { await accounts.close(); }
    }
});

