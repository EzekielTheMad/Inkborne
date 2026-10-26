import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClassSpellsPanel } from "@/components/builder/class-spells-panel";
import type { ContentEntry } from "@/components/builder/content-browser";
import type { EffectiveCastingSource } from "@/lib/spells/effective-sources";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/builder/use-save-navigation-guard", () => ({ useSaveNavigationGuard: () => ({ notice: null, setBlocked: vi.fn() }) }));
const source: EffectiveCastingSource = { classSlug: "cleric", classLevel: 1, kind: "class", parentPin: { contentId: "class", version: 1 },
  active: true, config: { type: "full", ability: "wisdom" }, cantripsKnown: 1, spellsKnown: "all", prepared: true,
  preparationRule: "parent", spellList: { class: "cleric", level: [0, 9] }, directSlots: [2], maxLearnableLevel: 1 };
function spell(index: number, level: number, name = `Spell ${index}`): ContentEntry {
  return { id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`, version: 1, slug: `spell-${index}`, name,
    content_type: "spell", effects: [], source: "srd", data: { level, classes: ["cleric"] } };
}
const cantrip = spell(1, 0), otherCantrip = spell(2, 0), first = spell(3, 1), second = spell(4, 1);
const pin = (entry: ContentEntry, prepared = false) => ({ content_id: entry.id, content_version: entry.version, is_prepared: prepared });

describe("class spell dropdown eligibility and allowances", () => {
  it("offers no acquisition slot at the global 200-spell limit", () => {
    const catalog = Array.from({ length: 200 }, (_, index) => spell(index + 10, 1));
    render(<ClassSpellsPanel source={source} catalog={[...catalog, cantrip]} selected={catalog.map(entry => pin(entry))}
      abilityScores={{ wisdom: 16 }} saveAction={vi.fn()} />);
    expect(screen.queryByRole("combobox", { name: /^Add cleric/ })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Cleric levelled spells 1" })).toBeEnabled();
  });
  it("offers only unselected, earned spells and cannot add over the cantrip allowance", () => {
    render(<ClassSpellsPanel source={source} catalog={[cantrip, otherCantrip, first, spell(5, 2)]} selected={[]}
      abilityScores={{ wisdom: 8 }} saveAction={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Add cleric cantrips" }), { target: { value: `${cantrip.id}:1` } });
    expect(screen.queryByRole("combobox", { name: "Add cleric cantrips" })).not.toBeInTheDocument();
    expect(screen.getByText("Cantrips: 1 / 1")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Spell 5/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    const row = screen.getByRole("combobox", { name: "Cleric cantrips 1" });
    row.focus();
    fireEvent.change(row, { target: { value: `${otherCantrip.id}:1` } });
    expect(row).toBeInTheDocument();
    expect(row).toHaveFocus();
    expect(screen.getByRole("combobox", { name: "Cleric cantrips 1" })).toHaveValue(`${otherCantrip.id}:1`);
  });

  it("prevents additional preparation at its limit without preventing unprepared picks", async () => {
    const saveAction = vi.fn().mockResolvedValue({ choices: {}, scores: {}, action_revision: "2" });
    render(<ClassSpellsPanel source={source} catalog={[first, second]} selected={[pin(first, true)]}
      abilityScores={{ wisdom: 8 }} saveAction={saveAction} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Add cleric levelled spells" }), { target: { value: `${second.id}:1` } });
    expect(screen.getByText("Prepared spells: 1 / 1. Always-prepared feature spells do not use this allowance.")).toBeInTheDocument();
    const otherPreparation = screen.getByRole("combobox", { name: `Prepare ${second.name}` });
    expect(within(otherPreparation).queryByRole("option", { name: "Prepared" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: `Prepare ${first.name}` }), { target: { value: "not-prepared" } });
    fireEvent.change(otherPreparation, { target: { value: "prepared" } });
    fireEvent.click(screen.getByRole("button", { name: "Save spells" }));
    await waitFor(() => expect(saveAction).toHaveBeenCalledWith("select_class_spells", { class_slug: "cleric", spells: [
      { content_id: first.id, content_version: 1, prepared: false }, { content_id: second.id, content_version: 1, prepared: true },
    ] }));
  });

  it("preserves a failed draft and blocks editing after its saved source changes", async () => {
    const saveAction = vi.fn().mockRejectedValue(new Error("lost response"));
    const { rerender } = render(<ClassSpellsPanel source={source} catalog={[first, second]} selected={[]}
      abilityScores={{ wisdom: 16 }} saveAction={saveAction} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Add cleric levelled spells" }), { target: { value: `${first.id}:1` } });
    fireEvent.click(screen.getByRole("button", { name: "Save spells" }));
    await screen.findByText(/These spell choices could not be confirmed/);
    expect(screen.getByRole("combobox", { name: "Cleric levelled spells 1" })).toHaveValue(`${first.id}:1`);
    rerender(<ClassSpellsPanel source={{ ...source, classLevel: 2 }} catalog={[first, second]} selected={[]}
      abilityScores={{ wisdom: 16 }} saveAction={saveAction} />);
    expect(screen.getByText(/The saved class or spell choices changed/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Cleric levelled spells 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save spells" })).toBeDisabled();
  });

  it("keeps a full Wizard spellbook editable without an extra acquisition slot", () => {
    const book = Array.from({ length: 7 }, (_, index) => ({ ...spell(index + 10, 1), data: { level: 1, classes: ["wizard"] } }));
    render(<ClassSpellsPanel source={{ ...source, classSlug: "wizard", cantripsKnown: 0, config: { type: "full", ability: "intelligence" }, spellList: { class: "wizard", level: [0, 9] } }}
      catalog={book} selected={book.slice(0, 6).map(entry => pin(entry))} abilityScores={{ intelligence: 16 }} saveAction={vi.fn()} />);
    expect(screen.getByText("Spellbook: 6 / 6 spells")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Add wizard levelled spells" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("combobox", { name: "Wizard levelled spells 1" })).getByRole("option", { name: /Spell 16/ })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Wizard levelled spells 1" }), { target: { value: "" } });
    expect(screen.getByText("Spellbook: 5 / 6 spells")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Add wizard levelled spells" })).toBeInTheDocument();
  });

  it("keeps unavailable saved versions visibly locked instead of offering a replacement", () => {
    render(<ClassSpellsPanel source={source} catalog={[{ ...first, version: 2 }]} selected={[pin(first)]}
      abilityScores={{ wisdom: 16 }} saveAction={vi.fn()} />);
    expect(screen.getByText(/saved spell version\(s\) are unavailable/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save spells" })).toBeDisabled();
    expect(screen.queryByRole("option", { name: /Spell 3/ })).not.toBeInTheDocument();
  });
});
