import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BonusSpellsPanel } from "@/components/builder/bonus-spells-panel";
import type { ContentEntry } from "@/components/builder/content-browser";
import type { BonusSpellChoice } from "@/lib/builder/bonus-spells";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/builder/use-save-navigation-guard", () => ({ useSaveNavigationGuard: () => ({ notice: null, setBlocked: vi.fn() }) }));
const choice: BonusSpellChoice = { choice_id: "magical-secrets", choose: 2, min_spell_level: 0, max_spell_level: "class",
  list_class: null, ritual_only: false, spellbook_only: false, counts_known: true, always_prepared: false, mode: "known" };
const feature: ContentEntry = { id: "00000000-0000-4000-8000-000000000100", version: 1, slug: "magical-secrets",
  name: "Magical Secrets", content_type: "feature", source: "srd", effects: [], data: {} };
function spell(index: number, level: number, data: Record<string, unknown> = {}): ContentEntry {
  return { id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`, version: 1, slug: `spell-${index}`, name: `Spell ${index}`,
    content_type: "spell", source: "srd", effects: [], data: { level, classes: ["wizard"], ...data } };
}
const first = spell(1, 1), second = spell(2, 2), third = spell(3, 3), fourth = spell(4, 4);
const pin = (entry: ContentEntry) => ({ content_id: entry.id, content_version: entry.version });
const props = { feature, choice, catalog: [first, second, third, fourth], selected: [], spellbook: [], classMaxSpellLevel: 3,
  occupied: new Set<string>(), saveAction: vi.fn(), onSaved: vi.fn(), onDirtyChange: vi.fn() };

describe("bonus spell dropdowns", () => {
  it("offers only eligible unoccupied spells, prevents duplicate picks and stops at the allowance", async () => {
    const saveAction = vi.fn().mockResolvedValue({ choices: {}, scores: {}, action_revision: "2" });
    render(<BonusSpellsPanel {...props} occupied={new Set([third.id])} saveAction={saveAction} />);
    const add = () => screen.getByRole("combobox", { name: "Add Magical Secrets spell" });
    expect(within(add()).queryByRole("option", { name: /Spell 3/ })).not.toBeInTheDocument();
    expect(within(add()).queryByRole("option", { name: /Spell 4/ })).not.toBeInTheDocument();
    fireEvent.change(add(), { target: { value: `${first.id}:1` } });
    expect(within(add()).queryByRole("option", { name: /Spell 1/ })).not.toBeInTheDocument();
    fireEvent.change(add(), { target: { value: `${second.id}:1` } });
    expect(screen.queryByRole("combobox", { name: "Add Magical Secrets spell" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("combobox", { name: "Magical Secrets spell 1" })).queryByRole("option", { name: /Spell 2/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save Magical Secrets spells" }));
    await waitFor(() => expect(saveAction).toHaveBeenCalledWith("select_bonus_spells", { feature_slug: feature.slug,
      choice_id: choice.choice_id, spells: [pin(first), pin(second)] }));
  });

  it("keeps exact saved spellbook versions and omits unsaved book versions or nonritual spells", () => {
    render(<BonusSpellsPanel {...props} choice={{ ...choice, spellbook_only: true, ritual_only: true }}
      catalog={[{ ...first, version: 2, data: { ...first.data, ritual: true } }, { ...first, data: { ...first.data, ritual: true } }, second]}
      selected={[pin(first)]} spellbook={[pin(first), pin(second)]} />);
    expect(screen.getByRole("combobox", { name: "Magical Secrets spell 1" })).toHaveValue(`${first.id}:1`);
    expect(screen.queryByRole("option", { name: /Spell 2/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Add Magical Secrets spell" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("retains failed drafts and locks them when the saved feature changes", async () => {
    const saveAction = vi.fn().mockRejectedValue(new Error("lost response"));
    const { rerender } = render(<BonusSpellsPanel {...props} saveAction={saveAction} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Add Magical Secrets spell" }), { target: { value: `${first.id}:1` } });
    fireEvent.click(screen.getByRole("button", { name: "Save Magical Secrets spells" }));
    await screen.findByText(/These bonus spell choices could not be confirmed/);
    expect(screen.getByRole("combobox", { name: "Magical Secrets spell 1" })).toHaveValue(`${first.id}:1`);
    rerender(<BonusSpellsPanel {...props} feature={{ ...feature, version: 2 }} saveAction={saveAction} />);
    expect(screen.getByText(/The saved feature, spellbook or choices changed/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Magical Secrets spell 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save Magical Secrets spells" })).toBeDisabled();
  });

  it("does not silently replace an unavailable or ambiguous saved version", () => {
    render(<BonusSpellsPanel {...props} catalog={[first, first]} selected={[pin(first)]} />);
    expect(screen.getByText(/A saved spell version is unavailable or no longer eligible/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Magical Secrets spells" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Magical Secrets spell 1" })).toBeDisabled();
  });
});
