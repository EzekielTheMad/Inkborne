import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), getOwned: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/supabase/homebrew-weapons-server", () => ({ getOwnedHomebrewWeapon: mocks.getOwned }));
vi.mock("@/components/library/weapon-form", () => ({ WeaponForm: ({ mode, initialValue }: { mode: string; initialValue?: { name: string; version: number } }) =>
  <p>{mode} form {initialValue?.name} {initialValue?.version}</p> }));

import NewHomebrewWeaponPage from "@/app/(app)/homebrew/weapons/new/page";
import EditHomebrewWeaponPage from "@/app/(app)/homebrew/weapons/[id]/edit/page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
});

describe("private weapon routes", () => {
  it("authenticates creation and offers the real form boundary", async () => {
    render(await NewHomebrewWeaponPage());
    expect(screen.getByRole("heading", { name: "Create a weapon" })).toBeVisible();
    expect(screen.getByText("create form")).toBeVisible();
  });
  it("redirects a failed authentication before loading a weapon", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: new Error("expired") });
    await expect(EditHomebrewWeaponPage({ params: Promise.resolve({ id: "weapon" }) })).rejects.toThrow("REDIRECT:/login");
    expect(mocks.getOwned).not.toHaveBeenCalled();
  });
  it("returns not found when the owned active private weapon is unavailable", async () => {
    mocks.getOwned.mockResolvedValue(null);
    await expect(EditHomebrewWeaponPage({ params: Promise.resolve({ id: "weapon" }) })).rejects.toThrow("NOT_FOUND");
    expect(mocks.getOwned).toHaveBeenCalledWith("weapon");
  });
  it("passes the owned latest version to editing without changing character pins", async () => {
    mocks.getOwned.mockResolvedValue({ id: "weapon", name: "Lantern", version: 3, data: {} });
    render(await EditHomebrewWeaponPage({ params: Promise.resolve({ id: "weapon" }) }));
    expect(screen.getByText("edit form Lantern 3")).toBeVisible();
    expect(screen.getByText(/Existing character inventory pins keep their saved version/)).toBeVisible();
  });
});
