import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CompendiumBrowser } from "@/components/compendium/compendium-browser";
import { parseCompendiumQuery } from "@/lib/compendium/catalog";
import type { CompendiumEntry } from "@/lib/compendium/types";

const systemId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";

function spell(overrides: Partial<CompendiumEntry>): CompendiumEntry {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    system_id: systemId,
    name: "Arcane Lantern",
    slug: "arcane-lantern",
    content_type: "spell",
    version: 1,
    source: "srd",
    scope: "platform",
    owner_id: null,
    data: {
      level: 1,
      school: "evocation",
      description: "A patient light follows the party.",
    },
    effects: [],
    ...overrides,
  };
}

describe("CompendiumBrowser", () => {
  it("shows the same accessible catalog with provenance and Homebrew separated", () => {
    const entries = [
      spell({}),
      spell({
        id: "44444444-4444-4444-8444-444444444444",
        name: "My Lantern",
        source: "homebrew",
        scope: "shared",
        owner_id: userId,
        version: 3,
      }),
      spell({
        id: "55555555-5555-4555-8555-555555555555",
        name: "Campaign Lantern",
        source: "homebrew",
        scope: "shared",
        owner_id: "66666666-6666-4666-8666-666666666666",
        version: 2,
      }),
    ];
    const query = {
      ...parseCompendiumQuery({ category: "spells", system: systemId }),
      system: systemId,
    };

    render(
      <CompendiumBrowser
        systems={[{ id: systemId, name: "D&D 5th Edition", slug: "dnd5e", versionLabel: "2014" }]}
        query={query}
        result={{ entries, total: 3, page: 1, pageSize: 24 }}
        userId={userId}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Library" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Open Homebrew" })).toHaveAttribute("href", "/homebrew");
    expect(screen.getAllByText("SRD")).toHaveLength(2);
    expect(screen.getByText("Your homebrew")).toBeVisible();
    expect(screen.getAllByText("Campaign shared")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /Campaign Lantern/ })).toHaveAttribute(
      "href",
      `/library/55555555-5555-4555-8555-555555555555?returnTo=${encodeURIComponent(
        `/library?system=${systemId}&category=spells`,
      )}`,
    );
    expect(screen.getByLabelText("Spell level")).toBeVisible();
    expect(screen.getByLabelText("School")).toBeVisible();
    expect(screen.getByLabelText("Ritual only")).toBeVisible();
  });

  it("keeps all eight initial categories reachable on narrow layouts", () => {
    const query = {
      ...parseCompendiumQuery({ category: "items", system: systemId }),
      system: systemId,
    };

    render(
      <CompendiumBrowser
        systems={[{ id: systemId, name: "D&D 5th Edition", slug: "dnd5e", versionLabel: "2014" }]}
        query={query}
        result={{ entries: [], total: 0, page: 1, pageSize: 24 }}
        userId={userId}
      />,
    );

    expect(screen.getByRole("navigation", { name: "Library categories" }))
      .toHaveClass("grid-cols-2");
    expect(screen.getAllByRole("link", { current: false }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Species / Races" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Armor" })).toBeVisible();
    expect(screen.getByLabelText("Rarity")).toBeVisible();
    expect(screen.getByLabelText("Magic item attunement")).toBeVisible();
    expect(screen.getByText("No matching rules")).toBeVisible();
  });
});
