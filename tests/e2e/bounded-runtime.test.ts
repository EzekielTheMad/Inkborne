// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { APPROVED_PROJECT } from "@/e2e/bounded/manifest";
import { type RunnerSettings } from "@/e2e/bounded/settings";
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));
import { verifyExistingAccounts } from "@/e2e/bounded/runtime";
const settings: RunnerSettings = { NEXT_PUBLIC_SUPABASE_URL: `https://${APPROVED_PROJECT}.supabase.co`, NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-client-key", SUPABASE_SERVICE_ROLE_KEY: "test-admin-key", E2E_TEST_EMAIL: "owner@example.invalid", E2E_TEST_PASSWORD: "test-password", E2E_PLAYER_EMAIL: "other@example.invalid", E2E_PLAYER_PASSWORD: "test-password" };
function account(id: string) {
    let loggedIn = false;
    return { auth: {
            signInWithPassword: vi.fn(async () => { loggedIn = true; return { data: { user: { id } }, error: null }; }),
            getSession: vi.fn(async () => ({ data: { session: loggedIn ? {} : null } })),
            signOut: vi.fn(async () => ({ error: null as {
                    message: string;
                } | null })),
        } };
}
beforeEach(() => { vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true }))); createClient.mockReset(); });
afterEach(() => vi.unstubAllGlobals());
it("cleans the first task session when the second existing-account login fails", async () => {
    const primary = account("owner"), secondary = account("other");
    secondary.auth.signInWithPassword.mockRejectedValue(new Error("simulated authentication failure"));
    createClient.mockReturnValueOnce(primary).mockReturnValueOnce(secondary).mockReturnValueOnce({});
    await expect(verifyExistingAccounts(settings)).rejects.toThrow(/authentication failure/);
    expect(primary.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
});
it("attempts both task-session signouts even if one signout fails", async () => {
    const primary = account("owner"), secondary = account("other");
    primary.auth.signOut.mockResolvedValue({ error: { message: "test failure" } });
    const admin = { from: () => ({ select: () => ({ limit: async () => ({ error: null }) }) }) };
    createClient.mockReturnValueOnce(primary).mockReturnValueOnce(secondary).mockReturnValueOnce(admin);
    const accounts = await verifyExistingAccounts(settings);
    await expect(accounts.close()).rejects.toThrow(/session cleanup failed/);
    expect(primary.auth.signOut).toHaveBeenCalledOnce();
    expect(secondary.auth.signOut).toHaveBeenCalledOnce();
});
