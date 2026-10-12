import { providerAbilities, providerBase, providerSources, providerPassiveFeature } from "../../fixtures/provider-mechanics";
import { pinnedSlotClass } from "../../fixtures/pinned-slot-class";
import { Activity, useEffect, useRef } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CharacterProvider, useCharacterState, useRest, useResources, useSpells, useActiveEffects, useInventory, useConcentration } from "@/lib/character/character-context";
import { CharacterShell } from "@/components/character/character-shell";
import { ConcentrationPrompt } from "@/components/sheet/concentration-prompt";
import { RestDialog } from "@/components/sheet/rest-dialog";
import { Conditions } from "@/components/sheet/conditions";
import { DeathSaves } from "@/components/sheet/death-saves";
import { ActiveEffectsWidget } from "@/components/sheet/active-effects-widget";
import { ConcentrationBadge } from "@/components/sheet/spells/concentration-badge";
import { ActivationToggles } from "@/components/sheet/activation-toggles";
import { CurrencyTracker } from "@/components/sheet/inventory/currency-tracker";
import { executeRoll } from "@/lib/dice/roller";
import { insertRoll } from "@/lib/supabase/rolls";
import type { CharacterSpell } from "@/lib/types/spells";
import type { CharacterState } from "@/lib/types/character";

vi.mock("@/lib/dice/roller", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/dice/roller")>();
  return { ...actual, executeRoll: vi.fn((request) => ({ request, total: 1, natural: 1, groups: [], modifier: 0, rolled_at: "2026-10-04T00:00:00Z" })) };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/sheet/content-tabs", () => ({ ContentTabs: () => null }));
vi.mock("@/components/character/narrative-panel", () => ({ NarrativePanel: () => null }));
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));
vi.mock("@/lib/supabase/inventory", () => ({ addInventoryItem: vi.fn(), updateInventoryItem: vi.fn(), removeInventoryItem: vi.fn(), unequipAllArmor: vi.fn() }));
vi.mock("@/lib/supabase/spells", () => ({ addCharacterSpell: vi.fn(), updateCharacterSpell: vi.fn(), removeCharacterSpell: vi.fn() }));
vi.mock("@/lib/supabase/rolls", () => ({ insertRoll: vi.fn() }));

const schema = { ability_scores: providerAbilities, proficiency_levels: [], derived_stats: [{ slug: "proficiency_bonus", name: "Proficiency bonus", base: 3 }], skills: [], resources: [], content_types: [], currencies: [], creation_steps: [], sheet_sections: [] };
const refs = [
  pinnedSlotClass("wizard", 3, "full", [4, 2, 0, 0, 0, 0, 0, 0, 0]),
  pinnedSlotClass("fighter", 1, null, null),
  pinnedSlotClass("barbarian", 1, null, null),
  providerPassiveFeature(1, "arcane-recovery", "Arcane Recovery", "wizard", 1, "long rest"),
  providerPassiveFeature(2, "second-wind", "Second Wind", "fighter", 3, "short rest"),
];
type Handles = { rest: ReturnType<typeof useRest>; saves: ReturnType<typeof useCharacterState>; resources: ReturnType<typeof useResources>; spells: ReturnType<typeof useSpells>; effects: ReturnType<typeof useActiveEffects>; inventory: ReturnType<typeof useInventory>; concentration: ReturnType<typeof useConcentration> };
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
const spell = { id: "local-spell", name: "Local Focus", class_slug: "wizard", content_definitions: { id: "focus", slug: "focus", name: "Local Focus", data: { level: 1, duration: "1 minute", concentration: true, attack_type: "ranged" }, effects: [] } } as unknown as CharacterSpell;
type Surface = "shell" | "conditions" | "death" | "effects" | "badge" | "toggles" | "currency" | "prompt" | "rest" | "none";
function Probe({ label, surface }: { label: string; surface: Surface }) {
  const rest = useRest(); const saves = useCharacterState();
  const resources = useResources(); const spells = useSpells();
  const concentration = useConcentration();
  const { requestCheck } = concentration;
  const requestedCheck = useRef(false);
  useEffect(() => {
    if (surface === "prompt" && !requestedCheck.current) {
      requestedCheck.current = true;
      requestCheck(5);
    }
  }, [surface, requestCheck]);
  const effects = useActiveEffects(); const inventory = useInventory();
  useEffect(() => { handles[label] = { rest, saves, resources, spells, effects, inventory, concentration }; }, [label, rest, saves, resources, spells, effects, inventory, concentration]);
  const state = saves.state;
  return <><pre aria-label={`${label} state`}>{JSON.stringify(state)}</pre>
    {surface === "prompt" && <ConcentrationPrompt />}
    {surface === "rest" && <RestDialog open onClose={() => {}} />}
    {surface === "shell" && <CharacterShell campaignPageBacklinks={[]} timelineEvents={[]} relationships={[]} />}
    {surface === "conditions" && <Conditions conditions={state.conditions ?? []} exhaustion={state.exhaustion ?? 0} patchState={saves.patchConditionalState} />}
    {surface === "death" && <DeathSaves currentHp={state.current_hp ?? 20} deathSaves={state.death_saves ?? { successes: 0, failures: 0 }} patchState={saves.patchState} manualPatchState={saves.patchConditionalState} />}
    {surface === "effects" && <ActiveEffectsWidget />}
    {surface === "badge" && <ConcentrationBadge />}
    {surface === "toggles" && <ActivationToggles toggles={[{ key: "rage_active", label: "Rage", active: !!state.rage_active }]} onToggle={(key, active) => saves.patchConditionalState({ [key]: active })} />}
    {surface === "currency" && <CurrencyTracker currency={inventory.currency} onChange={inventory.setCurrency} />}
  </>;
}
function Fixture({ raw, label = "sheet", surface = "none" }: { raw: CharacterState; label?: string; surface?: Surface }) {
  const character = { id: "local-character", system_id: "local-system", user_id: "local-user", name: "Local Character", level: 5, state: raw, choices: { classes: [{ slug: "wizard", level: 3 }, { slug: "fighter", level: 1 }, { slug: "barbarian", level: 1 }] }, base_stats: providerBase, narrative: {} };
  return <CharacterProvider
    character={character as never}
    schema={schema as never} contentRefs={refs} contentSnapshotsComplete
    initialState={{ ...raw, temp_hp: 0 }} initialInventory={[]} initialSpells={[spell]}
    classData={{ wizard: { slug: "wizard", data: { hit_die: 6, spellcasting: { type: "full", ability: "intelligence" } } }, fighter: { slug: "fighter", data: { hit_die: 10 } }, barbarian: { slug: "barbarian", data: { hit_die: 12 } } } as never}
    allEffects={[]} baseStatsWithLevel={{ ...providerBase, level: 5 }} structuredSources={providerSources(character, refs)}
    isOwner isDm={false} hasSheet maxHp={20} primaryColor={null} onPrimaryColorChange={() => {}}
  ><Probe label={label} surface={surface} /></CharacterProvider>;
}

beforeEach(() => {
  handles = {};
  vi.mocked(insertRoll).mockReset().mockResolvedValue(undefined as never);
  rpc.mockReset().mockImplementation(async (name, args) => persist(name, args));
});

const existing = { id: "guard", slug: "guard", name: "Guarded", source: "custom", content_id: null, concentration: false, duration: { type: "special" }, effects: [], applied_at: "2026-10-03T00:00:00Z", expires_at: null };
const linked = { ...existing, id: "old", slug: "old", name: "Old Focus", source: "spell", concentration: true };
const baseline = { current_hp: 0, conditions: ["Poisoned"], exhaustion: 1, death_saves: { successes: 0, failures: 1 }, inspiration: false, rage_active: false, seen_sheet_first_time: true, active_effects: [existing, linked], concentrating_on: { spell_slug: "old", spell_name: "Old Focus", slot_level: 1, started_at: linked.applied_at }, currency: { pp: 0, gp: 10, ep: 0, sp: 2, cp: 3 }, quick_notes: "keep" } as CharacterState;
const surfaces = ["conditions", "death", "effects", "badge", "toggles", "currency", "shell", "prompt"] as const;
function trigger(surface: Surface, mobile = false) {
  if (surface === "currency") {
    fireEvent.change(screen.getByLabelText("GP amount"), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: "Save currency" }));
  } else {
    const name = surface === "conditions" ? "Remove Poisoned" : surface === "death" ? "Success 1 (empty)"
      : surface === "effects" ? "Remove Old Focus (ends concentration)" : surface === "badge" ? "End concentration"
      : surface === "prompt" ? "Drop" : surface === "toggles" ? "Rage" : mobile ? "Grant inspiration" : "Inspiration inactive";
    fireEvent.click(screen.getAllByRole("button", { name })[0]);
  }
}

function deathRoll(natural: number, total = natural) {
  vi.mocked(executeRoll).mockImplementationOnce(request => ({ request, total, natural, groups: [], modifier: 0, rolled_at: "2026-10-04T00:00:00Z" }));
}
async function clickDeathRoll(index = 0) {
  fireEvent.click(screen.getAllByRole("button", { name: "Roll death save" })[index]);
  fireEvent.click(await screen.findByRole("button", { name: "Roll" }));
}
describe("actual conditional rolled death-save callers (separate roll/state saves)", () => {
  it.each([[1, 1, 0, 3, 0], [7, 7, 0, 2, 0], [14, 14, 1, 1, 0], [8, 12, 1, 1, 0], [20, 20, 0, 0, 1]])("natural %s total %s preserves established rules in one raw conditional patch", async (natural, total, successes, failures, hp) => {
    stored = structuredClone(baseline); deathRoll(natural, total);
    render(<Fixture raw={baseline} surface="death" />); await clickDeathRoll();
    await waitFor(() => expect(stored.death_saves).toEqual({ successes, failures }));
    expect(stored.current_hp).toBe(hp); expect(stored.quick_notes).toBe("keep");
    expect(rpc).toHaveBeenCalledTimes(1); expect(rpc.mock.calls[0][0]).toBe("patch_character_state_if_current");
    expect(rpc.mock.calls[0][1].expected_state).toEqual(baseline);
    expect(insertRoll).toHaveBeenCalledTimes(1); expect(vi.mocked(insertRoll).mock.calls[0][2]).toEqual({ requireConfirmation: true });
  });
  it("pending notes reject before RNG, remain intact, and permit an explicit roll after settlement", async () => {
    stored = structuredClone(baseline); const hold = deferred();
    rpc.mockImplementationOnce(async (name, args) => { await hold.promise; return persist(name, args); });
    render(<Fixture raw={baseline} surface="death" />);
    let notes!: Promise<boolean>;
    await act(async () => { notes = handles.sheet.saves.patchState({ quick_notes: "independent" }); });
    await clickDeathRoll();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Wait for pending saves"));
    expect(insertRoll).not.toHaveBeenCalled(); expect(rpc).toHaveBeenCalledTimes(1);
    await act(async () => { hold.resolve(); await notes; });
    deathRoll(14); await clickDeathRoll();
    await waitFor(() => expect(stored.death_saves?.successes).toBe(1));
    expect(stored.quick_notes).toBe("independent"); expect(insertRoll).toHaveBeenCalledTimes(1);
  });
  it.each([1,20])("natural %s hidden conflict/lost response retains recovery and refuses reroll", async natural => {
    for (const outcome of ["conflict","response-lost"]) {
      stored = structuredClone(baseline); const hold = deferred(); deathRoll(natural);
      rpc.mockReset().mockImplementation(async (name, args) => persist(name,args));
      rpc.mockImplementationOnce(async (name,args) => {
        await hold.promise;
        if (outcome === "conflict") return { error: null, data: [{ status: "conflict", resulting_state: structuredClone(stored) }] };
        persist(name,args); return { error: { message: "committed response lost" }, data: null };
      });
      const fixture = <Fixture raw={baseline} surface="death" />;
      const view = render(<Activity mode="visible">{fixture}</Activity>);
      await clickDeathRoll(); await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
      let notes!: Promise<boolean>;
      await act(async () => { notes = handles.sheet.saves.patchState({ quick_notes: "independent" }); });
      view.rerender(<Activity mode="hidden">{fixture}</Activity>);
      if (outcome === "conflict") stored={...stored,death_saves:{successes:2,failures:1}};
      await act(async () => { hold.resolve(); await notes; });
      view.rerender(<Activity mode="visible">{fixture}</Activity>);
      await waitFor(() => expect(screen.getAllByRole("alert").at(-1)).toHaveTextContent("separate saves"));
      expect(screen.getByRole("button",{name:"Roll death save"})).toBeDisabled();
      fireEvent.click(screen.getByRole("button",{name:"Roll death save"}));
      expect(rpc).toHaveBeenCalledTimes(2); expect(rpc.mock.calls[1][0]).toBe("patch_character_state");
      expect(stored.quick_notes).toBe("independent");
      expect(insertRoll).toHaveBeenCalledTimes(outcome === "conflict" ? 1 : 2);
      view.unmount();
    }
  });
  it("both responsive instances block while the roll record is still pending after state confirmation", async () => {
    stored=structuredClone(baseline); const hold=deferred(); deathRoll(14);
    vi.mocked(insertRoll).mockReturnValueOnce(hold.promise);
    render(<Fixture raw={baseline} surface="shell" />); await clickDeathRoll();
    await waitFor(()=>expect(stored.death_saves?.successes).toBe(1));
    await waitFor(()=>expect(handles.sheet.saves.patchState.hasPendingWrites()).toBe(false));
    for(const trigger of screen.getAllByRole("button",{name:"Roll death save"})) { expect(trigger).toBeDisabled();fireEvent.click(trigger); }
    expect(insertRoll).toHaveBeenCalledTimes(1); expect(rpc).toHaveBeenCalledTimes(1);
    await act(async()=>hold.resolve());
    await waitFor(()=>expect(screen.getAllByRole("button",{name:"Roll death save"})[0]).toBeEnabled());
  });
  it("reload waits for a held roll insert after the conditional state conflict has settled", async()=>{
    stored=structuredClone(baseline);deathRoll(14);const hold=deferred();
    vi.mocked(insertRoll).mockReturnValueOnce(hold.promise);
    rpc.mockImplementationOnce(async()=>({error:null,data:[{status:"conflict",resulting_state:structuredClone(stored)}]}));
    render(<Fixture raw={baseline} surface="death" />);await clickDeathRoll();
    await waitFor(()=>expect(screen.getByRole("button",{name:"Reload character"})).toBeDisabled());
    await waitFor(()=>expect(handles.sheet.saves.patchState.hasPendingWrites()).toBe(false));
    expect(screen.getByRole("button",{name:"Reload character"})).toBeDisabled();
    await act(async()=>hold.resolve());
    await waitFor(()=>expect(screen.getByRole("button",{name:"Reload character"})).toBeEnabled());
    expect(insertRoll).toHaveBeenCalledTimes(1);
  });
  it("natural-20 roll uncertainty stays visible after an independent note also fails",async()=>{
    stored=structuredClone(baseline);deathRoll(20);vi.mocked(insertRoll).mockRejectedValueOnce(new Error("lost roll response"));
    render(<Fixture raw={baseline} surface="death" />);await clickDeathRoll();
    await waitFor(()=>expect(screen.getByRole("alert")).toHaveTextContent("roll record could not be confirmed"));
    rpc.mockImplementationOnce(async()=>({error:{message:"note rejected"},data:null}));
    await act(async()=>{ expect(await handles.sheet.saves.patchState({quick_notes:"draft"})).toBe(false); });
    expect(screen.getByRole("alert")).toHaveTextContent("roll record could not be confirmed");
    expect(screen.getByRole("button",{name:"Reload character"})).toBeEnabled();
    expect(stored.current_hp).toBe(1);expect(insertRoll).toHaveBeenCalledTimes(1);
  });
  it.each([14,20])("natural %s roll insert uncertainty remains visible after state success, without reinsertion",async natural=>{
    stored=structuredClone(baseline);deathRoll(natural);vi.mocked(insertRoll).mockRejectedValueOnce(new Error("lost roll response"));
    render(<Fixture raw={baseline} surface="death" />);await clickDeathRoll();
    await waitFor(()=>expect(screen.getAllByRole("alert")[0]).toHaveTextContent("roll record could not be confirmed"));
    expect(stored.current_hp).toBe(natural===20?1:0);expect(insertRoll).toHaveBeenCalledTimes(1);expect(rpc).toHaveBeenCalledTimes(1);
    if(natural===14) expect(screen.getByRole("button",{name:"Roll death save"})).toBeDisabled();
    else expect(screen.queryByRole("button",{name:"Roll death save"})).not.toBeInTheDocument();
  });
});

describe("remaining state-only actual controls", () => {
  it("rolled concentration failure uses one raw conditional drop, retaining independent effects", async () => {
    stored = structuredClone(baseline); render(<Fixture raw={baseline} surface="prompt" />);
    fireEvent.click(screen.getByRole("button", { name: /Roll CON Save/ }));
    await waitFor(() => expect(stored.concentrating_on).toBeNull());
    expect(stored.active_effects?.map(effect => effect.id)).toEqual(["guard"]);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][0]).toBe("patch_character_state_if_current");
    expect(rpc.mock.calls[0][1].expected_state).toEqual(baseline);
    expect(insertRoll).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Concentration Check")).not.toBeInTheDocument();
  });

  it.each(["conflict", "response-lost"])("rolled concentration hidden %s preserves notes and never rerolls", async outcome => {
    stored = structuredClone(baseline); const hold = deferred();
    rpc.mockImplementationOnce(async (name, args) => {
      await hold.promise;
      if (outcome === "conflict") return { error: null, data: [{ status: "conflict", resulting_state: structuredClone(stored) }] };
      persist(name, args); return { error: { message: "committed response lost" }, data: null };
    });
    const fixture = <Fixture raw={baseline} surface="prompt" />;
    const view = render(<Activity mode="visible">{fixture}</Activity>);
    const trigger = screen.getByRole("button", { name: /Roll CON Save/ });
    fireEvent.click(trigger); fireEvent.click(trigger);
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    expect(insertRoll).toHaveBeenCalledTimes(1);
    let notes!: Promise<boolean>;
    await act(async () => { notes = handles.sheet.saves.patchState({ quick_notes: "independent" }); });
    view.rerender(<Activity mode="hidden">{fixture}</Activity>);
    if (outcome === "conflict") stored = { ...stored, concentrating_on: { ...baseline.concentrating_on!, spell_name: "Winner" } };
    await act(async () => { hold.resolve(); await notes; });
    view.rerender(<Activity mode="visible">{fixture}</Activity>);
    await waitFor(() => expect(screen.getAllByRole("alert").at(-1)).toHaveTextContent(outcome === "conflict" ? "Reload before choosing a new action" : "could not be confirmed"));
    expect(screen.getByRole("button", { name: /Roll CON Save/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Keep" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /Roll CON Save/ }));
    expect(insertRoll).toHaveBeenCalledTimes(1); expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[1][0]).toBe("patch_character_state");
    expect(stored.quick_notes).toBe("independent");
    expect(stored.concentrating_on?.spell_name ?? null).toBe(outcome === "conflict" ? "Winner" : null);
    expect(handles.sheet.concentration.pendingCheck).not.toBeNull();
  });

  it("concentration rolling refuses a pending write before RNG or roll logging", async () => {
    stored = structuredClone(baseline); const hold = deferred();
    rpc.mockImplementationOnce(async (name, args) => { await hold.promise; return persist(name, args); });
    render(<Fixture raw={baseline} surface="prompt" />);
    let notes!: Promise<boolean>;
    await act(async () => { notes = handles.sheet.saves.patchState({ quick_notes: "pending" }); });
    fireEvent.click(screen.getByRole("button", { name: /Roll CON Save/ }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Wait for pending saves"));
    expect(insertRoll).not.toHaveBeenCalled(); expect(rpc).toHaveBeenCalledTimes(1);
    await act(async () => { hold.resolve(); await notes; });
    expect(handles.sheet.concentration.pendingCheck).not.toBeNull();
    expect(screen.getByRole("button", { name: /Roll CON Save/ })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /Roll CON Save/ }));
    await waitFor(() => expect(stored.concentrating_on).toBeNull());
    expect(insertRoll).toHaveBeenCalledTimes(1); expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("a newer check does not inherit an older check's error or reroll lock", async () => {
    stored = structuredClone(baseline);
    rpc.mockImplementationOnce(async () => ({ error: null, data: [{ status: "conflict", resulting_state: structuredClone(stored) }] }));
    render(<Fixture raw={baseline} surface="prompt" />);
    fireEvent.click(screen.getByRole("button", { name: /Roll CON Save/ }));
    await waitFor(() => expect(screen.getAllByRole("alert").at(-1)).toHaveTextContent("Reload before choosing a new action"));
    expect(screen.getByRole("button", { name: /Roll CON Save/ })).toBeDisabled();
    act(() => handles.sheet.concentration.requestCheck(42));
    expect(screen.getByRole("dialog")).not.toHaveTextContent("Reload before choosing a new action");
    expect(screen.getByRole("button", { name: /Roll CON Save/ })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /Roll CON Save/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Roll CON Save/ })).toBeDisabled());
    // Provider reload gate still refuses RNG; new check does not erase global recovery.
    expect(insertRoll).toHaveBeenCalledTimes(1); expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("a completed older concentration check does not clear a newer pending check", async () => {
    stored = structuredClone(baseline); const hold = deferred();
    rpc.mockImplementationOnce(async (name, args) => { await hold.promise; return persist(name, args); });
    render(<Fixture raw={baseline} surface="prompt" />);
    let dropping!: Promise<void>;
    await act(async () => { dropping = handles.sheet.concentration.resolveCheck("drop"); });
    act(() => handles.sheet.concentration.requestCheck(42));
    await act(async () => { hold.resolve(); await dropping; });
    expect(handles.sheet.concentration.pendingCheck).toEqual({ damage: 42, dc: 21 });
  });

  it.each(surfaces)("actual %s uses raw conditional state without roll or inventory persistence", async surface => {
    stored = structuredClone(baseline); render(<Fixture raw={baseline} surface={surface} />);
    trigger(surface);
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(handles.sheet.saves.state).toMatchObject(stored));
    expect(rpc.mock.calls[0][0]).toBe("patch_character_state_if_current");
    expect(rpc.mock.calls[0][1].expected_state).toEqual(baseline);
    if (surface === "effects" || surface === "badge" || surface === "prompt") {
      expect(stored.active_effects?.map(effect => effect.id)).toEqual(["guard"]);
      expect(stored.concentrating_on).toBeNull();
    }
    expect(insertRoll).not.toHaveBeenCalled();
  });

  it.each(surfaces)("actual %s handles hidden conflict and uncertainty without replay, and preserves queued notes", async surface => {
    for (const outcome of ["conflict", "response-lost"]) {
      stored = structuredClone(baseline); const hold = deferred();
      rpc.mockReset().mockImplementation(async (name, args) => persist(name, args));
      rpc.mockImplementationOnce(async (name, args) => {
        await hold.promise;
        if (outcome === "conflict") return { error: null, data: [{ status: "conflict", resulting_state: stored }] };
        persist(name, args);
        return { error: { message: "committed response lost" }, data: null };
      });
      const fixture = <Fixture raw={baseline} surface={surface} />;
      const view = render(<Activity mode="visible">{fixture}</Activity>);
      trigger(surface); await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
      let notes!: Promise<boolean>;
      await act(async () => { notes = handles.sheet.saves.patchState({ quick_notes: "independent" }); });
      view.rerender(<Activity mode="hidden">{fixture}</Activity>);
      await act(async () => { hold.resolve(); expect(await notes).toBe(true); });
      view.rerender(<Activity mode="visible">{fixture}</Activity>);
      const message = outcome === "conflict" ? "Reload before choosing a new action" : "The character save could not be confirmed";
      expect(screen.getAllByRole("alert").at(-1)).toHaveTextContent(message);
      expect(handles.sheet.saves.state.quick_notes).toBe("independent");
      expect(stored.quick_notes).toBe("independent");
      expect(rpc.mock.calls[1][0]).toBe("patch_character_state");
      if (surface === "currency") expect(screen.getByLabelText("GP amount")).toHaveValue(15);
      trigger(surface); await waitFor(() => expect(screen.getAllByRole("alert").at(-1)).toHaveTextContent(message));
      expect(rpc).toHaveBeenCalledTimes(2); view.unmount();
    }
  });

  it.each(["long rest", "hit die"])("%s retains typed reload guidance in an actual rest dialog", async action => {
    stored = structuredClone(baseline);
    rpc.mockImplementationOnce(async () => ({ error: { message: "lost" }, data: null }));
    render(<Fixture raw={baseline} surface="rest" />);
    fireEvent.click(action === "long rest" ? screen.getByRole("button", { name: "Take Long Rest" })
      : screen.getAllByRole("button", { name: /spend & roll/i })[0]);
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveTextContent("The character save could not be confirmed"));
    expect(screen.getByRole("dialog")).not.toHaveTextContent("Please try again");
    expect(rpc).toHaveBeenCalledTimes(1);
    // A hit die can have an unmatched logged roll; this is explicitly NOT an
    // atomic roll/state test or claim. A reload is required before new intent.
    if (action === "hit die") expect(insertRoll).toHaveBeenCalledTimes(1);
  });

  it("desktop and mobile sheet wiring guards condition, activation and death-save controls", async () => {
    stored = structuredClone(baseline); render(<Fixture raw={baseline} surface="shell" />);
    // Both responsive branches are mounted in jsdom. Exercise the last control
    // (MobileSheet) as well as the desktop first one; Chrome verifies visibility.
    for (const name of ["Remove Poisoned", "Rage", "Success 1 (empty)"]) {
      fireEvent.click(screen.getAllByRole("button", { name }).at(-1)!);
      await waitFor(() => expect(rpc.mock.calls.at(-1)?.[0]).toBe("patch_character_state_if_current"));
      await waitFor(() => expect(handles.sheet.saves.patchState.hasPendingWrites()).toBe(false));
    }
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(stored).toMatchObject({ conditions: [], rage_active: true, death_saves: { successes: 1, failures: 1 } });
  });

  it("manual condition adds, exhaustion adjustments and pip wraps preserve unrelated state", async () => {
    stored = structuredClone(baseline); const view = render(<Fixture raw={baseline} surface="conditions" />);
    fireEvent.click(screen.getByRole("button", { name: "Add Condition" }));
    fireEvent.click(screen.getByRole("button", { name: "Blinded" }));
    await waitFor(() => expect(stored.conditions).toEqual(["Poisoned", "Blinded"]));
    fireEvent.click(screen.getByRole("button", { name: "Increase exhaustion" }));
    await waitFor(() => expect(stored.exhaustion).toBe(2));
    fireEvent.click(screen.getByRole("button", { name: "Decrease exhaustion" }));
    await waitFor(() => expect(stored.exhaustion).toBe(1));
    expect(stored.death_saves).toEqual(baseline.death_saves); view.unmount();
    const raw = { ...stored, death_saves: { successes: 3, failures: 1 } }; stored = structuredClone(raw);
    render(<Fixture raw={raw} surface="death" />);
    fireEvent.click(screen.getByRole("button", { name: "Success 1 (filled)" }));
    await waitFor(() => expect(stored.death_saves).toEqual({ successes: 0, failures: 1 }));
    fireEvent.click(screen.getByRole("button", { name: "Failure 2 (empty)" }));
    await waitFor(() => expect(stored.death_saves).toEqual({ successes: 0, failures: 2 }));
  });

  it("actual known-spell effect applies one guarded concentration replacement", async () => {
    stored = structuredClone(baseline); render(<Fixture raw={baseline} surface="effects" />);
    fireEvent.click(screen.getByRole("button", { name: "Add effect" }));
    fireEvent.click(screen.getByRole("button", { name: "Local Focus" }));
    await waitFor(() => expect(stored.active_effects?.map(effect => effect.slug)).toEqual(["guard", "focus"]));
    expect(stored.concentrating_on?.spell_slug).toBe("focus"); expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("retains a custom effect draft through hidden uncertainty without inventing a confirmed effect", async () => {
    stored = structuredClone(baseline); const hold = deferred();
    rpc.mockImplementationOnce(async () => { await hold.promise; return { error: { message: "lost" }, data: null }; });
    const fixture = <Fixture raw={baseline} surface="effects" />;
    const view = render(<Activity mode="visible">{fixture}</Activity>);
    fireEvent.click(screen.getByRole("button", { name: "Add effect" }));
    fireEvent.change(screen.getByLabelText("Custom effect name"), { target: { value: "Half cover" } });
    fireEvent.click(screen.getByRole("button", { name: "Add custom effect" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    view.rerender(<Activity mode="hidden">{fixture}</Activity>);
    await act(async () => { hold.resolve(); });
    view.rerender(<Activity mode="visible">{fixture}</Activity>);
    expect(screen.getByLabelText("Custom effect name")).toHaveValue("Half cover");
    expect(screen.getAllByRole("alert").at(-1)).toHaveTextContent("could not be confirmed");
    expect(stored.active_effects).toEqual(baseline.active_effects);
    fireEvent.click(screen.getByRole("button", { name: "Add custom effect" }));
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument()); expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("refuses stale/pending mechanical patches and effect/concentration computations before writing", async () => {
    stored = structuredClone(baseline); const hold = deferred();
    rpc.mockImplementationOnce(async (name, args) => { await hold.promise; return persist(name, args); });
    render(<Fixture raw={baseline} />);
    const stale = handles.sheet;
    let notes!: Promise<boolean>;
    await act(async () => { notes = handles.sheet.saves.patchState({ quick_notes: "new" }); });
    await expect(handles.sheet.saves.patchConditionalState({ inspiration: true })).rejects.toThrow(/saving|changed/);
    await expect(handles.sheet.effects.removeEffect("old")).rejects.toThrow(/saving|changed/);
    await expect(handles.sheet.spells.setConcentration(null)).rejects.toThrow(/saving|changed/);
    await expect(handles.sheet.rest.setExhaustion(2)).rejects.toThrow(/saving|changed/);
    expect(rpc).toHaveBeenCalledTimes(1);
    await act(async () => { hold.resolve(); await notes; });
    await expect(stale.effects.addCustomEffect({ name: "stale", duration: { type: "special" } })).rejects.toThrow(/saving|changed/);
    await expect(stale.inventory.setCurrency({ pp: 0, gp: 50, ep: 0, sp: 0, cp: 0 })).rejects.toThrow(/saving|changed/);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("the public exhaustion setter clamps and rejects non-finite input without a write", async () => {
    stored = structuredClone(baseline); render(<Fixture raw={baseline} />);
    await act(async () => { await handles.sheet.rest.setExhaustion(10); });
    expect(stored.exhaustion).toBe(6);
    await act(async () => { await handles.sheet.rest.setExhaustion(1.9); });
    expect(stored.exhaustion).toBe(1);
    await expect(handles.sheet.rest.setExhaustion(Infinity)).rejects.toThrow("finite number");
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("keeps a currency draft reviewable if another same-session currency edit confirms", async () => {
    stored = structuredClone(baseline); render(<Fixture raw={baseline} surface="currency" />);
    fireEvent.change(screen.getByLabelText("GP amount"), { target: { value: "15" } });
    await act(async () => { await handles.sheet.inventory.setCurrency({ ...baseline.currency!, sp: 20 }); });
    fireEvent.click(screen.getByRole("button", { name: "Save currency" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Currency changed while you were editing");
    expect(screen.getByLabelText("GP amount")).toHaveValue(15); expect(stored.currency?.sp).toBe(20);
    expect(rpc).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Discard currency draft" }));
    expect(screen.getByLabelText("SP amount")).toHaveValue(20);
    expect(screen.queryByRole("button", { name: "Save currency" })).not.toBeInTheDocument();
  });
});
