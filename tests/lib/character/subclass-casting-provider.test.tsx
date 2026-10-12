import { providerAbilities, providerBase, providerSources } from "../../fixtures/provider-mechanics";
import { useEffect, useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CharacterProvider, useSpells, useRest, useCharacterState, useResources } from "@/lib/character/character-context";
import { CastDialog } from "@/components/sheet/spells/cast-dialog";
import { SpellsTab } from "@/components/sheet/tabs/spells-tab";
import { CharacterPrintAction } from "@/components/sheet/character-print-action";
import { updateCharacterState } from "@/lib/sheet/update-state";
import { addCharacterSpell, searchSpells } from "@/lib/supabase/spells";
import { CharacterStateReloadError } from "@/lib/character/state-save-error";
import { originalGrantData, originalId, originalParent, originalRef, originalSnapshot, originalSubclass, originalSubclassData, originalSubclassFixture, subclassOwnerId } from "../../fixtures/subclass-casting";
import type { CharacterState } from "@/lib/types/character";
import type { CharacterSpell } from "@/lib/types/spells";

vi.mock("@/lib/sheet/update-state", () => ({ updateCharacterState: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => { throw new Error("No live provider in this fixture"); } }));
vi.mock("@/lib/supabase/spells", () => ({ addCharacterSpell: vi.fn(), updateCharacterSpell: vi.fn(), removeCharacterSpell: vi.fn(), searchSpells: vi.fn() }));
vi.mock("@/lib/supabase/inventory", () => ({ addInventoryItem: vi.fn(), updateInventoryItem: vi.fn(), removeInventoryItem: vi.fn(), unequipAllArmor: vi.fn() }));
vi.mock("@/lib/supabase/rolls", () => ({ insertRoll: vi.fn() }));
vi.mock("@/lib/builder/use-is-mobile", () => ({ useIsMobile: () => false }));
let stored: CharacterState;
let spells: ReturnType<typeof useSpells>, rest: ReturnType<typeof useRest>, saves: ReturnType<typeof useCharacterState>, resources: ReturnType<typeof useResources>;
function Probe({ target }: { target: CharacterSpell }) {
  const s = useSpells(), r = useRest(), c = useCharacterState(), resource = useResources();
  const [open, setOpen] = useState(false);
  useEffect(() => { spells = s; rest = r; saves = c; resources = resource; }, [s, r, c, resource]);
  return <><SpellsTab /><CharacterPrintAction /><button onClick={() => setOpen(true)}>Inspect source cast</button><CastDialog open={open} spell={target} castability="full" onClose={() => setOpen(false)} /></>;
}
function fixture(options: { level?: number; prepared?: boolean; viewer?: boolean; missing?: boolean; multiclass?: boolean; recovery?: "wizard" | "warden"; inherit?: "full" | "half" | "pact"; mathProblem?: "missing" | "duplicate" | "nonfinite"; preparationRule?: "class-level-plus-ability" | "half-class-level-plus-ability" } = {}) {
  const input = originalSubclassFixture(options.level ?? 3);
  if (options.prepared) { const data = originalSubclassData(true); if (options.preparationRule) data.preparation_rule = options.preparationRule; input.contentRefs[1] = originalSubclass(data); }
  if (options.inherit) input.contentRefs = [originalParent("warden", options.inherit, options.inherit === "pact" ? [0, 2, 0, 0, 0, 0, 0, 0, 0] : [3, 0, 0, 0, 0, 0, 0, 0, 0]), originalSubclass(originalGrantData())];
  if (options.multiclass) {
    input.character.choices.classes.push({ slug: "original-full", level: 5 });
    input.contentRefs.push(originalParent("original-full", "full", [4, 3, 2, 0, 0, 0, 0, 0, 0], 11));
  }
  if (options.missing) input.contentRefs.pop();
  if (options.recovery) {
    const data = originalSubclassData(); (data.spellcastingList as { class: string }).class = "wizard";
    input.contentRefs[1] = originalSubclass(data);
    input.contentRefs.push(originalRef(originalSnapshot("arcane-recovery", "feature", { class: options.recovery, level: 1, description: "An original recovery counter for class-identity validation.", feature_type: "passive", usages: 1, recovery: "long rest" }, 40)));
  }
  const target = input.spells[0];
  const totalLevel = input.character.choices.classes.reduce((sum, entry) => sum + entry.level, 0);
  const raw = structuredClone(stored);
  const schema = { ability_scores: providerAbilities,
    derived_stats: [{ slug: "proficiency_bonus", name: "Proficiency bonus", base: 2 }, { slug: "armor_class", name: "Armor class", base: 10 }, { slug: "initiative", name: "Initiative", base: 0 }],
    skills: [], proficiency_levels: [], resources: [], content_types: [], currencies: [], creation_steps: [], sheet_sections: [] };
  if (options.mathProblem === "missing") schema.ability_scores = schema.ability_scores.filter(ability => ability.slug !== "intelligence");
  if (options.mathProblem === "duplicate") schema.ability_scores = [...schema.ability_scores, { ...schema.ability_scores.find(ability => ability.slug === "intelligence")! }];
  const baseStats = { ...providerBase, intelligence: options.mathProblem === "nonfinite" ? Infinity : 14, charisma: 20 };
  const provider = () => {
    const character = { ...input.character, user_id: subclassOwnerId, name: "Original Warden", level: totalLevel, state: raw, narrative: {}, base_stats: baseStats, game_systems: { id: input.character.system_id, name: "Original local system" } };
    return <CharacterProvider character={character as never}
    schema={schema} contentRefs={input.contentRefs} contentSnapshotsComplete initialState={raw} initialInventory={[]} initialSpells={input.spells}
    classData={Object.fromEntries(input.contentRefs.filter(ref => ref.content_definitions.content_type === "class").map(ref => [ref.content_definitions.slug, { slug: ref.content_definitions.slug, data: ref.content_definitions.data }])) as never}
    allEffects={[]} baseStatsWithLevel={{ ...baseStats, level: totalLevel }} structuredSources={providerSources(character, input.contentRefs)} isOwner={!options.viewer} isDm={!!options.viewer} hasSheet maxHp={20} primaryColor={null} onPrimaryColorChange={() => {}}><Probe target={target} /></CharacterProvider>;
  };
  const view = render(provider());
  return { input, target, refresh: () => view.rerender(provider()) };
}
beforeEach(() => {
  stored = { current_hp: 12, spell_slots_used: {}, active_effects: [], concentrating_on: null };
  vi.mocked(updateCharacterState).mockReset().mockImplementation(async (_id, patch, expected) => { expect(expected).toEqual(stored); stored = { ...stored, ...patch }; return stored; });
  vi.mocked(addCharacterSpell).mockReset(); vi.mocked(searchSpells).mockReset().mockResolvedValue([]);
});
describe("actual provider subclass source", () => {
  it.each(["missing", "duplicate", "nonfinite"] as const)("correction-regression makes %s active caster math unavailable consistently in preparation, summary and print", async mathProblem => {
    const { target } = fixture({ prepared: true, mathProblem });
    expect(spells.slotResolution.status).toBe("available"); expect(rest.canLongRest).toBe(false);
    expect(spells.casterInfo).toMatchObject({ isCaster: true, castingMathStatus: "unavailable", spellDc: null, spellAttackBonus: null, classes: [{ maxPrepared: null, castingMath: { status: "unavailable" } }] });
    expect(screen.getByText(/Casting values and preparation are unavailable/)).toBeInTheDocument();
    expect(screen.queryByTitle("Prepare")).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Cast Prism Mark" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Print / Save PDF" })).toBeDisabled();
    await expect(spells.castSpell(target, { type: "slot", level: 1 })).rejects.toThrow(/unavailable/);
    expect(updateCharacterState).not.toHaveBeenCalled();
  });
  it.each(["full", "half", "pact"] as const)("keeps valid inherited %s source summary and printed math", async inherit => {
    fixture({ inherit }); expect(spells.casterInfo).toMatchObject({ castingMathStatus: "available", spellDc: 15, spellAttackBonus: 7 });
    fireEvent.click(screen.getByRole("button", { name: "Print / Save PDF" }));
    expect(screen.getByRole("dialog", { name: "Print preview" })).toHaveTextContent("DC 15; attack +7; charisma");
  });
  it("agrees on source counts, slots, preview math, one conditional cast and print pins", async () => {
    const { target } = fixture();
    expect(spells.casterInfo.classes).toMatchObject([{ slug: "warden", ability: "intelligence", type: "third", prepared: false, cantripsKnown: 2, spellsKnown: 3, maxLearnableLevel: 1 }]);
    expect(spells.maxSlots).toEqual({ "1": 3 }); expect(spells.casterInfo).toMatchObject({ spellAttackBonus: 4, spellDc: 12 });
    fireEvent.click(screen.getByRole("button", { name: "Inspect source cast" }));
    expect(screen.getByText(/spell attack \+4/)).toBeInTheDocument(); expect(screen.getByText(/save DC 12/)).toBeInTheDocument();
    let outcome!: Awaited<ReturnType<typeof spells.castSpell>>;
    await act(async () => { outcome = await spells.castSpell(target, { type: "slot", level: 1 }); });
    expect(outcome.rollRequests[0].expression).toBe("1d20+4"); expect(outcome.dcInfo?.dc).toBe(12);
    expect(outcome.rollRequests.find(roll => roll.kind === "damage")?.expression).toBe("1d8 + 2");
    expect(stored).toMatchObject({ spell_slots_used: { "1": 1 }, concentrating_on: { spell_slug: "prism-mark" } });
    expect(updateCharacterState).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Print / Save PDF" }));
    expect(screen.getByRole("dialog", { name: "Print preview" })).toHaveTextContent("DC 12; attack +4; intelligence");
    expect(screen.getByRole("dialog", { name: "Print preview" })).toHaveTextContent("lumen-adept v1");
  });
  it("uses pinned list class and own learning ceiling while retaining stronger aggregate upcast slots", async () => {
    const { target } = fixture({ multiclass: true });
    expect(spells.maxSlots["3"]).toBe(3); // Full5 + floor(third3/3) = 6.
    vi.mocked(searchSpells).mockResolvedValue([
      { ...target.content_definitions!, id: originalId(31), slug: "local-first", name: "Local first", data: { ...target.content_definitions!.data, level: 1 } },
      { ...target.content_definitions!, id: originalId(32), slug: "local-third", name: "Local third", data: { ...target.content_definitions!.data, level: 3 } },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Add Spell" }));
    await waitFor(() => expect(searchSpells).toHaveBeenCalledWith(target.character_id, "", { classSlug: "original-scholar" }));
    expect(await screen.findByText("Local first")).toBeInTheDocument(); expect(screen.queryByText("Local third")).not.toBeInTheDocument();
    let outcome!: Awaited<ReturnType<typeof spells.castSpell>>;
    await act(async () => { outcome = await spells.castSpell(target, { type: "slot", level: 3 }); });
    expect(outcome.castLevel).toBe(3); expect(stored.spell_slots_used).toEqual({ "3": 1 });
  });
  it("keeps subclass casts serialized while a state write is pending", async () => {
    const { target } = fixture();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    vi.mocked(updateCharacterState).mockImplementationOnce(async (_id, patch, expected) => {
      await gate; expect(expected).toBeUndefined(); stored = { ...stored, ...patch }; return stored;
    });
    let saving!: Promise<boolean>;
    await act(async () => { saving = saves.patchState({ quick_notes: "Original local note" }); });
    await expect(spells.castSpell(target, { type: "slot", level: 1 })).rejects.toThrow(/saving|changed/);
    expect(screen.getByRole("button", { name: "Print / Save PDF" })).toBeDisabled();
    expect(updateCharacterState).toHaveBeenCalledTimes(1);
    await act(async () => { release(); expect(await saving).toBe(true); });
    await act(async () => { await spells.castSpell(target, { type: "slot", level: 1 }); });
    expect(stored).toMatchObject({ quick_notes: "Original local note", spell_slots_used: { "1": 1 } });
    expect(updateCharacterState).toHaveBeenCalledTimes(2);
  });
  it("returns no subclass cast result or replay after an unconfirmed conditional save", async () => {
    const { target } = fixture();
    vi.mocked(updateCharacterState).mockRejectedValueOnce(new CharacterStateReloadError("Original fixture save could not be confirmed"));
    await act(async () => { await expect(spells.castSpell(target, { type: "slot", level: 1 })).rejects.toMatchObject({ requiresReload: true }); });
    expect(saves.reloadRequired).toBe(true); expect(saves.state).toEqual(stored);
    expect(screen.getByRole("button", { name: "Print / Save PDF" })).toBeDisabled();
    await expect(spells.castSpell(target, { type: "slot", level: 1 })).rejects.toMatchObject({ requiresReload: true });
    expect(updateCharacterState).toHaveBeenCalledTimes(1);
  });
  it("honors explicit prepared capacity and preparation state rather than parent slug guesses", async () => {
    fixture({ prepared: true });
    expect(spells.casterInfo.classes[0]).toMatchObject({ prepared: true, maxPrepared: 5 });
    expect(screen.queryByRole("button", { name: /Cast Prism Mark/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Prepare"));
    expect(await screen.findByRole("button", { name: "Cast Prism Mark" })).toBeInTheDocument();
    expect(spells.spells[0].is_prepared).toBe(true);
  });
  it("uses the explicitly declared half-level preparation rule", () => {
    fixture({ level: 5, prepared: true, preparationRule: "half-class-level-plus-ability" });
    expect(spells.casterInfo.classes[0]).toMatchObject({ prepared: true, maxPrepared: 4 });
  });
  it("does not grant Wizard recovery just because the subclass uses its spell list", () => {
    stored.spell_slots_used = { "1": 1 };
    fixture({ recovery: "wizard" });
    expect(resources.resources.some(resource => resource.slug === "arcane-recovery")).toBe(false);
    expect(rest.arcaneRecovery).toMatchObject({ available: false, budget: 0 });
  });
  it("preserves recovery scaling from the explicitly pinned feature class", async () => {
    stored.spell_slots_used = { "1": 1 };
    fixture({ recovery: "warden" });
    expect(rest.arcaneRecovery).toMatchObject({ available: true, budget: 2 });
    await act(async () => { expect(await rest.shortRest({ "1": 1 })).toBe(true); });
    expect(stored).toMatchObject({ spell_slots_used: { "1": 0 }, feature_uses: { "arcane-recovery": 1 } });
    expect(updateCharacterState).toHaveBeenCalledTimes(1);
  });
  it.each([1, 2])("keeps explicit inactive level %s noncasting and eligible for ordinary rest", async level => {
    fixture({ level }); expect(spells.casterInfo.isCaster).toBe(false); expect(spells.slotResolution.status).toBe("available");
    expect(screen.getByRole("button", { name: "Print / Save PDF" })).toBeEnabled(); expect(spells.casterInfo.castingMathStatus).toBe("available");
    expect(screen.getByText("This character cannot cast spells.")).toBeInTheDocument(); expect(rest.canLongRest).toBe(true);
    await act(async () => { expect(await rest.longRest()).toBe(true); }); expect(stored.current_hp).toBe(20);
  });
  it("blocks unknown subclass cast/add/rest/print at execution and preserves state", async () => {
    const { target } = fixture({ missing: true });
    expect(spells.slotResolution.status).toBe("unavailable");
    expect(screen.getByText("Prism Mark", { exact: true })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cast Prism Mark" })).not.toBeInTheDocument();
    await expect(spells.castSpell(target, { type: "slot", level: 1 })).rejects.toThrow(/unavailable/);
    await expect(spells.addSpell({ content_id: target.content_id, content_version: 2, class_slug: "warden", name: target.name })).rejects.toThrow(/unavailable/);
    expect(await rest.longRest()).toBe(false); expect(screen.getByRole("button", { name: "Print / Save PDF" })).toBeDisabled();
    expect(updateCharacterState).not.toHaveBeenCalled(); expect(addCharacterSpell).not.toHaveBeenCalled(); expect(saves.state).toEqual(stored);
  });
  it("rejects stale cast/add callbacks on a same-state subclass pin/ability change, then uses the updated source", async () => {
    const { input, target, refresh } = fixture(), oldCast = spells.castSpell, oldAdd = spells.addSpell;
    const data = originalSubclassData(); (data.spellcasting as { ability: string }).ability = "charisma";
    input.contentRefs = [input.contentRefs[0], originalSubclass(data, 2)]; refresh();
    await expect(oldCast(target, { type: "slot", level: 1 })).rejects.toThrow(/source changed/);
    await expect(oldAdd({ content_id: target.content_id, class_slug: "warden", name: target.name })).rejects.toThrow(/source changed/);
    expect(updateCharacterState).not.toHaveBeenCalled(); expect(addCharacterSpell).not.toHaveBeenCalled();
    let outcome!: Awaited<ReturnType<typeof spells.castSpell>>;
    await act(async () => { outcome = await spells.castSpell(target, { type: "slot", level: 1 }); });
    expect(outcome.rollRequests[0].expression).toBe("1d20+7"); expect(outcome.dcInfo?.dc).toBe(15);
  });
  it("preserves readable viewer inspection but rejects cast/add execution", async () => {
    const { target } = fixture({ viewer: true }); fireEvent.click(screen.getByRole("button", { name: "Inspect source cast" }));
    expect(screen.getByText(/save DC 12/)).toBeInTheDocument(); expect(screen.getByRole("button", { name: "Cast" })).toBeDisabled();
    await expect(spells.castSpell(target, { type: "slot", level: 1 })).rejects.toThrow(/read-only/);
    await expect(spells.addSpell({ content_id: target.content_id, class_slug: "warden", name: target.name })).rejects.toThrow(/read-only/);
    expect(updateCharacterState).not.toHaveBeenCalled(); expect(addCharacterSpell).not.toHaveBeenCalled();
  });
});
