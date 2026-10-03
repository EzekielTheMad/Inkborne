import { writeFileSync } from "node:fs";
import path from "node:path";
import { test, expect, type Route } from "@playwright/test";
import { BoundedManifest } from "../manifest";
import { runDirectory } from "../run-paths";
import { readRunnerSettings } from "../settings";
import { verifyExistingAccounts } from "../runtime";
import { browserLogin } from "../browser-login";
import { hpTrigger, hpReading } from "../sheet-locators";
import { restAfterSettledBack } from "../rest-recovery";
import { captureOwnedRows } from "../owned-rows";

test("bounded play recovery preserves state across navigation and exposes stale clients", async ({ page, context }, testInfo) => {
    const remainingOnly = testInfo.project.name === "remaining";
    test.setTimeout(120000);
    page.setDefaultTimeout(12000);
    page.setDefaultNavigationTimeout(20000);
    const settings = readRunnerSettings(process.env.INKBORNE_RUNNER_ENV_FILE!);
    const accounts = await verifyExistingAccounts(settings);
    let manifest: BoundedManifest | undefined;
    let release: (() => void) | undefined;
    let phase = "setup";
    const results: Array<Record<string, unknown>> = [];
    const pattern = settings.NEXT_PUBLIC_SUPABASE_URL + "/rest/v1/rpc/patch_character_state";
    let requests = 0;
    let forwarded = 0;
    let heldSettled = 0;
    let mode: "pass" | "reject" | "lost" | "hold-reject" | "hold-pass" = "pass";
    let gate: Promise<void> = Promise.resolve();
    let lostPatch: Record<string, unknown> | undefined;
    let failed = false;
    try {
        const runId = process.env.INKBORNE_BOUNDED_RUN_ID!;
        const dir = runDirectory(runId);
        manifest = new BoundedManifest(path.join(dir, "fixtures.jsonl"), runId);
        const fixture = manifest.attempts.find(a => a.characterId && !a.cleaned);
        if (!fixture || fixture.ownerId !== accounts.ownerId) throw new Error("Play requires the recorded owner fixture");
        const id = fixture.characterId!;
        const receipt = () => writeFileSync(path.join(dir, "play-results.json"), JSON.stringify({
            runId, characterId: id, recordedAt: new Date().toISOString(), results, requests, forwarded, phase }, null, 2)+"\n");
        const read = async () => {
            const result = await accounts.primary.from("characters").select("id,user_id,name,state").eq("id", id).single();
            expect(result.error).toBeNull();
            expect(result.data?.user_id).toBe(fixture.ownerId);
            expect(result.data?.name).toBe(fixture.name);
            return result.data!.state as Record<string, unknown>;
        };
        const seed = async (state_patch: Record<string, unknown>) => {
            await read();
            const result = await accounts.primary.rpc("patch_character_state", { character_id: id, state_patch });
            expect(result.error).toBeNull();
            const state = await read();
            for (const [key, value] of Object.entries(state_patch)) expect(state[key]).toEqual(value);
        };
        const hp = hpTrigger(page);
        const rest = page.getByRole("dialog", { name: "Rest", exact: true });
        const reject = (route: Route) => route.fulfill({ status: 403, contentType: "application/json",
            headers: { "access-control-allow-origin": new URL(page.url()).origin, "access-control-allow-credentials": "true" },
            body: JSON.stringify({ code: "42501", message: "Injected before forwarding: fixture write rejected" }) });
        await page.route(pattern, async route => {
            if (route.request().method() !== "POST") return route.continue();
            const body = route.request().postDataJSON();
            if (body.character_id !== id) return route.continue();
            requests++;
            const actionMode = mode;
            if (actionMode === "hold-reject" || actionMode === "hold-pass") await gate;
            if (actionMode === "reject") return reject(route);
            if (actionMode === "hold-reject") { await reject(route); heldSettled++; return; }
            if (actionMode === "lost" || actionMode === "hold-pass") {
                const response = await route.fetch({ maxRetries: 0, timeout: 15000 });
                expect(response.ok()).toBe(true);
                forwarded++;
                if (actionMode === "lost") {
                    lostPatch = body.state_patch;
                    return route.abort("failed"); // Server success received; browser receives no response.
                }
                return route.fulfill({ response });
            }
            forwarded++;
            return route.continue();
        });
        // This is a fresh diagnostic, never an automatic replay after a lost response.
        // Refuse continuation if a prior attempt could already have spent/logged a die.
        const initialState = await read();
        const initialRolls = await accounts.primary.from("character_rolls").select("id").eq("character_id", id);
        expect(initialRolls.error).toBeNull();
        expect(initialRolls.data).toHaveLength(0);
        expect(Object.values((initialState.hit_dice_spent ?? {}) as Record<string, number>).every(value => value === 0)).toBe(true);
        await seed({ current_hp: 10, temp_hp: 0, hit_dice_spent: {} });
        phase = "browser-login"; receipt();
        await browserLogin(page, settings);
        phase = "sheet-navigation"; receipt();
        await page.goto(`/characters/${id}`);
        await expect(page.getByRole("heading", { name: fixture.name, exact: true })).toBeVisible();
        await expect(page.getByRole("tab", { name: "Character Sheet", exact: true })).toHaveAttribute("aria-selected", "true");
        await expect(hp).toHaveCount(1);
        await expect(hp).toBeVisible();
        // Narrow DOM/state evidence only; no account, narrative or credential capture.
        const observedState = await read();
        writeFileSync(path.join(dir, "play-dom.json"), JSON.stringify({
            runId, characterId: id, viewport: page.viewportSize(), route: new URL(page.url()).pathname,
            selectedSheet: await page.getByRole("tab", { name: "Character Sheet", exact: true }).getAttribute("aria-selected"),
            hpControlCount: await hp.count(),
            hpLabels: await page.locator('[aria-label^="HP tracker"]').evaluateAll(nodes => nodes.map(node => node.getAttribute("aria-label"))),
            state: { current_hp: observedState.current_hp, temp_hp: observedState.temp_hp, hit_dice_spent: observedState.hit_dice_spent }
        }, null, 2) + "\n");

        if (!remainingOnly) {
            phase = "known-before-commit-hp-rejection"; receipt();
            const before = requests;
            const beforeForward = forwarded;
            mode = "reject";
            await hp.click();
            await page.getByPlaceholder("Amount", { exact: true }).fill("5");
            await page.getByRole("button", { name: "Damage", exact: true }).click();
            await expect(page.getByRole("alert").filter({ hasText: "The HP change could not be saved" })).toBeVisible();
            expect((await read()).current_hp).toBe(10);
            expect(requests - before).toBe(1);
            expect(forwarded - beforeForward).toBe(0);
            await expect.poll(async () => (await hpReading(page)).current).toBe(10);
            // Independent absolute input is allowed after the known rejected action.
            mode = "pass";
            await page.getByPlaceholder("Amount", { exact: true }).fill("3");
            await page.getByRole("button", { name: "Set Temp HP", exact: true }).click();
            await expect.poll(async () => (await read()).temp_hp).toBe(3);
            expect((await read()).current_hp).toBe(10);
            results.push({ scenario: phase, status: "accepted", damageRequests: 1, damageForwarded: 0,
                unchangedHp: 10, independentTempHpPersisted: 3 }); receipt();

            phase = "hit-die-committed-response-lost"; receipt();
            await seed({ current_hp: 10, temp_hp: 0, hit_dice_spent: {} });
            await page.reload();
            await expect.poll(async () => (await hpReading(page)).current).toBe(10);
            const beforeLost = requests;
            const forwardedBeforeLost = forwarded;
            mode = "lost";
            await page.getByRole("button", { name: "Rest", exact: true }).click();
            await rest.getByRole("button", { name: "Spend & Roll", exact: true }).click();
            await expect(rest.getByRole("alert")).toContainText("The hit die could not be spent");
            expect(lostPatch).toBeDefined();
            const committed = await read();
            expect(committed.current_hp).toBe(lostPatch!.current_hp);
            expect(committed.hit_dice_spent).toEqual(lostPatch!.hit_dice_spent);
            expect((committed.hit_dice_spent as Record<string, number>).barbarian).toBe(1);
            expect(requests - beforeLost).toBe(1);
            expect(forwarded - forwardedBeforeLost).toBe(1);
            // Do not click Spend again. Reload reconciles the single committed action.
            mode = "pass";
            await page.reload();
            await hp.click();
            await expect(page.getByText("Hit Dice: d12 0/1", { exact: true })).toBeVisible();
            await page.keyboard.press("Escape");
            await page.getByRole("button", { name: "Rest", exact: true }).click();
            await expect(rest.getByRole("button", { name: "Spend & Roll", exact: true })).toBeDisabled();
            await rest.getByRole("button", { name: "Close", exact: true }).click();
            const rolls = await accounts.primary.from("character_rolls").select("id").eq("character_id", id);
            expect(rolls.error).toBeNull();
            expect(rolls.data).toHaveLength(1);
            results.push({ scenario: phase, status: "accepted-isolated-reconciliation",
                requests: 1, serverSuccesses: 1, blindRetries: 0, spentDiceAfterReload: 1,
                recordedRolls: 1, limitation: "No durable action receipt; readback resolves this isolated observation only" }); receipt();

        } else {
            // Known local test setup, not a hit-die action or a roll-history claim.
            await seed({ hit_dice_spent: { barbarian: 1 } });
        }

        phase = "rest-navigation-known-rejection-recovery"; receipt();
        await seed({ current_hp: 10, temp_hp: 0 });
        await page.reload();
        const restBaseline = await read();
        const hpBeforeRest = await hpReading(page);
        expect(hpBeforeRest.current).toBe(10);
        const displayedMaxHp = hpBeforeRest.maximum;
        expect(displayedMaxHp).toBeGreaterThan(10);
        mode = "hold-reject";
        gate = new Promise<void>(resolve => { release = resolve; });
        const beforeRest = requests;
        const forwardedBeforeRest = forwarded;
        const settledBeforeRest = heldSettled;
        await page.getByRole("button", { name: "Rest", exact: true }).click();
        await rest.getByRole("button", { name: "Take Long Rest", exact: true }).click();
        await expect(rest).toHaveAttribute("aria-busy", "true");
        await expect(rest.getByRole("status")).toContainText("Saving this rest action");
        await expect(rest.getByRole("button", { name: "Take Long Rest", exact: true })).toBeDisabled();
        await expect.poll(() => requests - beforeRest).toBe(1); // Capture the exact held request before navigating.
        // This is a real Next Link. Client navigation does not imply Activity retention.
        await page.locator(`a[href="/characters/${id}/builder"]:visible`).evaluate((node: HTMLAnchorElement) => node.click());
        await page.waitForURL(`**/characters/${id}/builder`);
        const hiddenResponse = page.waitForResponse(response => response.url() === pattern && response.request().method() === "POST");
        release!(); release = undefined;
        await expect.poll(() => heldSettled - settledBeforeRest).toBe(1);
        const rejectionResponse = await hiddenResponse;
        expect(rejectionResponse.status()).toBe(403);
        expect(await rejectionResponse.finished()).toBeNull();
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        expect(requests - beforeRest).toBe(1);
        expect(forwarded - forwardedBeforeRest).toBe(0);
        expect(await read()).toEqual(restBaseline); // Every persisted state key, including the spent die, must survive.
        await page.goBack();
        await expect(hp).toBeVisible();
        await expect.poll(async () => (await hpReading(page)).current).toBe(10);
        await expect(page.getByRole("tab", { name: "Character Sheet", exact: true })).toHaveAttribute("aria-selected", "true");
        const recovery = await restAfterSettledBack(page);
        expect(await read()).toEqual(restBaseline);
        expect(requests - beforeRest).toBe(1); // Reopening never retries the action.
        results.push({ scenario: phase, status: "accepted-known-no-commit-recovery",
            navigationLifecycle: recovery.lifecycle, failureForwarded: 0, baselinePreserved: true,
            settledWhileAway: true, reopenedWithoutRetry: true }); receipt();

        phase = "rest-explicit-confirmed-retry"; receipt();
        mode = "pass";
        const beforeRestRetry = requests;
        const forwardedBeforeRetry = forwarded;
        await recovery.dialog.getByRole("button", { name: "Take Long Rest", exact: true }).click();
        await expect(recovery.dialog).toHaveCount(0);
        const recovered = await read();
        expect(recovered.current_hp).toBe(displayedMaxHp);
        expect(recovered.temp_hp).toBe(0);
        expect((recovered.hit_dice_spent as Record<string, number>).barbarian).toBe(0);
        expect(requests - beforeRestRetry).toBe(1);
        expect(forwarded - forwardedBeforeRetry).toBe(1);
        const restRolls = await accounts.primary.from("character_rolls").select("id").eq("character_id", id);
        expect(restRolls.error).toBeNull();
        expect(restRolls.data).toHaveLength(remainingOnly ? 0 : 1);
        await page.reload();
        await expect.poll(async () => (await hpReading(page)).current).toBe(displayedMaxHp);
        await page.getByRole("button", { name: "Rest", exact: true }).click();
        await expect(rest).toHaveAttribute("aria-busy", "false");
        await expect(rest.getByRole("alert")).toHaveCount(0);
        await expect(rest.getByRole("button", { name: "Take Long Rest", exact: true })).toBeDisabled();
        await expect(rest.getByRole("button", { name: "Spend & Roll", exact: true })).toBeDisabled();
        await expect(rest.getByRole("button", { name: "Spend & Roll", exact: true })).toHaveAttribute("title", "HP is already full");
        await expect(rest.getByText("1/1", { exact: true })).toBeVisible();
        await rest.getByRole("button", { name: "Close", exact: true }).click();
        results.push({ scenario: phase, status: "accepted-confirmed-retry", requests: 1,
            serverSuccesses: 1, resultingHp: displayedMaxHp, spentDice: 0,
            rollHistoryUnchanged: true, reloadVerified: true }); receipt();

        phase = "two-tab-relative-hp-contract"; receipt();
        await seed({ current_hp: 10, temp_hp: 0 });
        await page.reload();
        const other = await context.newPage();
        try {
            await other.goto(`/characters/${id}`);
            const otherHp = hpTrigger(other);
            await expect.poll(async () => (await hpReading(page)).current).toBe(10);
            await expect.poll(async () => (await hpReading(other)).current).toBe(10);
            mode = "hold-pass";
            gate = new Promise<void>(resolve => { release = resolve; });
            let otherRelease: (() => void) | undefined;
            let otherPatch: Record<string, unknown> | undefined;
            const otherGate = new Promise<void>(resolve => { otherRelease = resolve; });
            await other.route(pattern, async route => {
                if (route.request().method() !== "POST" || route.request().postDataJSON().character_id !== id) return route.continue();
                otherPatch = route.request().postDataJSON().state_patch;
                await otherGate;
                const response = await route.fetch({ maxRetries: 0, timeout: 15000 });
                expect(response.ok()).toBe(true);
                return route.fulfill({ response });
            });
            try {
                await hp.click(); await page.getByPlaceholder("Amount", { exact: true }).fill("2");
                await page.getByRole("button", { name: "Damage", exact: true }).click();
                await otherHp.click(); await other.getByPlaceholder("Amount", { exact: true }).fill("3");
                await other.getByRole("button", { name: "Damage", exact: true }).click();
                await expect.poll(() => otherPatch?.current_hp).toBe(7);
                release!(); release = undefined;
                await expect.poll(async () => (await read()).current_hp).toBe(8);
                otherRelease!(); otherRelease = undefined;
                await expect.poll(async () => (await read()).current_hp).toBe(7);
                await expect(page.getByPlaceholder("Amount", { exact: true })).toHaveCount(0);
                await expect(other.getByPlaceholder("Amount", { exact: true })).toHaveCount(0);
                await expect.poll(async () => (await hpReading(page)).current).toBe(8);
                await expect.poll(async () => (await hpReading(other)).current).toBe(7);
                await page.reload();
                await expect.poll(async () => (await hpReading(page)).current).toBe(7);
                results.push({ scenario: phase, status: "blocked-durability-contract",
                    initialHp: 10, damageIntents: [2, 3], serialIntentHp: 5, persistedHp: 7,
                    bothWritesConfirmed: true, firstTabStaleHp: 8, reloadReconciledHp: 7,
                    furtherDependentActionsStopped: true,
                    requiredDecision: "Approve conditional/intent RPC and durable action receipts; no SQL implemented" }); receipt();
            } finally { otherRelease?.(); }
        } finally {
            await other.unrouteAll({ behavior: "wait" }).catch(() => {});
            await other.close();
        }
        phase = "complete";
        receipt();
    } catch (error) {
        failed = true;
        throw error;
    } finally {
        release?.();
        await page.unrouteAll({ behavior: "wait" }).catch(() => {});
        try {
            if (manifest) {
                try { await captureOwnedRows(manifest, accounts.admin, path.join(runDirectory(manifest.runId), "owned-rows.json")); }
                catch (error) { if (!failed) throw error; }
            }
        } finally {
            try { manifest?.close(); } finally { await accounts.close(); }
        }
    }
});

