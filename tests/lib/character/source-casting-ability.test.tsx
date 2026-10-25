import { providerAbilities, providerBase, providerSources, providerCharacterId, providerSystemId } from "../../fixtures/provider-mechanics";
import { useEffect, useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CharacterProvider, useSpells, useRolls } from "@/lib/character/character-context";
import { CastDialog } from "@/components/sheet/spells/cast-dialog";
import { SpellHeader } from "@/components/sheet/spells/spell-header";
import { castingAbilityFixture } from "../../fixtures/casting-acquisitions";
import type { CharacterState } from "@/lib/types/character";
import type { CharacterSpell } from "@/lib/types/spells";
import { insertRoll } from "@/lib/supabase/rolls";
import { addCharacterSpell } from "@/lib/supabase/spells";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));
vi.mock("@/lib/supabase/inventory", () => ({ addInventoryItem: vi.fn(), updateInventoryItem: vi.fn(), removeInventoryItem: vi.fn(), unequipAllArmor: vi.fn() }));
vi.mock("@/lib/supabase/spells", () => ({ addCharacterSpell: vi.fn(), updateCharacterSpell: vi.fn(), removeCharacterSpell: vi.fn() }));
vi.mock("@/lib/supabase/rolls", () => ({ insertRoll: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/builder/use-is-mobile", () => ({ useIsMobile: () => false }));

let stored: CharacterState;
let spells: ReturnType<typeof useSpells>, rolls: ReturnType<typeof useRolls>;
function persist(_name: string, args: { expected_state: CharacterState; state_patch: Partial<CharacterState> }) {
  expect(args.expected_state).toEqual(stored);
  stored = { ...stored, ...args.state_patch };
  return { error: null, data: [{ status: "applied", resulting_state: structuredClone(stored) }] };
}
function Probe({ target }: { target: CharacterSpell }) {
  const s = useSpells(), r = useRolls();
  const [open, setOpen] = useState(false);
  useEffect(() => { spells = s; rolls = r; }, [s, r]);
  return <><SpellHeader /><button onClick={() => setOpen(true)}>Inspect cast</button><CastDialog open={open} spell={target} castability="full" onClose={() => setOpen(false)} /></>;
}
function fixture(intelligence = 18, charisma = 10, options: { classSlug?: string; viewer?: boolean; missing?: boolean } = {}) {
  const input = castingAbilityFixture(intelligence, charisma);
  input.character = { ...input.character, id: providerCharacterId, system_id: providerSystemId };
  input.spells = input.spells.map(row => ({ ...row, character_id: providerCharacterId,
    content_definitions: { ...row.content_definitions!, system_id: providerSystemId } }));
  input.contentRefs = input.contentRefs.map((ref, index) => ({ ...ref, id: `c1111111-1111-4111-8111-${String(index + 1).padStart(12, "0")}`,
    character_id: providerCharacterId, feature_grant_id: null, content_definitions: { ...ref.content_definitions, system_id: providerSystemId } }));
  const target = input.spells.find(row => row.class_slug === (options.classSlug ?? "warlock"))!;
  let schema = { ability_scores: providerAbilities, derived_stats: [{ slug: "proficiency_bonus", name: "Proficiency bonus", base: 3 }], skills: [], proficiency_levels: [], resources: [], currencies: [], content_types: [], creation_steps: [], sheet_sections: [] };
  const provider = () => {
    const character = { ...input.character, name: "Original Multiclass Fixture", level: 6, state: structuredClone(stored), narrative: {}, base_stats: { ...providerBase, intelligence, charisma } };
    return <CharacterProvider character={character as never}
    schema={schema} contentRefs={input.contentRefs} contentSnapshotsComplete initialState={structuredClone(stored)} initialInventory={[]} initialSpells={options.missing ? [] : [...input.spells]}
    classData={Object.fromEntries(input.contentRefs.map(ref => [ref.content_definitions.slug, { slug: ref.content_definitions.slug, data: ref.content_definitions.data }])) as never}
    allEffects={[]} baseStatsWithLevel={{ ...character.base_stats, level: 6 }} structuredSources={providerSources(character, input.contentRefs)} isOwner={!options.viewer} isDm={!!options.viewer} hasSheet maxHp={20} primaryColor={null} onPrimaryColorChange={() => {}}><Probe target={target} /></CharacterProvider>;
  };
  const view = render(provider());
  return { target, input, refresh: (newIntelligence = intelligence, changeSchema?: "ability" | "proficiency") => { intelligence = newIntelligence; if (changeSchema === "ability") schema = { ...schema, ability_scores: schema.ability_scores.filter(ability => ability.slug !== "intelligence") }; if (changeSchema === "proficiency") schema = { ...schema, derived_stats: [{ slug: "proficiency_bonus", name: "Proficiency bonus", base: 4 }] }; view.rerender(provider()); }, makeViewer: () => { options.viewer = true; view.rerender(provider()); } };
}
beforeEach(() => { stored = { current_hp: 20, spell_slots_used: {}, active_effects: [], concentrating_on: null }; rpc.mockReset().mockImplementation(persist); vi.mocked(insertRoll).mockClear(); });

describe("actual provider acquisition casting", () => {
  it.each([[18, 10, "warlock"], [10, 18, "wizard"]] as const)("keeps global summary but displays and emits the weaker class's attack/DC/MOD (%s/%s/%s)", async (intelligence, charisma, classSlug) => {
    const { target } = fixture(intelligence, charisma, { classSlug });
    expect(spells.casterInfo).toMatchObject({ spellAttackBonus: 7, spellDc: 15 });
    expect(screen.getByText(/Highest class/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Inspect cast" }));
    expect(screen.getByText(/spell attack \+3/)).toBeInTheDocument();
    expect(screen.getByText(/save DC 11/)).toBeInTheDocument();
    expect(screen.getByText(/1d8 \+ 0/)).toBeInTheDocument();
    let outcome!: Awaited<ReturnType<typeof spells.castSpell>>;
    await act(async () => { outcome = await spells.castSpell(target, classSlug === "warlock" ? { type: "pact", level: 2 } : { type: "slot", level: 1 }); });
    expect(outcome.rollRequests[0].expression).toBe("1d20+3"); expect(outcome.dcInfo?.dc).toBe(11);
    expect(outcome.rollRequests.find(request => request.kind === "heal")?.expression).toBe("1d4 + 0");
    expect(stored.concentrating_on).toMatchObject({ spell_slug: "prism-signal" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("ignores forged same-identity snapshot data/effects and uses the current loaded acquisition", async () => {
    const { target } = fixture(18, 10, { classSlug: "wizard" });
    const forged = { ...target, content_definitions: { ...target.content_definitions!, data: { level: 0, duration: "Instantaneous" }, effects: [{ type: "mechanical", stat: "initiative", op: "add", value: 99 }] } } as typeof target;
    let outcome!: Awaited<ReturnType<typeof spells.castSpell>>;
    await act(async () => { outcome = await spells.castSpell(forged, { type: "slot", level: 1 }); });
    expect(outcome.rollRequests[0].expression).toBe("1d20+7"); expect(outcome.dcInfo?.dc).toBe(15);
    expect(stored.active_effects?.[0].effects).toEqual(target.content_definitions!.effects);
    expect(stored.concentrating_on).toMatchObject({ spell_slug: "prism-signal" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("refuses source-identity substitution before a state write or roll", async () => {
    const { target } = fixture();
    await expect(spells.castSpell({ ...target, class_slug: "wizard" }, { type: "slot", level: 1 })).rejects.toThrow(/source.*unavailable/);
    expect(rpc).not.toHaveBeenCalled(); expect(insertRoll).not.toHaveBeenCalled();
  });
  it("lets a viewer inspect source values but disables UI and rejects provider execution", async () => {
    const { target } = fixture(18, 10, { viewer: true }); fireEvent.click(screen.getByRole("button", { name: "Inspect cast" }));
    expect(screen.getByText(/save DC 11/)).toBeInTheDocument(); expect(screen.getByRole("button", { name: "Cast" })).toBeDisabled();
    await expect(spells.castSpell(target, { type: "slot", level: 1 })).rejects.toThrow(/read-only/); expect(rpc).not.toHaveBeenCalled();
  });
  it("shows unavailable acquisition guidance instead of the global best and produces no write", async () => {
    const { target } = fixture(18, 10, { missing: true }); fireEvent.click(screen.getByRole("button", { name: "Inspect cast" }));
    expect(screen.getByText(/saved casting source is unavailable/)).toBeInTheDocument(); expect(screen.queryByText(/save DC 15/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cast" })).toBeDisabled(); await expect(spells.castSpell(target, { type: "slot", level: 1 })).rejects.toThrow(/unavailable/); expect(rpc).not.toHaveBeenCalled();
  });
  it.each(["ability", "class-pin", "class-choice", "ability-schema", "proficiency", "viewer", "acquisition", "snapshot"])("rejects an old callback after %s changes without a raw state write", async change => {
    const { target, input, refresh, makeViewer } = fixture(18, 10, { classSlug: "wizard" });
    const oldCast = spells.castSpell;
    if (change === "ability") refresh(10);
    if (change === "class-pin") {
      input.contentRefs = input.contentRefs.map(ref => ({ ...ref, content_version: ref.content_version + 1, content_definitions: { ...ref.content_definitions, version: ref.content_version + 1 } }));
      refresh();
    }
    if (change === "class-choice") { input.character.choices = { classes: [{ slug: "warlock", level: 3 }] }; refresh(); }
    if (change === "ability-schema") refresh(18, "ability");
    if (change === "proficiency") refresh(18, "proficiency");
    if (change === "viewer") makeViewer();
    if (change === "snapshot") {
      const updated = { ...target, content_version: 3, content_definitions: { ...target.content_definitions!, version: 3, effects: [{ type: "mechanical", stat: "initiative", op: "add", value: 2 }] } } as CharacterSpell;
      vi.mocked(addCharacterSpell).mockResolvedValueOnce(updated);
      await act(async () => { await spells.removeSpell(target.id); });
      await act(async () => { await spells.addSpell({ content_id: updated.content_id, content_version: 3, name: updated.name, class_slug: updated.class_slug }); });
    }
    if (change === "acquisition") await act(async () => { await spells.removeSpell(target.id); });
    await expect(oldCast(target, { type: "slot", level: 1 })).rejects.toThrow(/source changed/);
    expect(rpc).not.toHaveBeenCalled(); expect(insertRoll).not.toHaveBeenCalled();
    if (["acquisition", "class-choice", "ability-schema"].includes(change)) await expect(spells.castSpell(target, { type: "slot", level: 1 })).rejects.toThrow(/unavailable/);
    else if (change === "viewer") await expect(spells.castSpell(target, { type: "slot", level: 1 })).rejects.toThrow(/read-only/);
    else {
      let outcome!: Awaited<ReturnType<typeof spells.castSpell>>;
      await act(async () => { const current = change === "snapshot" ? { ...target, content_version: 3 } : target; outcome = await spells.castSpell(current, { type: "slot", level: 1 }); });
      expect(outcome.rollRequests[0].expression).toBe(change === "ability" ? "1d20+3" : change === "proficiency" ? "1d20+8" : "1d20+7");
      if (change === "snapshot") expect(stored.active_effects?.[0].effects[0]).toMatchObject({ value: 2 });
    }
  });

  it("preserves the attack request through deterministic roll persistence", async () => {
    const { target } = fixture(); let outcome!: Awaited<ReturnType<typeof spells.castSpell>>;
    await act(async () => { outcome = await spells.castSpell(target, { type: "pact", level: 2 }); });
    const random = vi.spyOn(Math, "random").mockReturnValue(0.999);
    try {
      await act(async () => { const rolling = rolls.rollWithPersistence(outcome.rollRequests[0], { abilities: ["charisma"], computed: ["proficiency_bonus"] }); expect(rolling.result.natural).toBe(20); await rolling.persistence; });
      expect(insertRoll).toHaveBeenCalledWith(providerCharacterId, expect.objectContaining({ request: expect.objectContaining({ expression: "1d20+3" }), natural: 20, total: 23 }), { requireConfirmation: true });
    } finally { random.mockRestore(); }
  });
});
