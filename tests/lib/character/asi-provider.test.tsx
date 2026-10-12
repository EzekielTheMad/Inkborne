import { useEffect } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CharacterProvider, useCharacter, useCharacterState, useRolls, useRest, useSpells, useInventory, useResources, useConcentration } from "@/lib/character/character-context";
import { buildCharacterStructuredSources } from "@/lib/character/structured-sources";
import { originalAsiFixture, asiSchema } from "../../fixtures/r06-asi";
import { updateCharacterState } from "@/lib/sheet/update-state";
import { insertRoll } from "@/lib/supabase/rolls";
import { executeRoll } from "@/lib/dice/roller";
import { buildCharacterPrintModel } from "@/lib/character/print-model";
import { HPTracker } from "@/components/sheet/hp-tracker";
import { ActionsTab } from "@/components/sheet/tabs/actions-tab";
import { CharacterPrintAction } from "@/components/sheet/character-print-action";
import { computeMaxHp } from "@/lib/character/max-hp";
import { evaluate } from "@/lib/engine/evaluator";
import { originalAsiPin, asiId } from "../../fixtures/r06-asi";
import { SavingThrows } from "@/components/sheet/saving-throws";
import { SkillsList } from "@/components/sheet/skills-list";
vi.mock("@/lib/sheet/update-state", () => ({ updateCharacterState: vi.fn(async () => {}) }));
vi.mock("@/lib/supabase/rolls", () => ({ insertRoll: vi.fn(async () => {}) }));
vi.mock("@/lib/supabase/spells", () => ({ addCharacterSpell: vi.fn(), updateCharacterSpell: vi.fn(), removeCharacterSpell: vi.fn() }));
vi.mock("@/lib/supabase/inventory", () => ({ addInventoryItem: vi.fn(), updateInventoryItem: vi.fn(), removeInventoryItem: vi.fn(), unequipAllArmor: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => { throw new Error("No hosted client in original ASI fixture"); } }));
vi.mock("@/lib/dice/roller", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/dice/roller")>(), executeRoll: vi.fn((await importOriginal<typeof import("@/lib/dice/roller")>()).executeRoll) }));
let latest: ReturnType<typeof useCharacter> & ReturnType<typeof useCharacterState> & ReturnType<typeof useRolls> & ReturnType<typeof useRest> & ReturnType<typeof useSpells>
  & ReturnType<typeof useInventory> & ReturnType<typeof useResources> & { pendingConcentrationCheck: ReturnType<typeof useConcentration>["pendingCheck"] };
function Probe({ ui = "rolls" }: { ui?: "rolls" | "hp" | "weapon" | "print" }) {
  const character = useCharacter(), state = useCharacterState(), rolls = useRolls(), rest = useRest(), spells = useSpells();
  const inventory = useInventory(), resources = useResources(), concentration = useConcentration();
  useEffect(() => { latest = { ...character, ...state, ...rolls, ...rest, ...spells, ...inventory, ...resources, pendingConcentrationCheck: concentration.pendingCheck }; });
  if (ui === "hp") return <HPTracker currentHp={state.state.current_hp!} tempHp={state.state.temp_hp!} maxHp={character.maxHp} patchState={state.patchState} patchActionState={state.patchActionState} />;
  if (ui === "weapon") return <ActionsTab character={character.character} schema={character.schema} evalResult={character.evalResult} contentRefs={character.contentRefs} />;
  if (ui === "print") return <CharacterPrintAction />;
  return <><SavingThrows schema={character.schema} evalResult={character.evalResult} /><SkillsList schema={character.schema} evalResult={character.evalResult} /></>;
}
function Fixture({ fixture, incomplete = false, testSchema = asiSchema, ui }: { ui?: "rolls" | "hp" | "weapon" | "print"; fixture: ReturnType<typeof originalAsiFixture>; incomplete?: boolean; testSchema?: typeof asiSchema }) {
  const { character, refs, cls, evidence } = fixture;
  const sources = buildCharacterStructuredSources(refs, 4, { character, evidence: incomplete ? { status: "unavailable", reason: "incomplete_evidence" } : evidence });
  const effects = refs.flatMap(ref => ref.content_definitions.effects);
  const baseline = evaluate(character.base_stats, effects, testSchema, sources);
  const maxHp = computeMaxHp(character.choices.classes!, { [cls.slug]: { slug: cls.slug, data: cls.data } }, baseline.stats.constitution, character.choices.hp_rolls!, "free_choice");
  return <CharacterProvider character={character} schema={testSchema} contentRefs={refs} contentSnapshotsComplete={!incomplete}
    initialState={character.state} initialInventory={[]} initialSpells={[]} classData={{ [cls.slug]: { slug: cls.slug, data: cls.data } }}
    allEffects={refs.flatMap(ref => ref.content_definitions.effects)} baseStatsWithLevel={{ ...character.base_stats, level: 4 }}
    structuredSources={buildCharacterStructuredSources(refs, 4, { character, evidence: incomplete ? { status: "unavailable", reason: "incomplete_evidence" } : evidence })}
    isOwner isDm={false} hasSheet maxHp={maxHp} primaryColor={null} onPrimaryColorChange={() => {}}><Probe ui={ui} /></CharacterProvider>;
}
beforeEach(() => vi.clearAllMocks()); afterEach(cleanup);
describe("actual provider ASI acceptance and stale callbacks; persistence simulated", () => {
  it("live provider/print use earned14; nonzero saving-throw and skill controls stop using fallback0", () => {
    render(<Fixture fixture={originalAsiFixture()} />);
    expect(latest.evalResult.stats.strength).toBe(14);
    expect(latest.mechanics.status).toBe("available");
    expect(buildCharacterPrintModel({ ...latest, isOwner: true, hasSheet: true, resources: [] }).abilities.find(entry => entry.name === "Strength")?.score).toBe(14);
    // Actual controls construct +2 requests; old stats-only lookups construct +0.
    fireEvent.click(screen.getByRole("button", { name: "Roll Strength saving throw" }));
    fireEvent.click(screen.getByRole("button", { name: "Roll" }));
    fireEvent.click(screen.getByRole("button", { name: "Roll Athletics check" }));
    fireEvent.click(screen.getByRole("button", { name: "Roll" }));
    expect(executeRoll).toHaveBeenCalledTimes(2); expect(insertRoll).toHaveBeenCalledTimes(2);
    expect(executeRoll).toHaveBeenNthCalledWith(1, expect.objectContaining({ expression: "1d20+2" }));
    expect(executeRoll).toHaveBeenNthCalledWith(2, expect.objectContaining({ expression: "1d20+2" }));
  });
  it("retained callback refuses changed choices/grants without raw-state change before RNG/log/DAL/print", async () => {
    const first = originalAsiFixture(), view = render(<Fixture fixture={first} />), retained = latest;
    const next = originalAsiFixture({ mode: "asi", allocations: [{ ability: "wisdom", amount: 2 }] }); next.character.state = first.character.state;
    view.rerender(<Fixture fixture={next} />);
    expect(() => retained.roll({ kind: "attack", label: "Original attack", expression: "1d20+2" }, { abilities: ["strength"] })).toThrow(/changed/);
    await expect(retained.patchActionState({ current_hp: 4 })).rejects.toThrow(/changed/);
    await expect(retained.longRest()).resolves.toBe(false);
    expect(() => buildCharacterPrintModel({ ...retained, isOwner: true, hasSheet: true, resources: [] })).toThrow(/changed/);
    expect(executeRoll).not.toHaveBeenCalled(); expect(insertRoll).not.toHaveBeenCalled(); expect(updateCharacterState).not.toHaveBeenCalled();
  });
  it("actual HPTracker rejects unconfirmed relative damage without DAL and retains input; confirmed damage works", async () => {
    const f = originalAsiFixture(), view = render(<Fixture fixture={f} ui="hp" incomplete />);
    fireEvent.click(screen.getByRole("button", { name: /HP tracker/i }));
    fireEvent.change(await screen.findByPlaceholderText("Amount"), { target: { value: "2" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Damage" })));
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be saved/); expect(screen.getByPlaceholderText("Amount")).toHaveValue(2);
    expect(updateCharacterState).not.toHaveBeenCalled();
    view.rerender(<Fixture fixture={f} ui="hp" />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Damage" })));
    expect(updateCharacterState).toHaveBeenCalledTimes(1); expect(latest.state.current_hp).toBe(3);
  });
  it("actual ActionsTab uses earned weapon STR, arms crit, then clears stale crit on changed committed choices", async () => {
    const f = originalAsiFixture(), weapon = originalAsiPin("weapon", "original-asi-mallet", { weapon_category: "Simple", weapon_range: "Melee", damage: { dice: "1d6", type: "bludgeoning" }, range: { normal: 5 } }, asiId(88));
    f.refs.push(f.ref(weapon, asiId(89)));
    const view = render(<Fixture fixture={f} ui="weapon" />);
    expect(screen.getByRole("button", { name: /original-asi-mallet damage/ })).toHaveTextContent("1d6 +2");
    const random = vi.spyOn(Math, "random").mockReturnValue(0.999);
    try { fireEvent.click(screen.getByRole("button", { name: /original-asi-mallet attack/ })); fireEvent.click(screen.getByRole("button", { name: "Roll" })); } finally { random.mockRestore(); }
    expect(screen.getByText("Crit!")).toBeInTheDocument();
    const next = originalAsiFixture({ mode: "asi", allocations: [{ ability: "wisdom", amount: 2 }] }); next.refs.push(next.ref(weapon, asiId(89))); next.character.state = f.character.state;
    view.rerender(<Fixture fixture={next} ui="weapon" />);
    expect(screen.queryByText("Crit!")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /original-asi-mallet damage/ }));
    expect(executeRoll).toHaveBeenLastCalledWith(expect.objectContaining({ expression: "1d6+1" }));
    expect(vi.mocked(executeRoll).mock.calls.at(-1)![0].crit).not.toBe(true);
  });
  it("actual captured print preview refuses window.print after same-state ability change", () => {
    const f = originalAsiFixture(), view = render(<Fixture fixture={f} ui="print" />), print = vi.spyOn(window, "print").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "Print / Save PDF" }));
    const dialog = screen.getByRole("dialog", { name: "Print preview" });
    expect(dialog).toHaveTextContent("Strength");
    const next = { ...f, character: { ...f.character, base_stats: { ...f.character.base_stats, strength: 16 } } };
    view.rerender(<Fixture fixture={next} ui="print" />);
    fireEvent.click(within(dialog).getByRole("button", { name: "Print / Save PDF" }));
    expect(print).not.toHaveBeenCalled(); expect(screen.getByRole("alert")).toHaveTextContent(/changed/);
    print.mockRestore();
  });
  it("confirmed ASI CON16/mod3 hit die and whole long rest remain usable with one complete reset", async () => {
    const f = originalAsiFixture({ mode: "asi", allocations: [{ ability: "constitution", amount: 2 }] });
    f.character.state = { ...f.character.state, temp_hp: 3, exhaustion: 2, spell_slots_used: { "1": 1 }, death_saves: { successes: 1, failures: 1 }, hit_dice_spent: { [f.cls.slug]: 1 } };
    render(<Fixture fixture={f} />);
    expect(latest.maxHp).toBe(35);
    await act(async () => { await latest.spendHitDie(f.cls.slug); });
    expect(executeRoll).toHaveBeenCalledWith(expect.objectContaining({ kind: "hit_die", expression: "1d8+3" }));
    vi.mocked(updateCharacterState).mockClear();
    await act(async () => { expect(await latest.longRest()).toBe(true); });
    expect(updateCharacterState).toHaveBeenCalledTimes(1);
    expect(latest.state).toMatchObject({ current_hp: 35, temp_hp: 0, exhaustion: 1, death_saves: { successes: 0, failures: 0 }, spell_slots_used: { "1": 0 }, hit_dice_spent: { [f.cls.slug]: 0 } });
  });
  it("review regression finite nonlinear CON modifier refuses live hit dice before RNG/log/DAL", async () => {
    const f = originalAsiFixture({ mode: "asi", allocations: [{ ability: "constitution", amount: 2 }] });
    const schema = { ...asiSchema, derived_stats: [...asiSchema.derived_stats.filter(entry => entry.slug !== "constitution_mod"), { slug: "constitution_mod", name: "Nonlinear CON modifier control", formula: "constitution" }] };
    render(<Fixture fixture={f} testSchema={schema} />);
    expect(latest.evalResult.stats.constitution).toBe(16); expect(latest.evalResult.computed.constitution_mod).toBe(16);
    await expect(latest.spendHitDie(f.cls.slug)).rejects.toThrow(/hit.die|protocol/i);
    expect(executeRoll).not.toHaveBeenCalled(); expect(insertRoll).not.toHaveBeenCalled(); expect(updateCharacterState).not.toHaveBeenCalled();
  });
  it("incomplete evidence blocks whole long rest/relative HP/derived rolls, but independent custom dice and toggles remain usable", async () => {
    render(<Fixture fixture={originalAsiFixture()} incomplete />);
    await expect(latest.longRest()).resolves.toBe(false);
    expect(() => latest.roll({ kind: "check", label: "Original check", expression: "1d20+2" }, { abilities: ["strength"] })).toThrow();
    await expect(latest.patchActionState({ current_hp: 10 })).rejects.toThrow();
    expect(executeRoll).not.toHaveBeenCalled(); expect(insertRoll).not.toHaveBeenCalled(); expect(updateCharacterState).not.toHaveBeenCalled();
    act(() => latest.roll({ kind: "custom", label: "Independent die", expression: "1d6" }));
    await act(async () => { await latest.patchConditionalState({ independent_test_toggle: true }); });
    expect(executeRoll).toHaveBeenCalledTimes(1); expect(insertRoll).toHaveBeenCalledTimes(1); expect(updateCharacterState).toHaveBeenCalledTimes(1);
  });
});
