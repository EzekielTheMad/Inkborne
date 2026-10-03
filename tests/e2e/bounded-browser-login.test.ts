// @vitest-environment node
import { expect, it, vi } from "vitest";
import { type Page } from "@playwright/test";
import { browserLogin } from "@/e2e/bounded/browser-login";
import { type RunnerSettings } from "@/e2e/bounded/settings";
it("withholds credential call logs and closes its page before failure artifact capture", async () => {
    const settings = { E2E_TEST_EMAIL: "test@example.invalid", E2E_TEST_PASSWORD: "test-only-sensitive-value" } as RunnerSettings;
    const close = vi.fn(async () => { });
    const page = { goto: vi.fn(async () => { }), getByLabel: vi.fn((label: string) => ({ fill: vi.fn(async () => { if (label === "Password")
                throw new Error(`fill("${settings.E2E_TEST_PASSWORD}") timed out`); }) })), close } as unknown as Page;
    let failure: unknown;
    try {
        await browserLogin(page, settings);
    }
    catch (error) {
        failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect(String(failure)).not.toContain(settings.E2E_TEST_PASSWORD);
    expect(String(failure)).not.toContain(settings.E2E_TEST_EMAIL);
    expect(close).toHaveBeenCalledOnce();
});
