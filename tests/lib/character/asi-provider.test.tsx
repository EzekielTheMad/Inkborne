import { useEffect } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CharacterProvider, useCharacter, useCharacterState, useRolls, useRest, useSpells, useInventory, useResources, useConcentration } from "@/lib/character/character-context";
import { buildCharacterStructuredSources } from "@/lib/character/structured-sources";
import { originalAsiFixture, asiSchema } from "../../fixtures/r06-asi";
import { updateCharacterState } from "@/lib/sheet/update-state";
import { insertRoll } from "@/lib/supabase/rolls";
import { executeRoll } from "@/lib/dice/roller";
import { buildCharacterPrintModel } from "@/lib/character/print-model";
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
function Probe() {
  const character = useCharacter(), state = useCharacterState(), rolls = useRolls(), rest = useRest(), spells = useSpells();
  const inventory = useInventory(), resources = useResources(), concentration = useConcentration();
  useEffect(() => { latest = { ...character, ...state, ...rolls, ...rest, ...spells, ...inventory, ...resources, pendingConcentrationCheck: concentration.pendingCheck }; });
  return <><SavingThrows schema={character.schema} evalResult={character.evalResult} /><SkillsList schema={character.schema} evalResult={character.evalResult} /></>;
}
function Fixture({ fixture, incomplete = false, testSchema = asiSchema }: { fixture: ReturnType<typeof originalAsiFixture>; incomplete?: boolean; testSchema?: typeof asiSchema }) {
  const { character, refs, cls, evidence } = fixture;
  return <CharacterProvider character={character} schema={testSchema} contentRefs={refs} contentSnapshotsComplete={!incomplete}
    initialState={character.state} initialInventory={[]} initialSpells={[]} classData={{ [cls.slug]: { slug: cls.slug, data: cls.data } }}
    allEffects={refs.flatMap(ref => ref.content_definitions.effects)} baseStatsWithLevel={{ ...character.base_stats, level: 4 }}
    structuredSources={buildCharacterStructuredSources(refs, 4, { character, evidence: incomplete ? { status: "unavailable", reason: "incomplete_evidence" } : evidence })}
    isOwner isDm={false} hasSheet maxHp={31} primaryColor={null} onPrimaryColorChange={() => {}}><Probe /></CharacterProvider>;
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
    expect(() => retained.longRest()).toThrow(/changed/);
    expect(() => buildCharacterPrintModel({ ...retained, isOwner: true, hasSheet: true, resources: [] })).toThrow(/changed/);
    expect(executeRoll).not.toHaveBeenCalled(); expect(insertRoll).not.toHaveBeenCalled(); expect(updateCharacterState).not.toHaveBeenCalled();
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
    expect(() => latest.longRest()).toThrow();
    expect(() => latest.roll({ kind: "check", label: "Original check", expression: "1d20+2" }, { abilities: ["strength"] })).toThrow();
    await expect(latest.patchActionState({ current_hp: 10 })).rejects.toThrow();
    expect(executeRoll).not.toHaveBeenCalled(); expect(insertRoll).not.toHaveBeenCalled(); expect(updateCharacterState).not.toHaveBeenCalled();
    act(() => latest.roll({ kind: "custom", label: "Independent die", expression: "1d6" }));
    await act(async () => { await latest.patchConditionalState({ independent_test_toggle: true }); });
    expect(executeRoll).toHaveBeenCalledTimes(1); expect(insertRoll).toHaveBeenCalledTimes(1); expect(updateCharacterState).toHaveBeenCalledTimes(1);
  });
});
