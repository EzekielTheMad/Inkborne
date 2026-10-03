import path from "node:path";
import { test, expect } from "@playwright/test";
import { BoundedManifest } from "../manifest";
import { runDirectory } from "../run-paths";
import { readRunnerSettings } from "../settings";
import { verifyExistingAccounts } from "../runtime";
import { browserLogin } from "../browser-login";
import { captureOwnedRows } from "../owned-rows";
test("bounded journey selects existing SRD choices and reaches the sheet", async ({ page }) => {
    test.setTimeout(240000);
    const settings = readRunnerSettings(process.env.INKBORNE_RUNNER_ENV_FILE!);
    const accounts = await verifyExistingAccounts(settings);
    try {
        const runId = process.env.INKBORNE_BOUNDED_RUN_ID!;
        const dir = runDirectory(runId);
        const manifest = new BoundedManifest(path.join(dir, "fixtures.jsonl"), runId);
        let journeyFailed = false;
        try {
            const fixture = manifest.attempts.find(a => a.characterId && !a.cleaned);
            if (!fixture || fixture.ownerId !== accounts.ownerId)
                throw new Error("Journey requires the existing recorded primary-account fixture");
            const id = fixture.characterId!;
            const readCharacter = async () => {
                const result = await accounts.primary.from("characters").select("id,user_id,name,choices,base_stats,state").eq("id", id).single();
                if (result.error || result.data.user_id !== fixture.ownerId || result.data.name !== fixture.name)
                    throw new Error("Run-owned character identity/read check failed");
                return result.data;
            };
            await browserLogin(page, settings);
            await page.goto(`/characters/${id}/builder/race`);
            if (!(await readCharacter()).choices.race) {
                await page.getByRole("button", { name: "Preview Half-Orc", exact: true }).click();
                await page.getByRole("button", { name: "Add Race", exact: true }).click();
            }
            await expect.poll(async () => (await readCharacter()).choices.race).toBe("half-orc");
            await page.getByRole("button", { name: "Next: Class", exact: true }).click();
            await page.waitForURL(`**/characters/${id}/builder/class`);
            if (!(await readCharacter()).choices.classes?.length) {
                await page.getByRole("button", { name: "Preview Barbarian", exact: true }).click();
                await page.getByRole("button", { name: "Pick this class", exact: true }).click();
            }
            await expect.poll(async () => (await readCharacter()).choices.classes?.[0]?.slug).toBe("barbarian");
            await page.reload();
            const restore = page.getByRole("button", { name: "Restore saved class features", exact: true });
            if (await restore.isVisible()) {
                await restore.click();
                await expect(restore).not.toBeVisible();
            }
            for (const [label, slug] of [["Athletics", "skill-athletics"], ["Perception", "skill-perception"]]) {
                const button = page.getByRole("button", { name: label, exact: true });
                if (await button.getAttribute("aria-pressed") !== "true")
                    await button.click();
                await expect.poll(async () => (await readCharacter()).choices.resolved_choices?.["barbarian-proficiency-choice-0"] ?? []).toContain(slug);
            }
            await page.goto(`/characters/${id}/builder/abilities`);
            for (const [label, value] of [["Strength", "15"], ["Dexterity", "14"], ["Constitution", "13"], ["Intelligence", "12"], ["Wisdom", "10"], ["Charisma", "8"]]) {
                await page.getByLabel(`${label} score`, { exact: true }).selectOption(value);
                await expect.poll(async () => (await readCharacter()).base_stats[label.toLowerCase()]).toBe(Number(value));
            }
            await page.getByRole("button", { name: "Next: Background", exact: true }).click();
            await page.waitForURL(`**/characters/${id}/builder/background`);
            if (!(await readCharacter()).choices.background) {
                await page.getByRole("button", { name: "Preview Acolyte", exact: true }).click();
                await page.getByRole("button", { name: "Add Background", exact: true }).click();
            }
            await expect.poll(async () => (await readCharacter()).choices.background).toBe("acolyte");
            for (const language of ["Dwarvish", "Elvish"]) {
                const button = page.getByRole("button", { name: language, exact: true });
                if (await button.getAttribute("aria-pressed") !== "true")
                    await button.click();
                await expect.poll(async () => (await readCharacter()).choices.resolved_choices?.["acolyte-language-choice"] ?? []).toContain(language.toLowerCase());
            }
            await page.goto(`/characters/${id}/builder/equipment`);
            if (!(await readCharacter()).choices.starting_equipment?.confirmed) {
                const groups = page.locator('article [role="group"]');
                for (let index = 0; index < await groups.count(); index++) {
                    const group = groups.nth(index);
                    if (!await group.locator('button[aria-pressed="true"]').count())
                        await group.getByRole("button").first().click();
                    await expect(group.getByRole("button").first()).toBeEnabled();
                }
                for (const select of await page.getByRole("combobox").all()) {
                    await select.click();
                    await page.getByRole("option").first().click();
                    await expect(select).toBeEnabled();
                }
                const confirm = page.getByRole("button", { name: "Confirm Equipment", exact: true });
                await expect(confirm).toBeEnabled();
                await confirm.click();
                await expect.poll(async () => (await readCharacter()).choices.starting_equipment?.confirmed).toBe(true);
            }
            await page.getByRole("button", { name: "Finish & View Character", exact: true }).click();
            await page.waitForURL(`**/characters/${id}`);
            await expect(page.getByRole("heading", { name: fixture.name, exact: true })).toBeVisible();
            await page.reload();
            await expect(page.getByRole("heading", { name: fixture.name, exact: true })).toBeVisible();
            const refs = await accounts.primary.from("character_content_refs").select("content_id,content_version,feature_grant_id").eq("character_id", id);
            expect(refs.error).toBeNull();
            expect(refs.data?.length).toBeGreaterThanOrEqual(5);
            expect(refs.data?.every(ref => ref.content_id && ref.content_version > 0)).toBe(true);
            const inventory = await accounts.primary.from("character_inventory").select("id").eq("character_id", id);
            expect(inventory.error).toBeNull();
            expect(inventory.data?.length).toBeGreaterThan(0);
            await page.setViewportSize({ width: 390, height: 844 });
            await expect(page.getByText(fixture.name, { exact: true }).and(page.locator(":visible"))).toBeVisible();
        }
        catch (error) {
            journeyFailed = true;
            throw error;
        }
        finally {
            try {
                await captureOwnedRows(manifest, accounts.admin, path.join(dir, "owned-rows.json"));
            }
            catch (error) {
                if (!journeyFailed)
                    throw error;
                console.error("Run-owned child audit also failed; primary browser failure retained. Run the exact-ID audit separately.");
            }
            finally {
                manifest.close();
            }
        }
    }
    finally {
        await accounts.close();
    }
});
