import { useLayoutEffect } from "react";
import { act, cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CharacterProvider, useCharacter, useCharacterState, useRolls, useConcentration } from "@/lib/character/character-context";
import { SavingThrows } from "@/components/sheet/saving-throws";
import { ConcentrationPrompt } from "@/components/sheet/concentration-prompt";
import { CharacterPrintAction } from "@/components/sheet/character-print-action";
import { getSaveModifier } from "@/lib/sheet/helpers";
import { saveBonusFixture } from "../../fixtures/save-bonus-consumers";
import type { Effect } from "@/lib/types/effects";
import type { RollRequest } from "@/lib/dice/types";

// Only persistence and the dice boundary are modeled. Provider, canonical pins,
// active collection, evaluation, admission and three UI consumers remain actual.
vi.mock("@/lib/sheet/update-state", () => ({ updateCharacterState: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/supabase/inventory", () => ({ addInventoryItem: vi.fn(), updateInventoryItem: vi.fn(), removeInventoryItem: vi.fn(), unequipAllArmor: vi.fn() }));
vi.mock("@/lib/supabase/spells", () => ({ addCharacterSpell: vi.fn(), updateCharacterSpell: vi.fn(), removeCharacterSpell: vi.fn() }));
vi.mock("@/lib/supabase/rolls", () => ({ insertRoll: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/dice/roller", () => ({ executeRoll: vi.fn((request: RollRequest) => ({ request,
  groups: [{ sides: 20, rolls: [15], kept: [15] }], modifier: 5, dice_total: 15, total: 20, natural: 15,
  rolled_at: "2026-10-13T15:01:00.000Z" })) }));
import { executeRoll } from "@/lib/dice/roller";
import { insertRoll } from "@/lib/supabase/rolls";
import { updateCharacterState } from "@/lib/sheet/update-state";

type Fixture = ReturnType<typeof saveBonusFixture>;
type Hooks = ReturnType<typeof useCharacter> & ReturnType<typeof useCharacterState>
  & ReturnType<typeof useRolls> & { concentrationApi: ReturnType<typeof useConcentration> };
let current: Hooks;
function Consumers({ capture }: { capture: (value: Hooks) => void }) {
  const character = useCharacter(), state = useCharacterState(), rolls = useRolls(), concentrationApi = useConcentration();
  useLayoutEffect(() => { capture({ ...character, ...state, ...rolls, concentrationApi }); });
  return <><SavingThrows schema={character.schema} evalResult={character.evalResult} />
    <ConcentrationPrompt /><CharacterPrintAction />
    <output data-testid="saved-roll-count">{rolls.rolls.length}</output></>;
}
function Tree({ fixture, effects = fixture.contentEffects }: { fixture: Fixture; effects?: Effect[] }) {
  return <CharacterProvider character={fixture.character} schema={fixture.schema} contentRefs={fixture.refs}
    contentSnapshotsComplete initialState={fixture.state} initialInventory={[]} initialSpells={[]} classData={fixture.classData}
    allEffects={effects} baseStatsWithLevel={fixture.base} structuredSources={fixture.sources}
    isOwner isDm={false} hasSheet maxHp={24} primaryColor={null} onPrimaryColorChange={() => {}}>
    <Consumers capture={value => { current = value; }} />
  </CharacterProvider>;
}
const saveRequirement = { abilities: ["constitution"], computed: ["proficiency_bonus"], savingThrows: ["constitution"] };
beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("actual save bonus consumers with synthetic canonical loaded inputs", () => {
  it("constructs the producer/pin/evaluator/provider and corrects actual CON save +4→+5", async () => {
    const f = saveBonusFixture(); render(<Tree fixture={f} />);
    expect(current.mechanics.status).toBe("available");
    expect(current.evalResult.stats.saving_throw_bonus).toBe(1);
    expect(getSaveModifier(2, current.evalResult.computed.proficiency_bonus, current.evalResult.grants, "saving_throw_constitution")).toBe(4);
    const con = screen.getByRole("button", { name: "Roll Constitution saving throw" });
    expect(con).toHaveTextContent("+5"); expect(con).toBeEnabled();
    fireEvent.click(con);
    fireEvent.click(await screen.findByRole("button", { name: /^Roll$/ }));
    expect(executeRoll).toHaveBeenCalledWith(expect.objectContaining({ kind: "save", expression: "1d20+5" }));
    expect(insertRoll).toHaveBeenCalledTimes(1); expect(screen.getByTestId("saved-roll-count")).toHaveTextContent("1");
  });
  it.each([false, true])("retains actual no-bonus and trained/untrained positives (%s)", proficient => {
    const f = saveBonusFixture([], null, proficient); render(<Tree fixture={f} />);
    expect(current.mechanics.status).toBe("available");
    expect(screen.getByRole("button", { name: "Roll Constitution saving throw" })).toHaveTextContent(proficient ? "+4" : "+2");
    expect(screen.getByRole("button", { name: "Roll Strength saving throw" })).toHaveTextContent("+0");
    expect(screen.getByRole("button", { name: "Print / Save PDF" })).toBeEnabled();
  });
  it("prints the same admitted six values, with no rolled dice rider or private metadata", () => {
    const f = saveBonusFixture(); f.refs[0].context.private_note = "BONUS_PRIVATE_CONTEXT";
    render(<Tree fixture={f} />);
    fireEvent.click(screen.getByRole("button", { name: "Print / Save PDF" }));
    const preview = screen.getByRole("dialog", { name: "Print preview" });
    expect(within(preview).getByRole("row", { name: /Constitution 14 \+2 \+5/ })).toBeVisible();
    expect(within(preview).getByRole("row", { name: /Strength 10 \+0 \+1/ })).toBeVisible();
    expect(preview.textContent).not.toContain("1d4");
    expect(preview.textContent).not.toContain("BONUS_PRIVATE_CONTEXT");
  });
  it.each(["Roll", "Advantage", "Disadvantage"])("keeps each save rider once in actual %s requests", async mode => {
    const f = saveBonusFixture();
    for (const [index, dice] of ["1d4", "-1d4"].entries()) f.state.active_effects!.push({
      ...f.state.active_effects![0], id: `rider-${index}`, name: `Original rider ${index}`, concentration: false,
      effects: [{ type: "mechanical", stat: "roll_save", op: "add", value: dice }],
    });
    render(<Tree fixture={f} />);
    fireEvent.click(screen.getByRole("button", { name: "Roll Constitution saving throw" }));
    fireEvent.click(await screen.findByRole("button", { name: mode, exact: true }));
    expect(executeRoll).toHaveBeenCalledTimes(1);
    const request = vi.mocked(executeRoll).mock.calls[0][0];
    expect(request.expression).toBe("1d20+5+1d4-1d4");
    expect(request.mode).toBe(mode === "Roll" ? undefined : mode.toLowerCase());
    expect(request.meta?.roll_modifiers).toEqual([{ name: "Original rider 0", dice: "1d4" }, { name: "Original rider 1", dice: "-1d4" }]);
    expect(insertRoll).toHaveBeenCalledTimes(1);
  });
  it("keeps one numeric bonus and one active save rider in actual concentration", async () => {
    const f = saveBonusFixture();
    f.state.concentrating_on = { spell_slug: "synthetic-light", spell_name: "Synthetic Light", slot_level: 1, started_at: "2026-10-13T15:00:00.000Z" };
    f.state.active_effects!.push({ ...f.state.active_effects![0], id: "a6777777-7777-4777-8777-777777777777", name: "Original save rider",
      effects: [{ type: "mechanical", stat: "roll_save", op: "add", value: "1d4" }], concentration: true });
    render(<Tree fixture={f} />);
    act(() => { current.concentrationApi.requestCheck(22); });
    const button = screen.getByRole("button", { name: "Roll CON Save (+5)" });
    fireEvent.click(button);
    await waitFor(() => expect(executeRoll).toHaveBeenCalledTimes(1));
    expect(executeRoll).toHaveBeenCalledWith(expect.objectContaining({ kind: "concentration", expression: "1d20+5+1d4",
      meta: expect.objectContaining({ roll_modifiers: [{ name: "Original save rider", dice: "1d4" }] }) }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Concentration Check" })).toBeNull());
    expect(insertRoll).toHaveBeenCalledTimes(1);
  });
  it.each(["fraction", "string", "routing"] as const)("refuses %s before actual RNG/log/DAL/print while independent controls work", kind => {
    const extra: Effect = kind === "fraction" ? { type: "mechanical", stat: "saving_throw_bonus", op: "add", value: 0.5 }
      : kind === "string" ? { type: "mechanical", stat: "saving_throw_bonus", op: "add", value: "1" }
        : { type: "mechanical", stat: "saving_throw_bonus", op: "formula", expr: "1", tag: "ac_formula" };
    const f = saveBonusFixture([extra], null); render(<Tree fixture={f} />);
    expect(current.mechanics.status).toBe("available");
    expect(screen.getByRole("button", { name: "Roll Constitution saving throw" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Roll Constitution saving throw" })).toHaveTextContent("Unavailable");
    expect(screen.getByRole("button", { name: "Print / Save PDF" })).toBeDisabled();
    const before = current.state;
    expect(() => current.roll({ kind: "save", label: "Constitution Save", expression: "1d20+4" }, saveRequirement)).toThrow(/Saving throws are unavailable/);
    expect(executeRoll).not.toHaveBeenCalled(); expect(insertRoll).not.toHaveBeenCalled(); expect(updateCharacterState).not.toHaveBeenCalled();
    expect(current.state).toBe(before); expect(screen.getByTestId("saved-roll-count")).toHaveTextContent("0");
    act(() => { current.roll({ kind: "check", label: "Independent Wisdom Check", expression: "1d20+1" }, { abilities: ["wisdom"] }); });
    expect(executeRoll).toHaveBeenCalledTimes(1); expect(insertRoll).toHaveBeenCalledTimes(1);
  });
  it("refuses omitted save dependency before dice even with finite supplied values", () => {
    render(<Tree fixture={saveBonusFixture()} />);
    expect(() => current.roll({ kind: "save", label: "Constitution Save", expression: "1d20+5" }, { abilities: ["constitution"], values: [5] })).toThrow(/evaluated bonus inputs/);
    expect(executeRoll).not.toHaveBeenCalled(); expect(insertRoll).not.toHaveBeenCalled();
  });
  it.each(["Keep", "Drop"])("keeps manual concentration %s available when the numeric bonus is invalid", async choice => {
    const f = saveBonusFixture([], 0.5); f.state.concentrating_on = { spell_slug: "synthetic-light", spell_name: "Synthetic Light", slot_level: 1, started_at: "2026-10-13T15:00:00.000Z" };
    render(<Tree fixture={f} />); act(() => { current.concentrationApi.requestCheck(22); });
    expect(screen.getByRole("button", { name: "Roll CON Save (Unavailable)" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Keep" })).toBeEnabled(); expect(screen.getByRole("button", { name: "Drop" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: choice }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Concentration Check" })).toBeNull());
    expect(executeRoll).not.toHaveBeenCalled(); expect(insertRoll).not.toHaveBeenCalled();
    expect(updateCharacterState).toHaveBeenCalledTimes(choice === "Keep" ? 0 : 1);
    if (choice === "Drop") expect(current.state.concentrating_on).toBeNull();
  });
  it("rejects retained roll and print callbacks after effect-only identity changes", () => {
    const f = saveBonusFixture(); const view = render(<Tree fixture={f} />);
    const retainedRoll = current.roll, retainedGuard = current.assertMechanics;
    fireEvent.click(screen.getByRole("button", { name: "Print / Save PDF" }));
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    view.rerender(<Tree fixture={f} effects={[...f.contentEffects, { type: "mechanical", stat: "saving_throw_bonus", op: "add", value: 1 }]} />);
    expect(() => retainedGuard(saveRequirement)).toThrow(/changed/);
    expect(() => retainedRoll({ kind: "save", label: "Constitution Save", expression: "1d20+5" }, saveRequirement)).toThrow(/changed/);
    const preview = screen.getByRole("dialog", { name: "Print preview" });
    fireEvent.click(within(preview).getByRole("button", { name: "Print / Save PDF" }));
    expect(print).not.toHaveBeenCalled(); expect(screen.queryByRole("dialog", { name: "Print preview" })).toBeNull();
    expect(executeRoll).not.toHaveBeenCalled(); expect(insertRoll).not.toHaveBeenCalled(); expect(updateCharacterState).not.toHaveBeenCalled();
  });
});
