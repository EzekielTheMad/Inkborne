import { providerAbilities, providerBase, providerSources, providerPassiveFeature } from "../../fixtures/provider-mechanics";
import { stateCastingAcquisition } from "../../fixtures/casting-acquisitions";
import { Activity, useEffect, useState } from "react";
import { pinnedSlotClass } from "../../fixtures/pinned-slot-class";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CharacterProvider, useCharacterState, useRest, useResources, useSpells } from "@/lib/character/character-context";
import { CastDialog } from "@/components/sheet/spells/cast-dialog";
import { SlotTracker } from "@/components/sheet/spells/slot-tracker";
import { ResourcesWidget } from "@/components/sheet/resources-widget";
import { FeaturesTab } from "@/components/sheet/tabs/features-tab";
import { insertRoll } from "@/lib/supabase/rolls";
import type { CharacterState } from "@/lib/types/character";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));
vi.mock("@/lib/supabase/inventory", () => ({ addInventoryItem: vi.fn(), updateInventoryItem: vi.fn(), removeInventoryItem: vi.fn(), unequipAllArmor: vi.fn() }));
vi.mock("@/lib/supabase/spells", () => ({ addCharacterSpell: vi.fn(), updateCharacterSpell: vi.fn(), removeCharacterSpell: vi.fn() }));
vi.mock("@/lib/supabase/rolls", () => ({ insertRoll: vi.fn() }));

const schema = { ability_scores: providerAbilities, proficiency_levels: [], derived_stats: [{ slug: "proficiency_bonus", base: 2 }], skills: [], resources: [], content_types: [], currencies: [], creation_steps: [], sheet_sections: [] };
const refs = [
  pinnedSlotClass("wizard", 3, "full", [4, 2, 0, 0, 0, 0, 0, 0, 0]),
  pinnedSlotClass("fighter", 1, null, null),
  providerPassiveFeature(1, "arcane-recovery", "Arcane Recovery", "wizard", 1, "long rest"),
  providerPassiveFeature(2, "second-wind", "Second Wind", "fighter", 3, "short rest"),
];
type Handles = { rest: ReturnType<typeof useRest>; saves: ReturnType<typeof useCharacterState>; resources: ReturnType<typeof useResources>; spells: ReturnType<typeof useSpells> };
let handles: Record<string, Handles>;
let stored: CharacterState;
function persist(name: string, args: { expected_state?: CharacterState; state_patch: Partial<CharacterState> }) {
  if (name === "patch_character_state_if_current") {
    if (JSON.stringify(args.expected_state) !== JSON.stringify(stored)) {
      return { error: null, data: [{ status: "conflict", resulting_state: structuredClone(stored) }] };
    }
    stored = { ...stored, ...args.state_patch };
    return { error: null, data: [{ status: "applied", resulting_state: structuredClone(stored) }] };
  }
  expect(name).toBe("patch_character_state");
  stored = { ...stored, ...args.state_patch };
  return { error: null };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((yes) => { resolve = yes; });
  return { promise, resolve };
}
const spell = stateCastingAcquisition();
const instant = stateCastingAcquisition("instant-focus", { level: 0, duration: "Instantaneous", concentration: false, ritual: true });
const lasting = stateCastingAcquisition("lasting-focus", { level: 0, concentration: false });
type Surface = "none" | "cast" | "widget" | "card" | "slots";
function Probe({ label, surface }: { label: string; surface: Surface }) {
  const rest = useRest(); const saves = useCharacterState();
  const resources = useResources(); const spells = useSpells();
  const [open, setOpen] = useState(true);
  useEffect(() => { handles[label] = { rest, saves, resources, spells }; }, [label, rest, saves, resources, spells]);
  return <><output aria-label={`${label} state`}>{JSON.stringify(saves.state)}</output>
    {surface === "cast" && <CastDialog spell={spell} castability="full" open={open} onClose={() => setOpen(false)} />}
    {surface === "widget" && <ResourcesWidget />}
    {surface === "card" && <FeaturesTab character={{} as never} schema={schema as never} contentRefs={refs as never} />}
    {surface === "slots" && <SlotTracker />}
  </>;
}
function Fixture({ raw, label = "sheet", surface = "none" }: { raw: CharacterState; label?: string; surface?: Surface }) {
  const character = { id: "local-character", system_id: "local-system", level: 4, state: raw, choices: { classes: [{ slug: "wizard", level: 3 }, { slug: "fighter", level: 1 }] }, base_stats: providerBase, narrative: {} };
  return <CharacterProvider
    character={character as never}
    schema={schema as never} contentRefs={refs} contentSnapshotsComplete
    initialState={{ ...raw, temp_hp: 0 }} initialInventory={[]} initialSpells={[spell, instant, lasting]}
    classData={{ wizard: { slug: "wizard", data: { hit_die: 6, spellcasting: { type: "full", ability: "intelligence" } } }, fighter: { slug: "fighter", data: { hit_die: 10 } } } as never}
    allEffects={[]} baseStatsWithLevel={{ ...providerBase, level: 4 }} structuredSources={providerSources(character, refs)}
    isOwner isDm={false} hasSheet maxHp={20} primaryColor={null} onPrimaryColorChange={() => {}}
  ><Probe label={label} surface={surface} /></CharacterProvider>;
}

beforeEach(() => {
  handles = {};
  rpc.mockReset().mockImplementation(async (name, args) => persist(name, args));
});

const baseline: CharacterState = { current_hp: 20, spell_slots_used: { "1": 1, "2": 1 }, feature_uses: { "second-wind": 1, other: 2 }, quick_notes: "old" };
const cast = () => handles.sheet.spells.castSpell(spell, { type: "slot", level: 1 });
const actions = {
  cast,
  spend: () => handles.sheet.resources.spend("second-wind"),
  restore: () => handles.sheet.resources.restore("second-wind"),
  setUsed: () => handles.sheet.resources.setUsed("second-wind", 2),
};

describe("explicit conditional casting and manual resource callers", () => {
  it("saves slot, concentration replacement and effects as one conditional state patch, without logging a roll", async () => {
    const oldEffect = { id: "old", slug: "old", name: "Old Focus", source: "spell", content_id: "old", concentration: true, duration: { type: "special" }, effects: [], applied_at: "2026-10-03T00:00:00Z", expires_at: null };
    const independent = { ...oldEffect, id: "keep", slug: "keep", concentration: false };
    const raw = { ...baseline, active_effects: [oldEffect, independent], concentrating_on: { spell_slug: "old", spell_name: "Old Focus", slot_level: 1, started_at: oldEffect.applied_at } } as CharacterState;
    stored = structuredClone(raw); render(<Fixture raw={raw} />);
    await act(async () => { await cast(); });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][0]).toBe("patch_character_state_if_current");
    expect(rpc.mock.calls[0][1].expected_state).toEqual(raw);
    expect(stored.spell_slots_used).toEqual({ "1": 2, "2": 1 });
    expect(stored.concentrating_on).toMatchObject({ spell_slug: "focus", slot_level: 1 });
    expect(stored.active_effects?.map(effect => effect.id)).toContain("keep");
    expect(stored.active_effects?.map(effect => effect.id)).not.toContain("old");
    expect(stored.active_effects?.map(effect => effect.slug)).toEqual(["keep", "focus"]);
    expect(insertRoll).not.toHaveBeenCalled();
  });

  it("keeps instantaneous cantrip/ritual casts write-free but guards a lasting cantrip effect", async () => {
    stored = structuredClone(baseline); render(<Fixture raw={baseline} />);
    await act(async () => {
      await handles.sheet.spells.castSpell(instant, { type: "cantrip" });
      await handles.sheet.spells.castSpell(instant, { type: "ritual" });
    });
    expect(rpc).not.toHaveBeenCalled();
    await act(async () => { await handles.sheet.spells.castSpell(lasting, { type: "cantrip" }); });
    expect(rpc.mock.calls[0][0]).toBe("patch_character_state_if_current");
    expect(rpc.mock.calls[0][1].state_patch).not.toHaveProperty("spell_slots_used");
    expect(stored.active_effects).toHaveLength(1);
  });

  it("computes spends/restores from settled uses, preserves other resources, clamps and skips no-op writes", async () => {
    stored = structuredClone(baseline); render(<Fixture raw={baseline} />);
    await act(async () => { await handles.sheet.resources.spend("second-wind"); });
    expect(stored.feature_uses).toEqual({ "second-wind": 2, other: 2 });
    await act(async () => { await handles.sheet.resources.restore("second-wind"); });
    expect(rpc.mock.calls[1][1].expected_state.feature_uses).toEqual({ "second-wind": 2, other: 2 });
    await act(async () => { await handles.sheet.resources.setUsed("second-wind", 999); });
    expect(stored.feature_uses).toEqual({ "second-wind": 3, other: 2 });
    await act(async () => { await handles.sheet.resources.spend("second-wind"); });
    expect(rpc).toHaveBeenCalledTimes(3);
    await expect(handles.sheet.resources.setUsed("second-wind", Number.NaN)).rejects.toThrow("finite number");
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it("rejects pending and stale cast/resource callbacks without writing, then accepts newly chosen actions", async () => {
    stored = structuredClone(baseline); const hold = deferred();
    rpc.mockImplementationOnce(async (name, args) => { await hold.promise; return persist(name, args); });
    render(<Fixture raw={baseline} />);
    const staleCast = handles.sheet.spells.castSpell; const staleResource = handles.sheet.resources.spend;
    let notes!: Promise<boolean>;
    await act(async () => { notes = handles.sheet.saves.patchState({ quick_notes: "new" }); });
    await expect(cast()).rejects.toThrow(/saving|changed/);
    await expect(handles.sheet.resources.spend("second-wind")).rejects.toThrow(/saving|changed/);
    expect(rpc).toHaveBeenCalledTimes(1);
    await act(async () => { hold.resolve(); await notes; });
    await expect(staleCast(spell, { type: "slot", level: 1 })).rejects.toThrow(/saving|changed/);
    await expect(staleResource("second-wind")).rejects.toThrow(/saving|changed/);
    await act(async () => { await cast(); });
    await act(async () => { await handles.sheet.resources.spend("second-wind"); });
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(rpc.mock.calls[1][1].expected_state.quick_notes).toBe("new");
  });

  it.each(Object.keys(actions) as Array<keyof typeof actions>)("requires reload after rejected/unconfirmed %s, keeps notes independent and never replays", async action => {
    for (const outcome of ["conflict", "missing", "response-lost", "malformed"]) {
      stored = structuredClone(baseline);
      rpc.mockReset().mockImplementation(async (name, args) => persist(name, args));
      rpc.mockImplementationOnce(async () => outcome === "response-lost" ? { error: { message: "lost" }, data: null }
        : outcome === "malformed" ? { error: null, data: [] }
        : { error: null, data: [{ status: outcome, resulting_state: outcome === "missing" ? null : stored }] });
      const view = render(<Fixture raw={baseline} />);
      await act(async () => { await expect(actions[action]()).rejects.toMatchObject({ requiresReload: true }); });
      expect(handles.sheet.saves.state).toMatchObject(baseline);
      expect(rpc).toHaveBeenCalledTimes(1);
      await act(async () => { await handles.sheet.saves.patchState({ quick_notes: "independent" }); });
      expect(rpc.mock.calls[1][0]).toBe("patch_character_state");
      await expect(actions[action]()).rejects.toMatchObject({ requiresReload: true });
      expect(rpc).toHaveBeenCalledTimes(2); expect(stored.quick_notes).toBe("independent");
      view.unmount();
    }
  });

  it("rejects a competing resource spend after another provider cast wins", async () => {
    stored = structuredClone(baseline); const a = deferred(); const b = deferred();
    rpc.mockImplementationOnce(async (name, args) => { await a.promise; return persist(name, args); });
    rpc.mockImplementationOnce(async (name, args) => { await b.promise; return persist(name, args); });
    render(<><Fixture raw={baseline} label="a" /><Fixture raw={baseline} label="b" /></>);
    let castResult!: Promise<unknown>; let spendResult!: Promise<unknown>;
    await act(async () => {
      castResult = handles.a.spells.castSpell(spell, { type: "slot", level: 1 });
      spendResult = handles.b.resources.spend("second-wind").catch(error => error);
    });
    await act(async () => { a.resolve(); await castResult; });
    const winner = structuredClone(stored);
    await act(async () => { b.resolve(); expect(await spendResult).toMatchObject({ requiresReload: true }); });
    expect(stored).toEqual(winner); expect(stored.feature_uses).toEqual(baseline.feature_uses);
    expect(handles.b.saves.state).toMatchObject(baseline); expect(rpc).toHaveBeenCalledTimes(2);
  });

  it.each((["widget", "card", "slots"] as const).flatMap(surface =>
    ["conflict", "response-lost"].map(outcome => ({ surface, outcome })),
  ))("the actual $surface caller recovers hidden $outcome without retry", async ({ surface, outcome }) => {
    stored = structuredClone(baseline); const hold = deferred();
    rpc.mockImplementationOnce(async () => {
      await hold.promise;
      return outcome === "response-lost" ? { error: { message: "lost" }, data: null }
        : { error: null, data: [{ status: "conflict", resulting_state: stored }] };
    });
    const fixture = <Fixture raw={baseline} surface={surface} />;
    const view = render(<Activity mode="visible">{fixture}</Activity>);
    const button = surface === "slots" ? screen.getAllByRole("button", { name: "Mark 1st slot used" })[0] : screen.getByRole("button", { name: "Use one Second Wind" });
    fireEvent.click(button); await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    expect(button).toBeDisabled();
    expect(rpc.mock.calls[0][0]).toBe("patch_character_state_if_current");
    expect(rpc.mock.calls[0][1].expected_state).toEqual(baseline);
    view.rerender(<Activity mode="hidden">{fixture}</Activity>);
    await act(async () => { hold.resolve(); });
    view.rerender(<Activity mode="visible">{fixture}</Activity>);
    expect(screen.getAllByRole("alert").at(-1)).toHaveTextContent(outcome === "conflict" ? "Reload before choosing a new action" : "The character save could not be confirmed");
    const retry = surface === "slots" ? screen.getAllByRole("button", { name: "Mark 1st slot used" })[0] : screen.getByRole("button", { name: "Use one Second Wind" });
    fireEvent.click(retry); await waitFor(() => expect(retry).toBeEnabled());
    expect(rpc).toHaveBeenCalledTimes(1); expect(stored).toEqual(baseline);
  });

  it.each(["success", "conflict", "response-lost"])("actual cast dialog reconciles hidden %s with accurate result and no replay", async outcome => {
    stored = structuredClone(baseline); const hold = deferred();
    rpc.mockImplementationOnce(async (name, args) => {
      await hold.promise;
      if (outcome === "conflict") return { error: null, data: [{ status: "conflict", resulting_state: stored }] };
      const applied = persist(name, args);
      return outcome === "response-lost" ? { error: { message: "committed response lost" }, data: null } : applied;
    });
    const fixture = <Fixture raw={baseline} surface="cast" />;
    const view = render(<Activity mode="visible">{fixture}</Activity>);
    fireEvent.click(screen.getByRole("button", { name: "Cast" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    view.rerender(<Activity mode="hidden">{fixture}</Activity>);
    await act(async () => { hold.resolve(); });
    view.rerender(<Activity mode="visible">{fixture}</Activity>);
    if (outcome === "success") expect(await screen.findByRole("button", { name: "Done" })).toBeEnabled();
    else {
      expect(screen.getByRole("dialog")).toHaveTextContent(outcome === "conflict" ? "Reload before choosing a new action" : "The character save could not be confirmed");
      expect(screen.queryByRole("button", { name: "Done" })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Cast" }));
      await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    }
    expect(insertRoll).not.toHaveBeenCalled(); expect(rpc).toHaveBeenCalledTimes(1);
  });
});
