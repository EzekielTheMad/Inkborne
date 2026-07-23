import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  listSystems: vi.fn(),
  listEntries: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("@/lib/supabase/compendium-server", () => ({
  listCompendiumSystems: mocks.listSystems,
  listCompendiumEntries: mocks.listEntries,
}));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

import LibraryPage from "@/app/(app)/library/page";

const systemId = "22222222-2222-4222-8222-222222222222";

describe("LibraryPage", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.listSystems.mockReset();
    mocks.listEntries.mockReset();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-id" } }, error: null });
    mocks.listSystems.mockResolvedValue([
      { id: systemId, name: "D&D 5th Edition", slug: "dnd5e", versionLabel: "2014" },
    ]);
    mocks.listEntries.mockResolvedValue({ entries: [], total: 0, page: 1, pageSize: 24 });
    mocks.redirect.mockReset();
  });

  it("uses the published system and renders the player/DM compendium", async () => {
    render(await LibraryPage({ searchParams: Promise.resolve({ category: "armor" }) }));

    expect(mocks.listEntries).toHaveBeenCalledWith(
      expect.objectContaining({
        system: systemId,
        category: "armor",
        page: 1,
      }),
      "user-id",
    );
    expect(screen.getByRole("heading", { level: 1, name: "Library" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "Armor" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Open Homebrew" })).toHaveAttribute("href", "/homebrew");
  });

  it("shows a safe empty state when no system is published", async () => {
    mocks.listSystems.mockResolvedValue([]);

    render(await LibraryPage({ searchParams: Promise.resolve({}) }));

    expect(mocks.listEntries).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Library unavailable" })).toBeVisible();
  });
});
