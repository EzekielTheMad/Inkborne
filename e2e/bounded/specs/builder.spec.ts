import { mkdirSync } from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { BoundedManifest } from "../manifest";
import { OneAttemptManifest } from "../one-attempt-manifest";
import { runDirectory } from "../run-paths";
import { readRunnerSettings } from "../settings";
import { verifyExistingAccounts } from "../runtime";
import { browserLogin } from "../browser-login";
test("bounded real creation reaches builder, refreshes, and denies nonowner updates", async ({ page }) => {
    const settings = readRunnerSettings(process.env.INKBORNE_RUNNER_ENV_FILE!);
    const accounts = await verifyExistingAccounts(settings);
    try {
        const runId = process.env.INKBORNE_BOUNDED_RUN_ID!;
        const dir = runDirectory(runId);
        mkdirSync(dir, { recursive: true });
        const Manifest = process.env.INKBORNE_BOUNDED_PLAY_SCOPE === "state-controls" ? OneAttemptManifest : BoundedManifest;
        const manifest = new Manifest(path.join(dir, "fixtures.jsonl"), runId);
        try {
            await browserLogin(page, settings);
            await page.goto("/characters/new");
            const attempt = manifest.reserve(accounts.ownerId, "builder");
            await page.getByLabel(/what will they be called/i).fill(attempt.name);
            const select = page.locator("select#system_id");
            if (await select.count()) {
                const { data, error } = await accounts.primary.from("game_systems").select("id").eq("slug", "dnd-5e-2014").eq("status", "published").single();
                expect(error).toBeNull();
                expect(data).not.toBeNull();
                await select.selectOption(data!.id);
            }
            try {
                await page.getByRole("button", { name: /^begin/i }).click();
                await page.waitForURL(/\/characters\/[0-9a-f-]{36}\/builder/);
                const id = page.url().match(/\/characters\/([0-9a-f-]{36})\/builder/)![1];
                manifest.recordCreated(attempt.attemptId, id);
            }
            catch (error) {
                // Lost navigation responses: reconcile only the exact reserved owner+name.
                const result = await accounts.admin.from("characters").select("id").eq("user_id", attempt.ownerId).eq("name", attempt.name).limit(2);
                if (!result.error && result.data?.length === 1)
                    manifest.recordCreated(attempt.attemptId, result.data[0].id);
                throw error;
            }
            const id = manifest.attempts.at(-1)!.characterId!;
            await expect(page.getByRole("heading", { name: attempt.name })).toBeVisible();
            await page.reload();
            await expect(page.getByText("Character Builder").first()).toBeVisible();
            await expect(page.locator(`a[href="/characters/${id}/builder/race"]`).first()).toBeVisible();
            const denied = await accounts.secondary.from("characters").update({ name: "unauthorized bounded edit" }).eq("id", id).select("id");
            expect(denied.data ?? []).toHaveLength(0);
            const actual = await accounts.primary.from("characters").select("name").eq("id", id).single();
            expect(actual.error).toBeNull();
            expect(actual.data?.name).toBe(attempt.name);
        }
        finally {
            manifest.close();
        }
    }
    finally {
        await accounts.close();
    }
    // Cleanup is a separate explicit command using this manifest. Never delete in hooks.
});
