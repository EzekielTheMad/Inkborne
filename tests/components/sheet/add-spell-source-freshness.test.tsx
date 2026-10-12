import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddSpellPanel } from "@/components/sheet/spells/add-spell-panel";
import { searchSpells } from "@/lib/supabase/spells";
import type { CasterClass } from "@/lib/types/spells";

const context = vi.hoisted(() => ({ classes: [] as CasterClass[], addSpell: vi.fn(), removeSpell: vi.fn() }));
vi.mock("@/lib/supabase/spells", () => ({ searchSpells: vi.fn() }));
vi.mock("@/lib/character/character-context", () => ({ useSpells: () => ({ casterInfo: { classes: context.classes, isCaster: true, spellDc: 12, spellAttackBonus: 4 }, slotResolution: { status: "available" }, spells: [], addSpell: context.addSpell, removeSpell: context.removeSpell }) }));
const source = (slug = "warden", list = "original-scholar"): CasterClass => ({ slug, level: 5, type: "third", ability: "intelligence", prepared: false, cantripsKnown: 2, spellsKnown: 4, maxPrepared: 0, ritualCasting: false, spellList: { class: list, level: [0, 2] }, maxLearnableLevel: 2, sourceKey: `${slug}-v1` });
const result = { id: "original-spell", version: 2, name: "Original Second Light", slug: "second-light", content_type: "spell", source: "homebrew" as const, data: { level: 2 } };
function panel() { return <AddSpellPanel open characterId="original-character" onClose={() => {}} />; }
beforeEach(() => { vi.clearAllMocks(); context.classes = [source()]; vi.mocked(searchSpells).mockResolvedValue([result] as never); });
describe("spell search result source freshness", () => {
  it("correction-regression refuses the displayed second-level result when the current own ceiling drops to first", async () => {
    const view = render(panel()); const oldAdd = await screen.findByRole("button", { name: "Add" });
    context.classes = [{ ...source(), level: 3, maxLearnableLevel: 1, sourceKey: "warden-v2" }]; view.rerender(panel());
    fireEvent.click(oldAdd);
    expect(context.addSpell).not.toHaveBeenCalled(); expect(screen.queryByText(result.name)).not.toBeInTheDocument();
  });
  it.each(["class", "list", "pin", "filter"])("correction-regression refuses an old result after a current %s switch", async change => {
    context.classes = [source(), source("echo", "original-echo")];
    const view = render(panel()); const oldAdd = await screen.findByRole("button", { name: "Add" });
    if (change === "class") fireEvent.click(screen.getByRole("button", { name: "echo" }));
    else if (change === "filter") fireEvent.change(screen.getByPlaceholderText("Search spells…"), { target: { value: "new selection" } });
    else { context.classes = [{ ...source(), ...(change === "list" ? { spellList: { class: "new-list", level: [0, 2] as [number, number] } } : { sourceKey: "warden-v2" }) }]; view.rerender(panel()); }
    fireEvent.click(oldAdd); expect(context.addSpell).not.toHaveBeenCalled();
    expect(screen.queryByText(result.name)).not.toBeInTheDocument();
  });
  it("correction-regression discards a deferred prior list search and permits only a fresh result under parent acquisition identity", async () => {
    let release!: (data: never) => void;
    vi.mocked(searchSpells).mockImplementationOnce(() => new Promise(resolve => { release = resolve; })).mockResolvedValueOnce([]);
    const view = render(panel()); await waitFor(() => expect(searchSpells).toHaveBeenCalledTimes(1));
    context.classes = [source("warden", "new-list")]; view.rerender(panel());
    await waitFor(() => expect(searchSpells).toHaveBeenCalledTimes(2)); release([result] as never);
    await waitFor(() => expect(screen.queryByText(result.name)).not.toBeInTheDocument()); expect(context.addSpell).not.toHaveBeenCalled();
    vi.mocked(searchSpells).mockResolvedValueOnce([result] as never);
    fireEvent.change(screen.getByPlaceholderText("Search spells…"), { target: { value: "fresh" } });
    fireEvent.click(await screen.findByRole("button", { name: "Add" }));
    await waitFor(() => expect(context.addSpell).toHaveBeenCalledWith(expect.objectContaining({ class_slug: "warden", content_id: result.id, content_version: 2 })));
    expect(searchSpells).toHaveBeenLastCalledWith("original-character", "fresh", { classSlug: "new-list" });
  });
});
