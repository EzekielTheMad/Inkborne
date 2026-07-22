import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CompendiumDetail } from "@/components/compendium/compendium-detail";
import type { CompendiumEntry } from "@/lib/compendium/types";

describe("CompendiumDetail", () => {
  it("renders a read-only structured rule view with provenance", () => {
    const entry: CompendiumEntry = {
      id: "11111111-1111-4111-8111-111111111111",
      system_id: "22222222-2222-4222-8222-222222222222",
      name: "Ward of Embers",
      slug: "ward-of-embers",
      content_type: "magic_item",
      version: 4,
      source: "homebrew",
      scope: "shared",
      owner_id: "33333333-3333-4333-8333-333333333333",
      data: {
        rarity: "Rare",
        description: "A bronze ring that warms near danger.",
        requires_attunement: true,
      },
      effects: [],
    };

    render(
      <CompendiumDetail
        entry={entry}
        userId="44444444-4444-4444-8444-444444444444"
        returnHref="/library?category=items"
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Ward of Embers" })).toBeVisible();
    expect(screen.getByText("Campaign shared")).toBeVisible();
    expect(screen.getByText("Version 4")).toBeVisible();
    expect(screen.getByText("A bronze ring that warms near danger.")).toBeVisible();
    expect(screen.getByText("Required")).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to Library" })).toHaveAttribute(
      "href",
      "/library?category=items",
    );
    expect(screen.getByText(/read-only/i)).toBeVisible();
  });
});
