import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), getOwned: vi.fn(), redirect: vi.fn((url: string) => { throw new Error("REDIRECT:" + url); }), notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }) }));
vi.mock("next/navigation", async importOriginal => ({ ...await importOriginal<typeof import("next/navigation")>(), redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/supabase/homebrew-passive-features-server", () => ({ getOwnedHomebrewPassiveFeature: mocks.getOwned }));
vi.mock("@/components/library/passive-feature-form", () => ({ PassiveFeatureForm: ({ mode, initialValue }: { mode: string; initialValue?: { name: string; version: number } }) => <p>{mode} form {initialValue?.name} {initialValue?.version}</p> }));
import NewFeaturePage from "@/app/(app)/homebrew/features/new/page";
import EditFeaturePage from "@/app/(app)/homebrew/features/[id]/edit/page";
beforeEach(() => { vi.clearAllMocks(); mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null }); });
describe("private feature pages", () => {
  it("offers authenticated finite creation with unverified association copy", async () => { render(await NewFeaturePage()); expect(screen.getByRole("heading", { name: "Create a passive feature" })).toBeVisible(); expect(screen.getByText(/descriptive, unverified association/)).toBeVisible(); });
  it("signed-out/failed auth redirects before owned lookup", async () => { mocks.getUser.mockResolvedValue({ data: { user: null }, error: null }); await expect(EditFeaturePage({ params: Promise.resolve({ id: "foreign" }) })).rejects.toThrow("REDIRECT:/login"); expect(mocks.getOwned).not.toHaveBeenCalled(); });
  it("inaccessible/missing/malformed ID is not found", async () => { mocks.getOwned.mockResolvedValue(null); await expect(EditFeaturePage({ params: Promise.resolve({ id: "foreign" }) })).rejects.toThrow("NOT_FOUND"); });
  it("unsupported owned mechanics/effects produce read-only refusal without a form", async () => { mocks.getOwned.mockRejectedValue(new Error("Unsupported known data.")); render(await EditFeaturePage({ params: Promise.resolve({ id: "fixture" }) })); expect(screen.getByRole("alert")).toHaveTextContent("No changes were saved"); expect(screen.queryByText(/edit form/)).not.toBeInTheDocument(); });
  it("passes only owned text/association DTO with exact current version", async () => { mocks.getOwned.mockResolvedValue({ id: "fixture", name: "Original", version: 5, data: {} }); render(await EditFeaturePage({ params: Promise.resolve({ id: "fixture" }) })); expect(screen.getByText("edit form Original 5")).toBeVisible(); });
});
