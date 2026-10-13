import { act, cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CharacterProvider, useCharacter, useCharacterState, useRolls, useConcentration, useInventory, useSpells, useRest, useResources } from "@/lib/character/character-context";
import { SavingThrows } from "@/components/sheet/saving-throws";
import { ConcentrationPrompt } from "@/components/sheet/concentration-prompt";
import { CharacterPrintAction } from "@/components/sheet/character-print-action";
import { buildCharacterPrintModel } from "@/lib/character/print-model";
import type { CharacterPrintInput } from "@/lib/character/print-model";
import type { RollRequest } from "@/lib/dice/types";
import { saveBonusFixture } from "../../fixtures/save-bonus-consumers";

// BEFORE/AFTER suite deliberately imports ONLY APIs present at353858c.
// Restore all seven old production files together for the actual-old baseline.
// No new readiness export and no updated e2e/print fixture is imported here.
vi.mock("@/lib/sheet/update-state", () => ({ updateCharacterState: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/supabase/inventory", () => ({ addInventoryItem: vi.fn(), updateInventoryItem: vi.fn(), removeInventoryItem: vi.fn(), unequipAllArmor: vi.fn() }));
vi.mock("@/lib/supabase/spells", () => ({ addCharacterSpell: vi.fn(), updateCharacterSpell: vi.fn(), removeCharacterSpell: vi.fn() }));
vi.mock("@/lib/supabase/rolls", () => ({ insertRoll: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/dice/roller", () => ({ executeRoll: vi.fn((request: RollRequest) => ({ request,
  groups: [{ sides: 20, rolls: [15], kept: [15] }], modifier: 0, total: 20, natural: 15,
  rolled_at: "2026-10-13T15:01:00.000Z" })) }));
import { executeRoll } from "@/lib/dice/roller";
import { insertRoll } from "@/lib/supabase/rolls";

let loaded: CharacterPrintInput;
let concentration: ReturnType<typeof useConcentration>;
function Consumer() {
  const character = useCharacter(), state = useCharacterState(), rolls = useRolls(), inventory = useInventory(),
    spells = useSpells(), rest = useRest(), resources = useResources(), check = useConcentration();
  useLayoutEffect(() => {
    loaded = { ...character, ...state, ...rolls, ...inventory, ...spells, ...rest, ...resources, pendingConcentrationCheck: check.pendingCheck };
    concentration = check;
  });
  return <><SavingThrows schema={character.schema} evalResult={character.evalResult} /><ConcentrationPrompt /><CharacterPrintAction /></>;
}
function mount(activeBonus: number | null, concentrating = false) {
  const f = saveBonusFixture([], activeBonus);
  if (concentrating) f.state.concentrating_on = { spell_slug: "synthetic-light", spell_name: "Synthetic Light", slot_level: 1,
    started_at: "2026-10-13T15:00:00.000Z" };
  render(<CharacterProvider character={f.character} schema={f.schema} contentRefs={f.refs} contentSnapshotsComplete
    initialState={f.state} initialInventory={[]} initialSpells={[]} classData={f.classData} allEffects={f.contentEffects}
    baseStatsWithLevel={f.base} structuredSources={f.sources} isOwner isDm={false} hasSheet maxHp={24}
    primaryColor={null} onPrimaryColorChange={() => {}}><Consumer /></CharacterProvider>);
  expect(loaded.mechanics.status).toBe("available");
  expect(loaded.contentSnapshotsComplete).toBe(true);
  expect(loaded.contentRefs.find(ref => ref.content_definitions.content_type === "feat")?.content_version).toBe(3);
  expect(f.current.version).toBe(3); expect(f.pin.version).toBe(3);
  if (activeBonus !== null) expect(loaded.evalResult.stats.saving_throw_bonus).toBe(activeBonus);
  return f;
}
beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("old-API-compatible actual producer/provider/consumer bonus workflow", () => {
  it("valid positive: actual no-bonus save request and paper modifier remain +4", async () => {
    mount(null);
    const button = screen.getByRole("button", { name: "Roll Constitution saving throw" });
    expect(button).toBeEnabled(); expect(button).toHaveTextContent("+4");
    fireEvent.click(button); fireEvent.click(await screen.findByRole("button", { name: /^Roll$/ }));
    expect(executeRoll).toHaveBeenCalledWith(expect.objectContaining({ kind: "save", expression: "1d20+4" }));
    expect(buildCharacterPrintModel(loaded).abilities.find(entry => entry.name === "Constitution")?.save).toBe("+4");
  });
  it("actual +1 producer/evaluator reaches save card: expected +5, old +4", () => {
    mount(1);
    expect(screen.getByRole("button", { name: "Roll Constitution saving throw" })).toHaveTextContent("+5");
  });
  it("actual +1 producer/evaluator reaches ordinary save request: expected +5, old +4", async () => {
    mount(1);
    const button = screen.getByRole("button", { name: "Roll Constitution saving throw" });
    expect(button).toBeEnabled(); fireEvent.click(button);
    fireEvent.click(await screen.findByRole("button", { name: /^Roll$/ }));
    expect(executeRoll).toHaveBeenCalledTimes(1);
    expect(insertRoll).toHaveBeenCalledTimes(1);
    expect(executeRoll).toHaveBeenCalledWith(expect.objectContaining({ kind: "save", expression: "1d20+5" }));
  });
  it("actual +1 producer/evaluator reaches CON request: expected +5, old +4", async () => {
    mount(1, true); act(() => { concentration.requestCheck(22); });
    const dialog = screen.getByRole("dialog", { name: "Concentration Check" });
    const button = within(dialog).getByRole("button", { name: /^Roll CON Save/ });
    expect(button).toBeEnabled(); fireEvent.click(button);
    await waitFor(() => expect(executeRoll).toHaveBeenCalledTimes(1));
    expect(executeRoll).toHaveBeenCalledWith(expect.objectContaining({ kind: "concentration", expression: "1d20+5" }));
  });
  it("actual +1 producer/evaluator reaches paper values: expected +5, old +4", () => {
    mount(1);
    const model = buildCharacterPrintModel(loaded);
    expect(model.abilities.find(entry => entry.name === "Constitution")?.save).toBe("+5");
    expect(model.abilities.find(entry => entry.name === "Strength")?.save).toBe("+1");
  });
  it("actual +1 producer/evaluator reaches print preview: expected +5, old +4", () => {
    mount(1);
    const button = screen.getByRole("button", { name: "Print / Save PDF" });
    expect(button).toBeEnabled(); fireEvent.click(button);
    const preview = screen.getByRole("dialog", { name: "Print preview" });
    expect(within(preview).getByRole("row", { name: /Constitution 14 \+2 \+5/ })).toBeVisible();
  });
});
