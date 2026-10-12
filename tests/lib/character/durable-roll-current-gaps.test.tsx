import { pinnedSlotClass } from "../../fixtures/pinned-slot-class";
import { useEffect } from "react";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CharacterProvider, useCharacterState, useRest, useRolls } from "@/lib/character/character-context";
import { CharacterStateReloadError } from "@/lib/character/state-save-error";
import { updateCharacterState } from "@/lib/sheet/update-state";
import { insertRoll } from "@/lib/supabase/rolls";
import { executeRoll } from "@/lib/dice/roller";
import type { CharacterState } from "@/lib/types/character";

vi.mock("@/lib/sheet/update-state", () => ({ updateCharacterState: vi.fn() }));
vi.mock("@/lib/supabase/rolls", () => ({ insertRoll: vi.fn() }));
vi.mock("@/lib/dice/roller", () => ({ executeRoll: vi.fn() }));
vi.mock("@/lib/supabase/inventory", () => ({ addInventoryItem: vi.fn(), updateInventoryItem: vi.fn(), removeInventoryItem: vi.fn(), unequipAllArmor: vi.fn() }));
vi.mock("@/lib/supabase/spells", () => ({ addCharacterSpell: vi.fn(), updateCharacterSpell: vi.fn(), removeCharacterSpell: vi.fn() }));

type Handles = { rest: ReturnType<typeof useRest>; state: ReturnType<typeof useCharacterState>; rolls: ReturnType<typeof useRolls> };
let handles: Handles;
const baseline: CharacterState = { current_hp: 10, hit_dice_spent: { fighter: 0 } };
function Probe() {
  const rest = useRest(); const state = useCharacterState(); const rolls = useRolls();
  useEffect(() => { handles = { rest, state, rolls }; }, [rest, state, rolls]);
  return null;
}
function Fixture() {
  return <CharacterProvider
    character={{ id: "local-character", system_id: "local-system", user_id: "local-owner", state: baseline, choices: { classes: [{ slug: "fighter", level: 2 }] }, base_stats: {}, narrative: {} } as never}
    schema={{ ability_scores: [], proficiency_levels: [], derived_stats: [], skills: [], resources: [], content_types: [], currencies: [], creation_steps: [], sheet_sections: [] } as never}
    contentRefs={[pinnedSlotClass("fighter", 2, null, null)]} initialState={baseline} initialInventory={[]} initialSpells={[]}
    classData={{ fighter: { slug: "fighter", data: { hit_die: 10 } } } as never}
    allEffects={[]} baseStatsWithLevel={{ level: 2, constitution: 10 }} structuredSources={{}}
    isOwner isDm={false} hasSheet maxHp={20} primaryColor={null} onPrimaryColorChange={() => {}}
  ><Probe /></CharacterProvider>;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(insertRoll).mockResolvedValue(undefined);
  vi.mocked(updateCharacterState).mockResolvedValue(undefined);
  vi.mocked(executeRoll).mockImplementation(request => ({
    request, groups: [{ sides: 10, rolls: [3], kept: [3] }], modifier: 0,
    total: 3, rolled_at: "2026-10-11T18:00:00.000Z",
  }));
});

describe("current durable roll gaps: real provider with simulated persistence", () => {
  it("retains a separately inserted hit-die roll when its state patch is rejected", async () => {
    vi.mocked(updateCharacterState).mockRejectedValueOnce(new CharacterStateReloadError("Rejected state"));
    render(<Fixture />);
    await act(async () => { await expect(handles.rest.spendHitDie("fighter")).rejects.toThrow("Rejected state"); });
    expect(insertRoll).toHaveBeenCalledOnce();
    expect(handles.rolls.rolls).toHaveLength(1);
    expect(handles.state.state).toEqual(baseline);
  });
  it("confirms a hit-die state spend while its separate roll insertion remains pending", async () => {
    let finishInsert!: () => void;
    vi.mocked(insertRoll).mockReturnValueOnce(new Promise<void>(resolve => { finishInsert = resolve; }));
    render(<Fixture />);
    await act(async () => { expect((await handles.rest.spendHitDie("fighter"))?.total).toBe(3); });
    expect(handles.state.state).toEqual({ current_hp: 13, hit_dice_spent: { fighter: 1 } });
    expect(updateCharacterState).toHaveBeenCalledOnce();
    await act(async () => { finishInsert(); });
  });
  it("rolls UI back after a simulated committed state write loses its response, without proving rollback", async () => {
    let stored = structuredClone(baseline);
    vi.mocked(updateCharacterState).mockImplementationOnce(async (_id, patch) => {
      stored = { ...stored, ...patch };
      throw new CharacterStateReloadError("The character save could not be confirmed");
    });
    render(<Fixture />);
    await act(async () => { await expect(handles.rest.spendHitDie("fighter")).rejects.toThrow("could not be confirmed"); });
    expect(stored).toEqual({ current_hp: 13, hit_dice_spent: { fighter: 1 } });
    expect(handles.state.state).toEqual(baseline);
    expect(handles.state.reloadRequired).toBe(true);
    await act(async () => { await expect(handles.rest.spendHitDie("fighter")).rejects.toThrow("could not be confirmed"); });
    expect(executeRoll).toHaveBeenCalledOnce();
    expect(insertRoll).toHaveBeenCalledOnce();
    expect(updateCharacterState).toHaveBeenCalledOnce();
  });
});
