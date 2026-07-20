import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AddSpellPanel } from "@/components/sheet/spells/add-spell-panel";
import { searchSpells } from "@/lib/supabase/spells";

const context = vi.hoisted(() => ({
  addSpell: vi.fn(),
  removeSpell: vi.fn(),
  spells: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/supabase/spells", () => ({
  searchSpells: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/character/character-context", () => ({
  useSpells: () => ({
    casterInfo: {
      isCaster: true,
      classes: [{
        slug: "wizard",
        level: 1,
        type: "full",
        ability: "intelligence",
        prepared: true,
        cantripsKnown: 3,
        spellsKnown: "all",
        maxPrepared: 2,
        ritualCasting: true,
      }],
      spellDc: 10,
      spellAttackBonus: 2,
    },
    maxSlots: { "1": 2 },
    addSpell: context.addSpell,
    removeSpell: context.removeSpell,
    spells: context.spells,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  context.spells = [];
  vi.mocked(searchSpells).mockResolvedValue([]);
});

describe("AddSpellPanel", () => {
  it("shows a retryable error when the content search fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(searchSpells).mockRejectedValueOnce({
      code: "42501",
      message: "permission denied",
    });

    render(
      <AddSpellPanel
        open
        onClose={() => {}}
        systemId="system-1"
      />,
    );

    expect(
      await screen.findByText(/spells could not be loaded/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    await waitFor(() => expect(errorSpy).toHaveBeenCalled());
    errorSpy.mockRestore();
  });

  it("adds an owned homebrew result with its exact current version", async () => {
    vi.mocked(searchSpells).mockResolvedValueOnce([{
      id: "11111111-1111-4111-8111-111111111111",
      name: "Ember Thread",
      slug: "ember-thread",
      content_type: "spell",
      version: 3,
      source: "homebrew",
      data: { level: 1, school: "evocation", ritual: false, concentration: false },
      effects: [],
    }]);

    render(<AddSpellPanel open onClose={() => {}} systemId="system-1" />);

    expect(await screen.findByText("Homebrew · v3")).toBeVisible();
    screen.getByRole("button", { name: "Add" }).click();

    await waitFor(() => {
      expect(context.addSpell).toHaveBeenCalledWith(expect.objectContaining({
        content_id: "11111111-1111-4111-8111-111111111111",
        content_version: 3,
      }));
    });
  });

  it("shows an older immutable pin without upgrading it", async () => {
    context.spells = [{
      id: "character-spell-id",
      content_id: "11111111-1111-4111-8111-111111111111",
      content_version: 1,
      class_slug: "wizard",
      always_prepared: false,
      content_definitions: { data: { level: 1 } },
    }];
    vi.mocked(searchSpells).mockResolvedValueOnce([{
      id: "11111111-1111-4111-8111-111111111111",
      name: "Ember Thread",
      slug: "ember-thread",
      content_type: "spell",
      version: 2,
      source: "homebrew",
      data: { level: 1, school: "evocation", ritual: false, concentration: false },
      effects: [],
    }]);

    render(<AddSpellPanel open onClose={() => {}} systemId="system-1" />);

    expect(await screen.findByText("Using v1")).toBeVisible();
    expect(context.addSpell).not.toHaveBeenCalled();
  });
});
