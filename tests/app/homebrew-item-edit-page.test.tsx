import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ get: vi.fn(), access: vi.fn(), user: vi.fn() }));
vi.mock("@/lib/supabase/homebrew-items-server", () => ({ getOwnedHomebrewItem: mocks.get, getHomebrewItemCampaignAccess: mocks.access }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.user } }) }));
vi.mock("next/navigation", async importOriginal => ({ ...await importOriginal<typeof import("next/navigation")>(), redirect: (url: string) => { throw Error(`redirect:${url}`); }, notFound: () => { throw Error("not found"); } }));
vi.mock("@/app/(app)/homebrew/items/actions", () => ({ createHomebrewItem: vi.fn(), updateHomebrewItem: vi.fn(), toggleHomebrewItemCampaignShare: vi.fn() }));
import EditItemPage from "@/app/(app)/homebrew/items/[id]/edit/page";
import { CompendiumDetail } from "@/components/compendium/compendium-detail";
import { parseContentDefinition } from "@/lib/supabase/content-definitions-parser";
import type { CompendiumEntry } from "@/lib/compendium/types";
const item = { id: "33333333-3333-4333-8333-333333333333", name: "Original Lantern", version: 2, scope: "shared",
  data: { description: "Original equipment.", equipment_category: "Gear", cost: { quantity: 0, unit: "gp" }, weight: 0 } };
beforeEach(() => {
  vi.clearAllMocks(); mocks.user.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
  mocks.get.mockResolvedValue(item); mocks.access.mockResolvedValue({ campaigns: [{ id: "44444444-4444-4444-8444-444444444444", name: "Original Group", shared: true, eligible: false }], sharedCampaignCount: 1 });
});
describe("actual owned item edit page and real form/panel (Auth/DAL simulated)", () => {
  it.each(["platform", "personal", "shared"] as const)("actual Library detail preserves original %s item/version/provenance without an edit control", scope => {
    const ownerId = scope === "platform" ? null : "11111111-1111-4111-8111-111111111111";
    const definition = parseContentDefinition({ ...item, scope, system_id: "22222222-2222-4222-8222-222222222222", content_type: "item",
      slug: "original-lantern", effects: [], source: scope === "platform" ? "srd" : "homebrew", owner_id: ownerId });
    expect(definition).not.toBeNull();
    expect(definition).toMatchObject({ scope, system_id: "22222222-2222-4222-8222-222222222222", owner_id: ownerId });
    render(<CompendiumDetail entry={definition as CompendiumEntry} userId={scope === "personal" ? ownerId! : "99999999-9999-4999-8999-999999999999"} returnHref="/library?category=items" />);
    expect(screen.getByRole("heading", { name: item.name })).toBeVisible();
    expect(screen.getByText("Version 2")).toBeVisible();
    if (scope === "shared") expect(screen.getByText("Campaign shared")).toBeVisible();
    if (scope === "platform") expect(screen.getByText("SRD")).toBeVisible();
    if (scope === "personal") expect(screen.getByText("Your homebrew")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Save|Share/ })).toBeNull();
  });
  it("renders saved shared scope and exact version alongside unchanged item fields and removable former campaign", async () => {
    render(await EditItemPage({ params: Promise.resolve({ id: item.id }) }));
    expect(screen.getByText("Shared homebrew · version 2")).toBeVisible();
    expect(screen.getByLabelText("Name")).toHaveValue(item.name);
    expect(screen.getByRole("button", { name: "Stop sharing with Original Group" })).toBeEnabled();
    const pinNotices = screen.getAllByText(/Existing character inventory pins keep their saved version/);
    expect(pinNotices).toHaveLength(2);
    for (const notice of pinNotices) expect(notice).toBeVisible();
  });
  it("rejects a foreign/unavailable owned item before any campaign metadata read", async () => {
    mocks.get.mockResolvedValue(null);
    await expect(EditItemPage({ params: Promise.resolve({ id: item.id }) })).rejects.toThrow("not found"); expect(mocks.access).not.toHaveBeenCalled();
  });
  it("does not render an empty successful panel when campaign projection fails", async () => {
    mocks.access.mockRejectedValue(Error("Synthetic bounded projection unavailable"));
    await expect(EditItemPage({ params: Promise.resolve({ id: item.id }) })).rejects.toThrow("Synthetic bounded projection unavailable");
  });
});
