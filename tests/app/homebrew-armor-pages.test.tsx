import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), getOwned: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/supabase/homebrew-armors-server", () => ({ getOwnedHomebrewArmor: mocks.getOwned }));
vi.mock("@/components/library/armor-form", () => ({ ArmorForm: ({ mode, initialValue }: { mode: string; initialValue?: { name: string; version: number } }) =>
  <p>{mode} form {initialValue?.name} {initialValue?.version}</p> }));

import NewHomebrewArmorPage from "@/app/(app)/homebrew/armors/new/page";
import EditHomebrewArmorPage from "@/app/(app)/homebrew/armors/[id]/edit/page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
});

describe("private armor routes", () => {
  it("authenticates creation and offers the real form boundary", async () => {
    render(await NewHomebrewArmorPage());
    expect(screen.getByRole("heading", { name: "Create armor" })).toBeVisible();
    expect(screen.getByText("create form")).toBeVisible();
  });
  it("redirects a failed authentication before loading armor", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: new Error("expired") });
    await expect(EditHomebrewArmorPage({ params: Promise.resolve({ id: "armor" }) })).rejects.toThrow("REDIRECT:/login");
    expect(mocks.getOwned).not.toHaveBeenCalled();
  });
  it("returns not found when the owned active private armor is unavailable", async () => {
    mocks.getOwned.mockResolvedValue(null);
    await expect(EditHomebrewArmorPage({ params: Promise.resolve({ id: "armor" }) })).rejects.toThrow("NOT_FOUND");
    expect(mocks.getOwned).toHaveBeenCalledWith("armor");
  });
  it("passes the owned latest version to editing without changing character pins", async () => {
    mocks.getOwned.mockResolvedValue({ id: "armor", name: "Lantern", version: 3, data: {} });
    render(await EditHomebrewArmorPage({ params: Promise.resolve({ id: "armor" }) }));
    expect(screen.getByText("edit form Lantern 3")).toBeVisible();
    expect(screen.getByText(/Existing character inventory pins keep their saved version/)).toBeVisible();
  });
});
