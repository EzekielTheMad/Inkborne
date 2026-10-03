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

it("uses only the selected existing secondary account for browser isolation checks", async () => {
    const settings = { E2E_TEST_EMAIL: "owner@example.invalid", E2E_TEST_PASSWORD: "owner-placeholder",
        E2E_PLAYER_EMAIL: "viewer@example.invalid", E2E_PLAYER_PASSWORD: "viewer-placeholder" } as RunnerSettings;
    const email = vi.fn(async () => {});
    const password = vi.fn(async () => {});
    const page = { goto: vi.fn(async () => {}),
        getByLabel: vi.fn((label: string) => ({ fill: label === "Email" ? email : password })),
        getByRole: vi.fn(() => ({ click: vi.fn(async () => {}) })),
        waitForURL: vi.fn(async () => {}) } as unknown as Page;
    await browserLogin(page, settings, "secondary");
    expect(email).toHaveBeenCalledWith(settings.E2E_PLAYER_EMAIL);
    expect(password).toHaveBeenCalledWith(settings.E2E_PLAYER_PASSWORD);
    expect(email).not.toHaveBeenCalledWith(settings.E2E_TEST_EMAIL);
    expect(password).not.toHaveBeenCalledWith(settings.E2E_TEST_PASSWORD);
});
