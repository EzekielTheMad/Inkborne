import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listOwnedSpells: vi.fn(),
  listOwnedFeats: vi.fn(),
  listOwnedBackgrounds: vi.fn(),
  listOwnedMagicItems: vi.fn(),
  listOwnedItems: vi.fn(),
  listOwnedWeapons: vi.fn(),
  listOwnedArmors: vi.fn(),
  listOwnedRaces: vi.fn(),
  listOwnedMonsters: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase/homebrew-spells-server", () => ({
  listOwnedHomebrewSpells: mocks.listOwnedSpells,
}));
vi.mock("@/lib/supabase/homebrew-feats-server", () => ({
  listOwnedHomebrewFeats: mocks.listOwnedFeats,
}));
vi.mock("@/lib/supabase/homebrew-backgrounds-server", () => ({
  listOwnedHomebrewBackgrounds: mocks.listOwnedBackgrounds,
}));
vi.mock("@/lib/supabase/homebrew-races-server", () => ({ listOwnedHomebrewRaces: mocks.listOwnedRaces }));
vi.mock("@/lib/supabase/homebrew-monsters-server", () => ({ listOwnedHomebrewMonsters: mocks.listOwnedMonsters }));
vi.mock("@/lib/supabase/homebrew-armors-server", () => ({ listOwnedHomebrewArmors: mocks.listOwnedArmors }));
vi.mock("@/lib/supabase/homebrew-weapons-server", () => ({ listOwnedHomebrewWeapons: mocks.listOwnedWeapons }));
vi.mock("@/lib/supabase/homebrew-items-server", () => ({ listOwnedHomebrewItems: mocks.listOwnedItems }));
vi.mock("@/lib/supabase/homebrew-magic-items-server", () => ({
  listOwnedHomebrewMagicItems: mocks.listOwnedMagicItems,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import HomebrewPage from "@/app/(app)/homebrew/page";

const spellData = {
  level: 1,
  school: "evocation",
  classes: ["wizard"],
};

describe("HomebrewPage", () => {
  beforeEach(() => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-id" } }, error: null });
    mocks.listOwnedSpells.mockResolvedValue([]);
    mocks.listOwnedFeats.mockResolvedValue([]);
    mocks.listOwnedBackgrounds.mockResolvedValue([]);
    mocks.listOwnedMagicItems.mockResolvedValue([]);
    mocks.listOwnedItems.mockResolvedValue([]);
    mocks.listOwnedWeapons.mockResolvedValue([]);
    mocks.listOwnedArmors.mockResolvedValue([]);
    mocks.listOwnedRaces.mockResolvedValue([]);
    mocks.listOwnedMonsters.mockResolvedValue([]);
  });

  it("shows each authoring section with its versioned homebrew links", async () => {
    mocks.listOwnedSpells.mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Private Spark",
        scope: "personal",
        version: 1,
        sharedCampaignCount: 0,
        data: spellData,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Shared Spark",
        scope: "shared",
        version: 3,
        sharedCampaignCount: 2,
        data: spellData,
      },
    ]);
    mocks.listOwnedFeats.mockResolvedValue([
      {
        id: "33333333-3333-4333-8333-333333333333",
        name: "Fleet Adept",
        scope: "personal",
        version: 2,
        data: { description: "You have learned to move with exceptional speed." },
      },
    ]);
    mocks.listOwnedBackgrounds.mockResolvedValue([
      {
        id: "44444444-4444-4444-8444-444444444444",
        name: "Lantern Courier",
        scope: "shared",
        version: 4,
        sharedCampaignCount: 1,
        data: {
          feature: { name: "Known Roads", description: "You remember hidden crossings." },
          skills: ["survival", "perception"],
        },
      },
    ]);
    mocks.listOwnedMagicItems.mockResolvedValue([
      {
        id: "55555555-5555-4555-8555-555555555555",
        name: "Oathbound Compass",
        scope: "personal",
        version: 2,
        data: {
          rarity: "Rare",
          description: "It points toward your last promise.",
          equipment_category: "Wondrous item",
          requires_attunement: true,
        },
      },
    ]);

    render(await HomebrewPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getAllByText("Private")).toHaveLength(3);
    expect(screen.getByText("Shared · 2 campaigns")).toBeVisible();
    expect(screen.getByText("My spells")).toBeVisible();
    expect(screen.getByText("My feats")).toBeVisible();
    expect(screen.getByText("My backgrounds")).toBeVisible();
    expect(screen.getByText("My magic items")).toBeVisible();
    expect(screen.getByText("Rare · Requires attunement")).toBeVisible();
    expect(screen.getByRole("link", { name: /Fleet Adept/ })).toHaveAttribute(
      "href",
      "/homebrew/feats/33333333-3333-4333-8333-333333333333/edit",
    );
    expect(screen.getByRole("link", { name: "Create feat" })).toHaveAttribute(
      "href",
      "/homebrew/feats/new",
    );
    expect(screen.getByRole("link", { name: "Create background" })).toHaveAttribute(
      "href",
      "/homebrew/backgrounds/new",
    );
    expect(screen.getByRole("link", { name: "Create magic item" })).toHaveAttribute(
      "href",
      "/homebrew/magic-items/new",
    );
    expect(screen.getByRole("link", { name: /Oathbound Compass/ })).toHaveAttribute(
      "href",
      "/homebrew/magic-items/55555555-5555-4555-8555-555555555555/edit",
    );
    expect(screen.getByRole("link", { name: /Oathbound Compass/ })).toHaveTextContent("v2");
    expect(screen.getByRole("link", { name: /Lantern Courier/ })).toHaveAttribute(
      "href",
      "/homebrew/backgrounds/44444444-4444-4444-8444-444444444444/edit",
    );
    expect(screen.getByRole("link", { name: "Import MPMB" })).toHaveAttribute(
      "href",
      "/homebrew/import",
    );
  });

  it("offers every authoring path when homebrew is empty", async () => {
    render(await HomebrewPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("Write your first private rule")).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Create spell" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Create feat" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Create background" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Create magic item" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Create item" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Create weapon" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Create armor" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Create race" })).toHaveLength(2);
  });

  it("keeps available content visible when one content type fails to load", async () => {
    mocks.listOwnedSpells.mockRejectedValue(new Error("spell read failed"));
    mocks.listOwnedFeats.mockResolvedValue([
      {
        id: "33333333-3333-4333-8333-333333333333",
        name: "Fleet Adept",
        scope: "personal",
        version: 2,
        data: { description: "Fast." },
      },
    ]);

    render(await HomebrewPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("Your homebrew spells could not be loaded.")).toBeVisible();
    expect(screen.getByText("Fleet Adept")).toBeVisible();
  });

  it("discovers private ordinary items and their editable version", async () => {
    mocks.listOwnedItems.mockResolvedValue([{ id: "66666666-6666-4666-8666-666666666666", name: "Folding Lantern", version: 2,
      data: { equipment_category: "Adventuring Gear", description: "A hinged lantern.", cost: { quantity: 2.5, unit: "gp" }, weight: 1.25 } }]);
    render(await HomebrewPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("My items")).toBeVisible();
    expect(screen.getByRole("link", { name: /Folding Lantern/ })).toHaveAttribute("href", "/homebrew/items/66666666-6666-4666-8666-666666666666/edit");
    expect(screen.getByRole("link", { name: /Folding Lantern/ })).toHaveTextContent("Privatev2");
    expect(screen.getByRole("link", { name: "Create item" })).toHaveAttribute("href", "/homebrew/items/new");
  });

  it("shows item read failure separately from empty content", async () => {
    mocks.listOwnedItems.mockRejectedValue(new Error("item read failed"));
    render(await HomebrewPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("Your homebrew items could not be loaded.")).toBeVisible();
    expect(screen.queryByText("Write your first private rule")).not.toBeInTheDocument();
  });

  it("discovers private weapons with their canonical damage and editable version", async () => {
    mocks.listOwnedWeapons.mockResolvedValue([{ id: "77777777-7777-4777-8777-777777777777", name: "Oathblade", version: 2,
      data: { weapon_category: "Martial", weapon_range: "Melee", damage: { dice: "1d8", type: "slashing" } } }]);
    render(await HomebrewPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("My weapons")).toBeVisible();
    expect(screen.getByText("Martial · Melee")).toBeVisible();
    expect(screen.getByText("1d8 slashing")).toBeVisible();
    expect(screen.getByRole("link", { name: /Oathblade/ })).toHaveAttribute("href", "/homebrew/weapons/77777777-7777-4777-8777-777777777777/edit");
    expect(screen.getByRole("link", { name: "Create weapon" })).toHaveAttribute("href", "/homebrew/weapons/new");
  });

  it("reports a private weapon read failure without calling it an empty catalog", async () => {
    mocks.listOwnedWeapons.mockRejectedValue(new Error("weapon read failed"));
    render(await HomebrewPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("Your homebrew weapons could not be loaded.")).toBeVisible();
    expect(screen.queryByText("Write your first private rule")).not.toBeInTheDocument();
  });

  it("discovers private armor and its editable version", async () => {
    mocks.listOwnedArmors.mockResolvedValue([{ id: "88888888-8888-4888-8888-888888888888", name: "Courier mail", version: 2,
      data: { armor_category: "Medium", armor_class: { base: 14, dex_bonus: true, max_bonus: 2 } } }]);
    render(await HomebrewPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("My armor")).toBeVisible();
    expect(screen.getByText("AC 14 + Dex (max +2)")).toBeVisible();
    expect(screen.getByRole("link", { name: /Courier mail/ })).toHaveAttribute("href", "/homebrew/armors/88888888-8888-4888-8888-888888888888/edit");
    expect(screen.getByRole("link", { name: "Create armor" })).toHaveAttribute("href", "/homebrew/armors/new");
  });

  it("reports armor read failure separately from an empty catalog", async () => {
    mocks.listOwnedArmors.mockRejectedValue(new Error("armor read failed"));
    render(await HomebrewPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("Your homebrew armor could not be loaded.")).toBeVisible();
    expect(screen.queryByText("Write your first private rule")).not.toBeInTheDocument();
  });
  it("discovers private core races and their editable versions", async () => {
    mocks.listOwnedRaces.mockResolvedValue([{ id: "99999999-9999-4999-8999-999999999999", name: "Aster Kin", version: 2,
      data: { size: "Medium", speed: 40, size_description: "Original size notes." } }]);
    render(await HomebrewPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("My races")).toBeVisible();
    expect(screen.getByText("Medium / Base speed: 40 ft.")).toBeVisible();
    expect(screen.getByRole("link", { name: /Aster Kin/ })).toHaveAttribute("href", "/homebrew/races/99999999-9999-4999-8999-999999999999/edit");
    expect(screen.getByRole("link", { name: "Create race" })).toHaveAttribute("href", "/homebrew/races/new");
  });
  it("reports race read failure separately from an empty catalog", async () => {
    mocks.listOwnedRaces.mockRejectedValue(new Error("race read failed"));
    render(await HomebrewPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("Your homebrew races could not be loaded.")).toBeVisible();
    expect(screen.queryByText("Write your first private rule")).not.toBeInTheDocument();
  });
  it("discovers private monsters with canonical view and editable version", async () => {
    mocks.listOwnedMonsters.mockResolvedValue([{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Original Kite", version: 2,
      data: { size: "Small", creature_type: "construct" } }]);
    render(await HomebrewPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("My monsters")).toBeVisible(); expect(screen.getByText("Small · construct")).toBeVisible();
    expect(screen.getByRole("link", { name: "Edit Original Kite" })).toHaveAttribute("href", "/homebrew/monsters/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/edit");
    expect(screen.getByRole("link", { name: "View stat block" })).toHaveAttribute("href", "/library/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(screen.getByRole("link", { name: "Create monster" })).toHaveAttribute("href", "/homebrew/monsters/new");
  });
  it("isolates an unsupported monster/load failure from other authoring families", async () => {
    mocks.listOwnedMonsters.mockRejectedValue(new Error("unsupported monster"));
    mocks.listOwnedWeapons.mockResolvedValue([{ id: "weapon", name: "Original Blade", version: 1, data: { weapon_category: "Simple", weapon_range: "Melee", damage: { dice: "1d4", type: "slashing" } } }]);
    render(await HomebrewPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("Your homebrew monsters could not be loaded.")).toBeVisible();
    expect(screen.getByText("Original Blade")).toBeVisible(); expect(screen.queryByText("Write your first private rule")).not.toBeInTheDocument();
  });
});
