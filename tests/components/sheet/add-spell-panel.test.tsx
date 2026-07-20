import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AddSpellPanel } from "@/components/sheet/spells/add-spell-panel";
import { searchSpells } from "@/lib/supabase/spells";

vi.mock("@/lib/supabase/spells", () => ({
  searchSpells: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/character/character-context", () => ({
  useSpells: () => ({
    casterInfo: {
      isCaster: true,
      classes: [],
      spellDc: 10,
      spellAttackBonus: 2,
    },
    maxSlots: {},
    addSpell: vi.fn(),
    removeSpell: vi.fn(),
    spells: [],
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
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
});
