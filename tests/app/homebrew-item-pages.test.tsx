import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), getOwned: vi.fn(), getCampaignAccess: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/supabase/homebrew-items-server", () => ({ getOwnedHomebrewItem: mocks.getOwned, getHomebrewItemCampaignAccess: mocks.getCampaignAccess }));
vi.mock("@/components/library/item-form", () => ({ ItemForm: ({ mode, initialValue }: { mode: string; initialValue?: { name: string; version: number } }) =>
  <p>{mode} form {initialValue?.name} {initialValue?.version}</p> }));
// This suite checks route admission/prop forwarding. The separate edit-page
// suite renders the actual ItemForm and ItemSharingPanel with modeled transport.
vi.mock("@/components/library/item-sharing-panel", () => ({ ItemSharingPanel: ({ contentId, version, scope, sharedCampaignCount }: { contentId: string; version: number; scope: string; sharedCampaignCount: number }) =>
  <p>sharing form {contentId} {version} {scope} {sharedCampaignCount}</p> }));

import NewHomebrewItemPage from "@/app/(app)/homebrew/items/new/page";
import EditHomebrewItemPage from "@/app/(app)/homebrew/items/[id]/edit/page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
  mocks.getCampaignAccess.mockResolvedValue({ campaigns: [], sharedCampaignCount: 0 });
});

describe("private item routes", () => {
  it("authenticates creation and offers the real form boundary", async () => {
    render(await NewHomebrewItemPage());
    expect(screen.getByRole("heading", { name: "Create an item" })).toBeVisible();
    expect(screen.getByText("create form")).toBeVisible();
  });
  it("redirects a failed authentication before loading an item", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: new Error("expired") });
    await expect(EditHomebrewItemPage({ params: Promise.resolve({ id: "item" }) })).rejects.toThrow("REDIRECT:/login");
    expect(mocks.getOwned).not.toHaveBeenCalled();
    expect(mocks.getCampaignAccess).not.toHaveBeenCalled();
  });
  it("returns not found when the owned active private item is unavailable", async () => {
    mocks.getOwned.mockResolvedValue(null);
    await expect(EditHomebrewItemPage({ params: Promise.resolve({ id: "item" }) })).rejects.toThrow("NOT_FOUND");
    expect(mocks.getOwned).toHaveBeenCalledWith("item");
    expect(mocks.getCampaignAccess).not.toHaveBeenCalled();
  });
  it("passes the owned latest version to editing without changing character pins", async () => {
    mocks.getOwned.mockResolvedValue({ id: "item", name: "Lantern", version: 3, scope: "personal", data: {} });
    render(await EditHomebrewItemPage({ params: Promise.resolve({ id: "item" }) }));
    expect(screen.getByText("edit form Lantern 3")).toBeVisible();
    expect(mocks.getCampaignAccess).toHaveBeenCalledWith("item");
    expect(screen.getByText("sharing form item 3 personal 0")).toBeVisible();
    expect(screen.getByText(/Existing character inventory pins keep their saved version/)).toBeVisible();
  });
});
