import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), getOwned: vi.fn(),
  redirect: vi.fn((url: string) => { throw Error(`REDIRECT:${url}`); }), notFound: vi.fn(() => { throw Error("NOT_FOUND"); }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/supabase/homebrew-traits-server", () => ({ getOwnedHomebrewTrait: mocks.getOwned }));
vi.mock("@/components/library/trait-form", () => ({ TraitForm: ({ mode, initialValue }: { mode: string; initialValue?: { name: string; version: number; resourceEditable: boolean } }) =>
  <p>{mode} form {initialValue?.name} {initialValue?.version} {initialValue?.resourceEditable === false ? "locked" : "editable"}</p> }));
import NewHomebrewTraitPage from "@/app/(app)/homebrew/traits/new/page";
import EditHomebrewTraitPage from "@/app/(app)/homebrew/traits/[id]/edit/page";
beforeEach(() => { vi.clearAllMocks(); mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null }); });
describe("private trait routes", () => {
  it("authenticates the new form page", async () => {
    render(await NewHomebrewTraitPage()); expect(screen.getByRole("heading", { name: "Create private trait" })).toBeVisible(); expect(screen.getByText("create form editable")).toBeVisible();
  });
  it("redirects expired/absent authentication before any trait read", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null }); await expect(NewHomebrewTraitPage()).rejects.toThrow("REDIRECT:/login");
    mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: Error("expired") });
    await expect(EditHomebrewTraitPage({ params: Promise.resolve({ id: "unavailable" }) })).rejects.toThrow("REDIRECT:/login"); expect(mocks.getOwned).not.toHaveBeenCalled();
  });
  it("returns not found for an unavailable scoped trait", async () => {
    mocks.getOwned.mockResolvedValue(null); await expect(EditHomebrewTraitPage({ params: Promise.resolve({ id: "unavailable" }) })).rejects.toThrow("NOT_FOUND");
  });
  it("passes latest owner version and server-derived locked controls without touching pins", async () => {
    mocks.getOwned.mockResolvedValue({ id: "trait", name: "Lantern", version: 3, data: { description: "Original synthetic text." }, resourceEditable: false });
    render(await EditHomebrewTraitPage({ params: Promise.resolve({ id: "trait" }) }));
    expect(screen.getByText("edit form Lantern 3 locked")).toBeVisible(); expect(screen.getByText(/Existing character snapshots remain unchanged/)).toBeVisible();
  });
});
