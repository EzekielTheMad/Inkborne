import { describe, expect, it } from "vitest";
import { notFound, redirect } from "next/navigation";
import { guardMonsterActionResponse, MONSTER_ACTION_UNCERTAIN_MESSAGE } from "@/lib/homebrew/monster-action-response";

describe("guarded monster client action response", () => {
  it.each([{ status: "idle", message: "No changes to save." }, { status: "error", message: "Invalid field.", fieldErrors: { name: ["Name is required."] } },
    { status: "conflict", message: "Reload latest." }])("retains legitimate bounded response $status", async (response) => {
    expect(await guardMonsterActionResponse(async () => response)).toEqual(response);
  });
  it.each([{ response: undefined }, { response: null }, { response: [] }, { response: "saved" }, { response: { status: "saved", id: "unknown" } },
    { response: { status: "error" } }, { response: { status: "error", message: "Error", fieldErrors: { name: "bad" } } },
    { response: { status: "idle", message: "No-op", owner_id: "forged" } }])("refuses missing/malformed response $response", async ({ response }) => {
    expect(await guardMonsterActionResponse(async () => response)).toEqual({ status: "error", message: MONSTER_ACTION_UNCERTAIN_MESSAGE });
  });
  it("bounds errors and ignores rejected transport details without claiming rollback", async () => {
    expect(await guardMonsterActionResponse(async () => { throw new Error("Untrusted transport body."); })).toEqual({ status: "error", message: MONSTER_ACTION_UNCERTAIN_MESSAGE });
    expect(await guardMonsterActionResponse(async () => ({ status: "error", message: "x".repeat(1_001) }))).toMatchObject({ message: MONSTER_ACTION_UNCERTAIN_MESSAGE });
  });
  it.each([{ navigate: () => redirect("/login") }, { navigate: () => notFound() }])("rethrows actual installed framework navigation without swallowing it", async ({ navigate }) => {
    let navigationError: unknown;
    try { navigate(); } catch (error) { navigationError = error; }
    expect(navigationError).toBeInstanceOf(Error);
    await expect(guardMonsterActionResponse(async () => { throw navigationError; })).rejects.toBe(navigationError);
    await expect(guardMonsterActionResponse(async () => { throw new Error("Nested wrapper", { cause: navigationError }); })).rejects.toBe(navigationError);
  });
  it("does not treat a misleading message or incomplete digest as genuine navigation", async () => {
    const error = Object.assign(new Error("NEXT_REDIRECT;"), { digest: "NEXT_REDIRECT;broken" });
    expect(await guardMonsterActionResponse(async () => { throw error; })).toEqual({ status: "error", message: MONSTER_ACTION_UNCERTAIN_MESSAGE });
  });
});
