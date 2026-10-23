import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClassSpellsPanel } from "@/components/builder/class-spells-panel";
import type { ContentEntry } from "@/components/builder/content-browser";
import type { EffectiveCastingSource } from "@/lib/spells/effective-sources";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/builder/use-save-navigation-guard", () => ({ useSaveNavigationGuard: () => ({ notice: null, setBlocked: vi.fn() }) }));

const source: EffectiveCastingSource = { classSlug: "warlock", classLevel: 1, kind: "class", subclassSlug: "fiend",
  parentPin: { contentId: "warlock", version: 1 }, subclassPin: { contentId: "fiend", version: 1 },
  active: true, config: { type: "pact", ability: "charisma" }, cantripsKnown: 0, spellsKnown: 2,
  prepared: false, preparationRule: "parent", spellList: { class: "warlock", level: [0, 5] },
  directSlots: [1], maxLearnableLevel: 1, expandedSpellSlugs: ["burning-hands", "scorching-ray"],
  expandedSpellSource: { system_id: "system", source: "srd", scope: "srd", owner_id: null } };

function spell(index: number, slug: string, name: string, level: number, classes: string[]): ContentEntry {
  return { id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`, version: 1, slug, name,
    content_type: "spell", source: "srd", system_id: "system", scope: "srd", owner_id: null, effects: [], data: { level, classes } };
}
const burningHands = spell(1, "burning-hands", "Burning Hands", 1, ["sorcerer", "wizard"]);
const hellishRebuke = spell(2, "hellish-rebuke", "Hellish Rebuke", 1, ["warlock"]);
const armor = spell(3, "armor-of-agathys", "Armor of Agathys", 1, ["warlock"]);
const catalog = [burningHands, hellishRebuke, armor,
  spell(4, "scorching-ray", "Scorching Ray", 2, ["sorcerer", "wizard"]),
  spell(5, "magic-missile", "Magic Missile", 1, ["sorcerer", "wizard"]),
  spell(6, "sacred-flame", "Sacred Flame", 0, ["cleric"])];
const scores = { charisma: 16 };

describe("Fiend expanded spell choices", () => {
  it("learns an earned off-list spell through the ordinary known allowance", async () => {
    const saveAction = vi.fn().mockResolvedValue({ choices: {}, scores, action_revision: "2" });
    render(<ClassSpellsPanel source={source} catalog={catalog} selected={[]} abilityScores={scores} saveAction={saveAction} />);
    expect(screen.getByText("Your patron's expanded spells are available below. They count toward your spells-known allowance.")).toBeInTheDocument();
    expect(screen.getByText("Expanded list")).toBeInTheDocument();
    expect(screen.queryByLabelText("Select Scorching Ray")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Select Magic Missile")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Select Sacred Flame")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Select Burning Hands"));
    fireEvent.click(screen.getByLabelText("Select Hellish Rebuke"));
    expect(screen.getByText("Spells known: 2 / 2")).toBeInTheDocument();
    expect(screen.queryByLabelText("Prepare Burning Hands")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Select Armor of Agathys"));
    expect(screen.getByText("Spells known: 3 / 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save spells" })).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Select Armor of Agathys"));
    fireEvent.click(screen.getByRole("button", { name: "Save spells" }));
    await waitFor(() => expect(saveAction).toHaveBeenCalledWith("select_class_spells", { class_slug: "warlock", spells: [
      { content_id: burningHands.id, content_version: 1, prepared: false },
      { content_id: hellishRebuke.id, content_version: 1, prepared: false },
    ] }));
  });

  it("reloads the exact saved expanded spell and adopts confirmed patron-loss pruning", () => {
    const saveAction = vi.fn();
    const selected = [{ content_id: burningHands.id, content_version: 1, is_prepared: false },
      { content_id: hellishRebuke.id, content_version: 1, is_prepared: false }];
    const { rerender } = render(<ClassSpellsPanel source={source} catalog={catalog} selected={selected}
      abilityScores={scores} saveAction={saveAction} />);
    expect(screen.getByLabelText("Select Burning Hands")).toBeChecked();
    expect(screen.getByLabelText("Select Hellish Rebuke")).toBeChecked();
    rerender(<ClassSpellsPanel source={{ ...source, expandedSpellSlugs: [], subclassSlug: undefined, subclassPin: undefined }}
      catalog={catalog} selected={[selected[1]]} abilityScores={scores} saveAction={saveAction} />);
    expect(screen.queryByLabelText("Select Burning Hands")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Select Hellish Rebuke")).toBeChecked();
    expect(screen.getByText("Spells known: 1 / 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save spells" })).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
