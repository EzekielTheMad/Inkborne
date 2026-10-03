import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { z } from "zod";
import { APPROVED_PROJECT } from "./manifest";
export const REQUIRED_SETTINGS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "E2E_TEST_EMAIL", "E2E_TEST_PASSWORD", "E2E_PLAYER_EMAIL", "E2E_PLAYER_PASSWORD"] as const;
export type RunnerSettings = Record<(typeof REQUIRED_SETTINGS)[number], string>;
/** Allowlist only. Do not copy a secrets file, log values, or change persistent config. */
export function readRunnerSettings(file: string, inherited: Partial<NodeJS.ProcessEnv> = process.env): RunnerSettings {
    const parsed = parse(readFileSync(file));
    const settings = Object.fromEntries(REQUIRED_SETTINGS.map(name => [name, inherited[name] ?? parsed[name]])) as RunnerSettings;
    const missing = REQUIRED_SETTINGS.filter(name => !settings[name]);
    if (missing.length)
        throw new Error(`Missing runner settings: ${missing.join(", ")}`);
    validateRunnerSettings(settings);
    return settings;
}
export function validateRunnerSettings(settings: RunnerSettings) {
    const url = new URL(settings.NEXT_PUBLIC_SUPABASE_URL);
    if (url.protocol !== "https:" || url.hostname !== `${APPROVED_PROJECT}.supabase.co` || url.username || url.password || url.search || url.hash || url.port || !["", "/"].includes(url.pathname)) {
        throw new Error("Runner URL does not match the exact approved project");
    }
    if (settings.E2E_TEST_EMAIL.trim().toLowerCase() === settings.E2E_PLAYER_EMAIL.trim().toLowerCase())
        throw new Error("Two distinct existing account settings are required");
}
export function requireLiveGate(project: string | undefined, runId: string | undefined) {
    if (project !== APPROVED_PROJECT || !runId)
        throw new Error("Live execution requires an explicit approved project and run ID");
    z.string().uuid().parse(runId);
}
