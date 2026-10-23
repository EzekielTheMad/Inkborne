import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClassSpellsPanel } from "@/components/builder/class-spells-panel";
import type { EffectiveCastingSource } from "@/lib/spells/effective-sources";
import type { ContentEntry } from "@/components/builder/content-browser";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/builder/use-save-navigation-guard", () => ({ useSaveNavigationGuard: () => ({ notice: null, setBlocked: vi.fn() }) }));
const source: EffectiveCastingSource = { classSlug: "wizard", classLevel: 20, kind: "class",
  parentPin: { contentId: "class", version: 1 }, active: true, config: { type: "full", ability: "intelligence" },
  cantripsKnown: 0, spellsKnown: "all", prepared: true, preparationRule: "parent", spellList: { class: "wizard", level: [0, 9] },
  directSlots: [4, 3, 3, 3, 3, 2, 2, 1, 1], maxLearnableLevel: 9 };
const spell: ContentEntry = { id: "00000000-0000-4000-8000-000000000001", version: 1, content_type: "spell",
  slug: "fireball", name: "Fireball", effects: [], source: "srd", data: { classes: ["wizard"], level: 3 } };

describe("Wizard Signature preparation intent", () => {
  it("keeps always-prepared projection out of the ordinary prepared intent and allowance", async () => {
    const saveAction = vi.fn().mockResolvedValue({ choices: {}, scores: {}, action_revision: "2" });
    render(<ClassSpellsPanel source={source} catalog={[spell]} selected={[{
      content_id: spell.id, content_version: 1, is_prepared: true, always_prepared: true, prepared_intent: false,
    }]} abilityScores={{ intelligence: 16 }} saveAction={saveAction} />);
    expect(screen.getByText("Prepared spells: 0 / 23. Always-prepared feature spells do not use this allowance.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Prepare Fireball")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save spells" }));
    await waitFor(() => expect(saveAction).toHaveBeenCalledWith("select_class_spells", { class_slug: "wizard",
      spells: [{ content_id: spell.id, content_version: 1, prepared: false }] }));
  });

  it("retains an exact saved book version when another class uses the current version", async () => {
    const saveAction = vi.fn().mockResolvedValue({ choices: {}, scores: {}, action_revision: "2" });
    render(<ClassSpellsPanel source={source} catalog={[{ ...spell, version: 2 }, spell]} selected={[{
      content_id: spell.id, content_version: 1, is_prepared: false,
    }]} abilityScores={{ intelligence: 16 }} saveAction={saveAction} />);
    expect(screen.getByLabelText("Select Fireball")).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Save spells" }));
    await waitFor(() => expect(saveAction).toHaveBeenCalledWith("select_class_spells", { class_slug: "wizard",
      spells: [{ content_id: spell.id, content_version: 1, prepared: false }] }));
  });
});
