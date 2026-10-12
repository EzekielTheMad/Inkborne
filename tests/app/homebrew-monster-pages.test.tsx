import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), getOwned: vi.fn(), redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }), notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/supabase/homebrew-monsters-server", () => ({ getOwnedHomebrewMonster: mocks.getOwned }));
vi.mock("@/components/library/monster-form", () => ({ MonsterForm: ({ mode, initialValue }: { mode: string; initialValue?: { name: string; version: number } }) => <p>{mode} form {initialValue?.name} {initialValue?.version}</p> }));
import NewMonsterPage from "@/app/(app)/homebrew/monsters/new/page";
import EditMonsterPage from "@/app/(app)/homebrew/monsters/[id]/edit/page";
beforeEach(() => { vi.clearAllMocks(); mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null }); });
describe("private monster pages", () => {
  it("offers authenticated structured creation", async () => { render(await NewMonsterPage()); expect(screen.getByRole("heading", { name: "Create a monster" })).toBeVisible(); expect(screen.getByText("create form")).toBeVisible(); });
  it("redirects authentication failure before owned lookup", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null }); await expect(EditMonsterPage({ params: Promise.resolve({ id: "foreign" }) })).rejects.toThrow("REDIRECT:/login"); expect(mocks.getOwned).not.toHaveBeenCalled();
  });
  it("returns not found for inaccessible/malformed/missing ID", async () => { mocks.getOwned.mockResolvedValue(null); await expect(EditMonsterPage({ params: Promise.resolve({ id: "foreign" }) })).rejects.toThrow("NOT_FOUND"); });
  it("refuses unsupported format/load failure without a form", async () => {
    mocks.getOwned.mockRejectedValue(new Error("unsupported")); render(await EditMonsterPage({ params: Promise.resolve({ id: "fixture" }) }));
    expect(screen.getByRole("alert")).toHaveTextContent("No changes were saved"); expect(screen.queryByText(/edit form/)).not.toBeInTheDocument();
  });
  it("passes only returned control DTO and exact version to editing", async () => {
    mocks.getOwned.mockResolvedValue({ id: "fixture", name: "Original", version: 3, data: {} }); render(await EditMonsterPage({ params: Promise.resolve({ id: "fixture" }) }));
    expect(screen.getByText("edit form Original 3")).toBeVisible(); expect(mocks.getOwned).toHaveBeenCalledWith("fixture");
  });
});
