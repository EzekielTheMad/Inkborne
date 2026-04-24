import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("isAdminUserId", () => {
  const ORIGINAL_ENV = process.env.ADMIN_USER_IDS;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.ADMIN_USER_IDS;
    } else {
      process.env.ADMIN_USER_IDS = ORIGINAL_ENV;
    }
  });

  it("returns false when env var is unset", async () => {
    delete process.env.ADMIN_USER_IDS;
    const { isAdminUserId } = await import("@/lib/auth/is-admin");
    expect(isAdminUserId("some-uuid")).toBe(false);
  });

  it("returns false for null / undefined user ID", async () => {
    process.env.ADMIN_USER_IDS = "uuid-1,uuid-2";
    const { isAdminUserId } = await import("@/lib/auth/is-admin");
    expect(isAdminUserId(null)).toBe(false);
    expect(isAdminUserId(undefined)).toBe(false);
  });

  it("returns true for an ID in the comma-separated list", async () => {
    process.env.ADMIN_USER_IDS = "uuid-1,uuid-2,uuid-3";
    const { isAdminUserId } = await import("@/lib/auth/is-admin");
    expect(isAdminUserId("uuid-2")).toBe(true);
  });

  it("returns false for an ID not in the list", async () => {
    process.env.ADMIN_USER_IDS = "uuid-1,uuid-2";
    const { isAdminUserId } = await import("@/lib/auth/is-admin");
    expect(isAdminUserId("uuid-3")).toBe(false);
  });

  it("trims whitespace around IDs", async () => {
    process.env.ADMIN_USER_IDS = " uuid-1 , uuid-2 ";
    const { isAdminUserId } = await import("@/lib/auth/is-admin");
    expect(isAdminUserId("uuid-1")).toBe(true);
    expect(isAdminUserId("uuid-2")).toBe(true);
  });

  it("ignores empty entries", async () => {
    process.env.ADMIN_USER_IDS = "uuid-1,,uuid-2,";
    const { isAdminUserId } = await import("@/lib/auth/is-admin");
    expect(isAdminUserId("uuid-1")).toBe(true);
    expect(isAdminUserId("")).toBe(false);
  });
});
