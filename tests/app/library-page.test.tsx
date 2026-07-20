import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listOwned: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase/homebrew-spells-server", () => ({
  listOwnedHomebrewSpells: mocks.listOwned,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import LibraryPage from "@/app/(app)/library/page";

const data = {
  level: 1,
  school: "evocation",
  classes: ["wizard"],
};

describe("LibraryPage", () => {
  it("shows private and campaign-counted shared spell badges", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-id" } }, error: null });
    mocks.listOwned.mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Private Spark",
        scope: "personal",
        version: 1,
        sharedCampaignCount: 0,
        data,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Shared Spark",
        scope: "shared",
        version: 3,
        sharedCampaignCount: 2,
        data,
      },
    ]);

    render(await LibraryPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("Private")).toBeVisible();
    expect(screen.getByText("Shared · 2 campaigns")).toBeVisible();
    expect(screen.getByText("My spells")).toBeVisible();
  });
});
