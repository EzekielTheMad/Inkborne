import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SpellRow } from "@/components/sheet/spells/spell-row";
import type { CharacterSpell } from "@/lib/types/spells";

const homebrewSpell: CharacterSpell = {
  id: "spell-row",
  character_id: "character-id",
  content_id: "content-id",
  content_version: 2,
  name: "Ember Thread",
  class_slug: "wizard",
  is_known: true,
  is_prepared: false,
  always_prepared: false,
  in_spellbook: true,
  source: "selection",
  custom_data: null,
  created_at: "2026-07-20T00:00:00Z",
  content_definitions: {
    id: "content-id",
    content_type: "spell",
    slug: "ember-thread",
    name: "Ember Thread",
    data: {
      level: 1,
      school: "evocation",
      components: ["V", "S"],
      description: "A bright strand of fire lashes out.",
    },
    effects: [],
    source: "homebrew",
    version: 2,
  },
};

describe("SpellRow", () => {
  it("shows the immutable version pinned for a homebrew spell", () => {
    render(
      <SpellRow
        spell={homebrewSpell}
        allowPrepareToggle={false}
        onTogglePrepared={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText("Homebrew · v2")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /ember thread/i }));
    expect(screen.getByText("A bright strand of fire lashes out.")).toBeVisible();
  });
});
