// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { APPROVED_PROJECT, BoundedManifest } from "@/e2e/bounded/manifest";
import { readRunnerSettings, requireLiveGate, validateRunnerSettings, type RunnerSettings } from "@/e2e/bounded/settings";
const dirs: string[] = [];
const journals: BoundedManifest[] = [];
function fixture() {
    const dir = mkdtempSync(path.join(tmpdir(), "inkborne-bounded-unit-"));
    dirs.push(dir);
    const file = path.join(dir, "run.jsonl"), runId = randomUUID();
    const journal = new BoundedManifest(file, runId);
    journals.push(journal);
    return { file, runId, journal };
}
afterEach(() => { journals.splice(0).forEach(j => j.close()); dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true })); });
describe("bounded fixture journal", () => {
    it("durably reserves before a simulated creation and recovers after restart", () => {
        const { file, runId, journal } = fixture();
        const attempt = journal.reserve(randomUUID(), "builder");
        expect(readFileSync(file, "utf8")).toContain(attempt.attemptId);
        journal.close();
        const resumed = new BoundedManifest(file, runId);
        journals.push(resumed);
        expect(() => resumed.reserve(randomUUID(), "another")).toThrow(/unresolved/);
        const id = randomUUID();
        resumed.recordCreated(attempt.attemptId, id);
        expect(resumed.cleanupScope(runId)).toEqual([{ id, ownerId: attempt.ownerId, name: attempt.name }]);
    });
    it("enforces six attempts across restart without resetting the budget after cleanup", () => {
        const { file, runId, journal } = fixture();
        for (let i = 0; i < 6; i++) {
            const a = journal.reserve(randomUUID(), "fixture");
            const id = randomUUID();
            journal.recordCreated(a.attemptId, id);
            journal.recordCleaned(id);
        }
        journal.close();
        const resumed = new BoundedManifest(file, runId);
        journals.push(resumed);
        expect(() => resumed.reserve(randomUUID(), "seventh")).toThrow(/ceiling/);
    });
    it("blocks simultaneous runners and foreign cleanup IDs", () => {
        const { file, runId, journal } = fixture();
        expect(() => new BoundedManifest(file, runId)).toThrow();
        expect(() => journal.cleanupScope(randomUUID())).toThrow(/exact run/);
        expect(() => journal.recordCreated(randomUUID(), randomUUID())).toThrow(/assignment/);
        expect(() => journal.recordCleaned(randomUUID())).toThrow(/receipt/);
    });
    it("fails closed on a truncated durable journal", () => {
        const { file, runId, journal } = fixture();
        journal.close();
        writeFileSync(file, readFileSync(file, "utf8").trimEnd());
        expect(() => new BoundedManifest(file, runId)).toThrow(/Incomplete/);
    });
    it("fails closed on injected foreign names and over-budget reservations", () => {
        const { file, runId, journal } = fixture();
        journal.close();
        writeFileSync(file, `${JSON.stringify({ kind: "run", project: APPROVED_PROJECT, runId })}\n${JSON.stringify({ kind: "reserve", attemptId: randomUUID(), ownerId: randomUUID(), name: "preexisting character" })}\n`);
        expect(() => new BoundedManifest(file, runId)).toThrow(/does not belong/);
    });
});
describe("runner project/account gates", () => {
    const settings: RunnerSettings = { NEXT_PUBLIC_SUPABASE_URL: `https://${APPROVED_PROJECT}.supabase.co`, NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-only-key", SUPABASE_SERVICE_ROLE_KEY: "test-only-admin", E2E_TEST_EMAIL: "owner@example.invalid", E2E_TEST_PASSWORD: "test-only-password", E2E_PLAYER_EMAIL: "other@example.invalid", E2E_PLAYER_PASSWORD: "test-only-password" };
    it("rejects an unapproved URL and duplicate accounts", () => {
        expect(() => validateRunnerSettings({ ...settings, NEXT_PUBLIC_SUPABASE_URL: "https://other.supabase.co" })).toThrow(/approved project/);
        expect(() => validateRunnerSettings({ ...settings, E2E_PLAYER_EMAIL: "OWNER@example.invalid" })).toThrow(/distinct/);
        expect(() => requireLiveGate(APPROVED_PROJECT, undefined)).toThrow(/explicit/);
    });
    it("only loads the seven allowed settings, respects inherited values, and never returns unrelated secrets", () => {
        const { file, journal } = fixture();
        journal.close();
        writeFileSync(file, Object.entries({ ...settings, UNRELATED_SECRET: "must-not-return" }).map(([k, v]) => `${k}=${v}`).join("\n"));
        const loaded = readRunnerSettings(file, { E2E_TEST_PASSWORD: "injected-test-value" });
        expect(loaded.E2E_TEST_PASSWORD).toBe("injected-test-value");
        expect(Object.keys(loaded)).toHaveLength(7);
        expect(loaded).not.toHaveProperty("UNRELATED_SECRET");
    });
});
