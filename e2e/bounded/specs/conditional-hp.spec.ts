import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";
import { BoundedManifest } from "../manifest";
import { runDirectory } from "../run-paths";
import { readRunnerSettings } from "../settings";
import { verifyExistingAccounts } from "../runtime";
import { browserLogin } from "../browser-login";
import { hpTrigger, hpReading } from "../sheet-locators";
import { captureOwnedRows } from "../owned-rows";
import type { Json } from "@/lib/supabase/database.types";

test("conditional owner HP writes reject stale tabs and recover only after explicit reload", async ({ page, context }) => {
  test.setTimeout(120000);
  const settings = readRunnerSettings(process.env.INKBORNE_RUNNER_ENV_FILE!);
  const accounts = await verifyExistingAccounts(settings);
  const runId = process.env.INKBORNE_BOUNDED_RUN_ID!;
  const dir = runDirectory(runId);
  let manifest: BoundedManifest | undefined;
  let failed = false;
  const results: Array<Record<string, unknown>> = [];
  let phase = "setup";
  let releaseA: (() => void) | undefined;
  let releaseB: (() => void) | undefined;
  let abandon = false;
  let other: Awaited<ReturnType<typeof context.newPage>> | undefined;
  try {
    manifest = new BoundedManifest(path.join(dir, "fixtures.jsonl"), runId);
    const fixture = manifest.attempts.find(a => a.characterId && !a.cleaned);
    if (!fixture || fixture.ownerId !== accounts.ownerId || manifest.attempts.length !== 8) throw new Error("Requires the exact approved eighth owner fixture");
    const id = fixture.characterId!;
    const receipt = () => writeFileSync(path.join(dir, "conditional-hp-results.json"), JSON.stringify({ runId, characterId: id, phase, recordedAt: new Date().toISOString(), results }, null, 2)+"\n");
    const read = async () => {
      const { data, error } = await accounts.primary.from("characters").select("id,user_id,name,state").eq("id", id).single();
      expect(error).toBeNull(); expect(data?.user_id).toBe(fixture.ownerId); expect(data?.name).toBe(fixture.name);
      return data!.state as Record<string, Json>;
    };
    const seed = async (state_patch: Record<string, Json>) => {
      await read(); const result = await accounts.primary.rpc("patch_character_state", { character_id: id, state_patch });
      expect(result.error).toBeNull(); const current = await read(); for (const [k,v] of Object.entries(state_patch)) expect(current[k]).toEqual(v);
      return current;
    };
    const conditional = (expected_state: Record<string, Json>, state_patch: Record<string, Json>) => accounts.primary.rpc("patch_character_state_if_current", { character_id: id, expected_state, state_patch });
    phase = "sdk-concurrency"; receipt();
    const baseline = await seed({ current_hp: 10, temp_hp: 0 });
    const replies = await Promise.all([conditional(baseline, { current_hp: 8 }), conditional(baseline, { current_hp: 7 })]);
    for (const response of replies) expect(response.error).toBeNull();
    expect(replies.map(r => r.data?.[0].status).sort()).toEqual(["applied", "conflict"]);
    const winner = replies.findIndex(r => r.data?.[0].status === "applied");
    expect(await read()).toEqual({ ...baseline, current_hp: winner === 0 ? 8 : 7 });
    results.push({ scenario: phase, status: "accepted", applied: 1, conflicts: 1, winner, preservedKeys: true }); receipt();

    phase = "owner-stale-and-denials"; receipt();
    const beforeDenial = await read();
    const stale = await conditional(baseline, { current_hp: 13 });
    expect(stale.error).toBeNull(); expect(stale.data?.[0].status).toBe("conflict"); expect(await read()).toEqual(beforeDenial);
    const nonowner = await accounts.secondary.rpc("patch_character_state_if_current", { character_id: id, expected_state: beforeDenial, state_patch: { current_hp: 1 } });
    expect(nonowner.error).toBeNull(); expect(nonowner.data).toEqual([{ status: "missing", resulting_state: null }]);
    const anonymous = createClient(settings.NEXT_PUBLIC_SUPABASE_URL, settings.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const denied = await anonymous.rpc("patch_character_state_if_current", { character_id: id, expected_state: beforeDenial, state_patch: { current_hp: 1 } });
    expect(denied.error?.code).toBe("42501");
    const missing = await accounts.primary.rpc("patch_character_state_if_current", { character_id: randomUUID(), expected_state: {}, state_patch: { current_hp: 1 } });
    expect(missing.error).toBeNull(); expect(missing.data).toEqual([{ status: "missing", resulting_state: null }]);
    const invalid = await accounts.primary.rpc("patch_character_state_if_current", { character_id: id, expected_state: [], state_patch: { current_hp: 1 } });
    expect(invalid.error?.code).toBe("22023"); expect(await read()).toEqual(beforeDenial);
    results.push({ scenario: phase, status: "accepted", staleHealingRejected: true, nonownerMissingWithoutState: true, anonymousPermissionDenied: true, missingWithoutState: true, invalidRejected: true, ownerStateUnchanged: true }); receipt();

    phase = "browser-two-tab-conflict"; receipt();
    const browserBaseline = await seed({ current_hp: 10, temp_hp: 0 });
    await browserLogin(page, settings); await page.goto("/characters/"+id);
    other = await context.newPage(); await other.goto("/characters/"+id);
    await expect.poll(async () => (await hpReading(page)).current).toBe(10);
    await expect.poll(async () => (await hpReading(other!)).current).toBe(10);
    const url = settings.NEXT_PUBLIC_SUPABASE_URL + "/rest/v1/rpc/patch_character_state_if_current";
    const gateA = new Promise<void>(resolve => { releaseA = resolve; });
    const gateB = new Promise<void>(resolve => { releaseB = resolve; });
    const captured: Array<{ tab: string; expected: unknown; patch: unknown; response?: unknown }> = [];
    let browserRequests = 0;
    for (const [tab, target, gate] of [["A", page, gateA], ["B", other, gateB]] as const) {
      await target.route(url, async route => {
        if (route.request().method() !== "POST" || route.request().postDataJSON().character_id !== id) return route.continue();
        browserRequests++;
        const body = route.request().postDataJSON(); const entry = { tab, expected: body.expected_state, patch: body.state_patch, response: undefined as unknown };
        captured.push(entry); await gate;
        if (abandon) return route.abort("failed");
        const response = await route.fetch({ maxRetries: 0, timeout: 15000 }); expect(response.ok()).toBe(true);
        entry.response = await response.json(); await route.fulfill({ response });
      });
    }
    const damage = async (target: typeof page, amount: number) => { await hpTrigger(target).click(); await target.getByPlaceholder("Amount", { exact: true }).fill(String(amount)); await target.getByRole("button", { name: "Damage", exact: true }).click(); };
    await damage(page, 2); await damage(other, 3);
    await expect.poll(() => captured.length).toBe(2);
    expect(captured.map(c => c.expected)).toEqual([browserBaseline, browserBaseline]);
    expect(captured.map(c => c.patch)).toEqual([{ current_hp: 8, temp_hp: 0 }, { current_hp: 7, temp_hp: 0 }]);
    releaseA!(); releaseA = undefined;
    await expect.poll(async () => (await read()).current_hp).toBe(8);
    releaseB!(); releaseB = undefined;
    await expect(other.getByRole("button", { name: "Reload character", exact: true })).toBeVisible();
    await expect(other.getByRole("alert").first()).toContainText("changed in another tab");
    await expect.poll(async () => (await hpReading(page)).current).toBe(8);
    await expect.poll(async () => (await hpReading(other!)).current).toBe(10);
    expect(await read()).toEqual({ ...browserBaseline, current_hp: 8, temp_hp: 0 });
    expect(captured[0].response).toMatchObject([{ status: "applied" }]); expect(captured[1].response).toMatchObject([{ status: "conflict" }]);
    await other.getByRole("button", { name: "Damage", exact: true }).click();
    await expect(other.getByRole("alert").first()).toContainText("Reload");
    expect(browserRequests).toBe(2); expect((await read()).current_hp).toBe(8);
    results.push({ scenario: phase, status: "accepted-conditional-conflict", initialHp: 10, damageIntents: [2,3], appliedHp: 8, rejectedStalePatchHp: 7, requests: 2, automaticReplay: 0, explicitClickWhileBlockedRequests: 0, captures: captured.slice(0,2) }); receipt();

    phase = "explicit-reload-and-new-action"; receipt();
    await other.getByRole("button", { name: "Reload character", exact: true }).click();
    await expect.poll(async () => (await hpReading(other!)).current).toBe(8);
    await expect(other.getByRole("button", { name: "Reload character", exact: true })).toHaveCount(0);
    expect(browserRequests).toBe(2);
    await damage(other, 3);
    await expect.poll(async () => (await read()).current_hp).toBe(5);
    await expect.poll(async () => (await hpReading(other!)).current).toBe(5);
    await other.reload(); await expect.poll(async () => (await hpReading(other!)).current).toBe(5);
    expect(browserRequests).toBe(3);
    results.push({ scenario: phase, status: "accepted", reloadedHp: 8, explicitNewDamage: 3, persistedHp: 5, reloadVerified: true, additionalRequests: 1 }); receipt();
    phase = "complete"; receipt();
  } catch (error) { failed = true; throw error; } finally {
    abandon = true; releaseA?.(); releaseB?.();
    try {
      try {
        const drained = await Promise.allSettled([
          page.unrouteAll({ behavior: "wait" }),
          other ? other.unrouteAll({ behavior: "wait" }) : Promise.resolve(),
        ]);
        try {
          for (const result of drained) if (result.status === "rejected") throw result.reason;
        } finally { if (other) await other.close(); }
      } catch (error) { if (!failed) throw error; }
    } finally {
      try {
        if (manifest) {
          try { await captureOwnedRows(manifest, accounts.admin, path.join(dir, "owned-rows.json")); }
          catch (error) { if (!failed) throw error; }
        }
      } finally { try { manifest?.close(); } finally { await accounts.close(); } }
    }
  }
});
