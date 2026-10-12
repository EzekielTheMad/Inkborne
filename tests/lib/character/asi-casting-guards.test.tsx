import { useEffect } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CharacterProvider, useCharacter, useSpells, useRolls } from "@/lib/character/character-context";
import { buildCharacterStructuredSources } from "@/lib/character/structured-sources";
import { originalAsiFixture, asiSchema } from "../../fixtures/r06-asi";
import { originalSubclassFixture, originalSubclass, originalSubclassData } from "../../fixtures/subclass-casting";
import { updateCharacterState } from "@/lib/sheet/update-state";
import { updateCharacterSpell } from "@/lib/supabase/spells";
import { executeRoll } from "@/lib/dice/roller";
import { insertRoll } from "@/lib/supabase/rolls";
import type { AsiEvidence } from "@/lib/character/asi-contributions";
vi.mock("@/lib/sheet/update-state", () => ({ updateCharacterState: vi.fn(async () => {}) }));
vi.mock("@/lib/supabase/rolls", () => ({ insertRoll: vi.fn(async () => {}) }));
vi.mock("@/lib/supabase/spells", () => ({ addCharacterSpell: vi.fn(), updateCharacterSpell: vi.fn(async () => {}), removeCharacterSpell: vi.fn() }));
vi.mock("@/lib/supabase/inventory", () => ({ addInventoryItem: vi.fn(), updateInventoryItem: vi.fn(), removeInventoryItem: vi.fn(), unequipAllArmor: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => { throw new Error("No hosted calls in original casting guard fixture"); } }));
vi.mock("@/lib/dice/roller", async original => { const module = await original<typeof import("@/lib/dice/roller")>(); return { ...module, executeRoll: vi.fn(module.executeRoll) }; });
let latest: ReturnType<typeof useCharacter> & ReturnType<typeof useSpells> & ReturnType<typeof useRolls>;
function Probe() { const character = useCharacter(), spells = useSpells(), rolls = useRolls(); useEffect(() => { latest = { ...character, ...spells, ...rolls }; }); return null; }
function originalCasting() {
  const source = originalSubclassFixture(3), base = originalAsiFixture();
  const refs = [source.contentRefs[0], originalSubclass(originalSubclassData(true))];
  const spells = source.spells.map(spell => ({ ...spell, is_prepared: true }));
  const character = { ...base.character, ...source.character, level: 3, base_stats: { ...base.character.base_stats, intelligence: 14, level: 3 },
    state: { current_hp: 4, temp_hp: 0, spell_slots_used: {}, hit_dice_spent: { warden: 0 } }, choices: { ...source.character.choices, hp_rolls: {} } };
  const evidence: AsiEvidence = { status: "complete", character_id: character.id, system_id: character.system_id, refs, grants: [] };
  return { character, evidence, refs, spells };
}
function Fixture({ source, incomplete = false }: { source: ReturnType<typeof originalCasting>; incomplete?: boolean }) {
  return <CharacterProvider character={source.character} schema={asiSchema} contentRefs={source.refs} contentSnapshotsComplete={!incomplete}
    initialState={source.character.state} initialSpells={source.spells} initialInventory={[]} classData={{ warden: { slug: "warden", data: { hit_die: 10 } } }}
    allEffects={source.refs.flatMap(ref => ref.content_definitions.effects)} baseStatsWithLevel={source.character.base_stats}
    structuredSources={buildCharacterStructuredSources(source.refs, 3, { character: source.character, evidence: incomplete ? { status: "unavailable", reason: "incomplete_evidence" } : source.evidence })}
    isOwner isDm={false} hasSheet maxHp={24} primaryColor={null} onPrimaryColorChange={() => {}}><Probe /></CharacterProvider>;
}
beforeEach(() => vi.clearAllMocks()); afterEach(cleanup);
describe("actual provider casting/preparation committed ASI mechanics, persistence simulated", () => {
  it("complete six-slot/empty-earned-choice proof remains usable for a real selected casting source", async () => {
    const source = originalCasting(); render(<Fixture source={source} />);
    expect(latest.getCastingAbility(source.spells[0])).toMatchObject({ status: "available", profile: { abilityModifier: 2, spellAttackBonus: 4, spellDc: 12 } });
    await act(async () => { await latest.updateSpell(source.spells[0].id, { is_prepared: false }); });
    expect(updateCharacterSpell).toHaveBeenCalledTimes(1);
  });
  it("stale retained casting/preparation callbacks refuse changed abilities without a raw-state change", async () => {
    const source = originalCasting(), view = render(<Fixture source={source} />), retained = latest;
    const changed = { ...source, character: { ...source.character, base_stats: { ...source.character.base_stats, intelligence: 18 } } };
    view.rerender(<Fixture source={changed} />);
    await expect(retained.updateSpell(source.spells[0].id, { is_prepared: false })).rejects.toThrow(/changed/);
    await expect(retained.castSpell(source.spells[0], { type: "slot", level: 1 })).rejects.toThrow(/changed/);
    expect(executeRoll).not.toHaveBeenCalled(); expect(insertRoll).not.toHaveBeenCalled(); expect(updateCharacterSpell).not.toHaveBeenCalled(); expect(updateCharacterState).not.toHaveBeenCalled();
  });
  it("incomplete evidence refuses casting/preparation before DAL or RNG", async () => {
    const source = originalCasting(); render(<Fixture source={source} incomplete />);
    expect(latest.getCastingAbility(source.spells[0]).status).toBe("unavailable");
    await expect(latest.castSpell(source.spells[0], { type: "slot", level: 1 })).rejects.toThrow();
    await expect(latest.updateSpell(source.spells[0].id, { is_prepared: false })).rejects.toThrow();
    expect(executeRoll).not.toHaveBeenCalled(); expect(insertRoll).not.toHaveBeenCalled(); expect(updateCharacterSpell).not.toHaveBeenCalled(); expect(updateCharacterState).not.toHaveBeenCalled();
  });
});
