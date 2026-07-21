import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listOwnedSpells: vi.fn(),
  listOwnedFeats: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase/homebrew-spells-server", () => ({
  listOwnedHomebrewSpells: mocks.listOwnedSpells,
}));
vi.mock("@/lib/supabase/homebrew-feats-server", () => ({
  listOwnedHomebrewFeats: mocks.listOwnedFeats,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import LibraryPage from "@/app/(app)/library/page";

const spellData = {
  level: 1,
  school: "evocation",
  classes: ["wizard"],
};

describe("LibraryPage", () => {
  beforeEach(() => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-id" } }, error: null });
    mocks.listOwnedSpells.mockResolvedValue([]);
    mocks.listOwnedFeats.mockResolvedValue([]);
  });

  it("shows spell and feat sections with their versioned library links", async () => {
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

    render(await LibraryPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getAllByText("Private")).toHaveLength(2);
    expect(screen.getByText("Shared · 2 campaigns")).toBeVisible();
    expect(screen.getByText("My spells")).toBeVisible();
    expect(screen.getByText("My feats")).toBeVisible();
    expect(screen.getByRole("link", { name: /Fleet Adept/ })).toHaveAttribute(
      "href",
      "/library/feats/33333333-3333-4333-8333-333333333333/edit",
    );
    expect(screen.getByRole("link", { name: "Create feat" })).toHaveAttribute(
      "href",
      "/library/feats/new",
    );
    expect(screen.getByRole("link", { name: "Import MPMB" })).toHaveAttribute(
      "href",
      "/library/import",
    );
  });

  it("offers both authoring paths when the library is empty", async () => {
    render(await LibraryPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("Write your first private rule")).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Create spell" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Create feat" })).toHaveLength(2);
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

    render(await LibraryPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("Your homebrew spells could not be loaded.")).toBeVisible();
    expect(screen.getByText("Fleet Adept")).toBeVisible();
  });
});
