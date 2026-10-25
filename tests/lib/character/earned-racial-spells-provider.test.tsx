import { useEffect, useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CharacterProvider, useSpells } from "@/lib/character/character-context";
import { SpellsTab } from "@/components/sheet/tabs/spells-tab";
import { CastDialog } from "@/components/sheet/spells/cast-dialog";
import { earnedRacialFixture, racialId } from "../../fixtures/earned-racial-spells";
import { providerAbilities, providerBase, providerSources } from "../../fixtures/provider-mechanics";
import type { CharacterState } from "@/lib/types/character";
import type { CharacterSpell } from "@/lib/types/spells";
import { insertRoll } from "@/lib/supabase/rolls";
import { transformTraitEntry } from "@/scripts/transformers/traits";
import { resolveOwnedAncestryDefenses } from "@/lib/character/ancestry-defenses";
import darkvision from "../../fixtures/earned-racial-spells/darkvision.json";
import hellishResistance from "../../fixtures/earned-racial-spells/hellish-resistance.json";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));
vi.mock("@/lib/supabase/inventory", () => ({ addInventoryItem: vi.fn(), updateInventoryItem: vi.fn(), removeInventoryItem: vi.fn(), unequipAllArmor: vi.fn() }));
vi.mock("@/lib/supabase/spells", () => ({ addCharacterSpell: vi.fn(), updateCharacterSpell: vi.fn(), removeCharacterSpell: vi.fn() }));
vi.mock("@/lib/supabase/rolls", () => ({ insertRoll: vi.fn() }));
vi.mock("@/lib/builder/use-is-mobile", () => ({ useIsMobile: () => false }));
let latest: ReturnType<typeof useSpells>;
let stored: CharacterState;
function Probe({ target }: { target: CharacterSpell }) {
  const spells = useSpells(), [open, setOpen] = useState(false);
  useEffect(() => { latest = spells; }, [spells]);
  return <><SpellsTab /><button onClick={() => setOpen(true)}>Inspect racial spell</button>
    <CastDialog spell={target} castability="full" open={open} onClose={() => setOpen(false)} /></>;
}
function fixture() {
  const f = earnedRacialFixture(), target = f.spells[0];
  // Complete the genuine root's mandatory trait closure. F2 requires all three
  // owned immutable traits before any provider mechanical action is available.
  for (const [index, api] of [darkvision, hellishResistance].entries()) {
    const trait = transformTraitEntry(api), contentId = racialId(51 + index * 2);
    f.refs.push({ ...f.trait, id: racialId(50 + index * 2), content_id: contentId,
      choice_source: `builder:racial-trait:${api.index}`, content_definitions: { ...f.trait.content_definitions,
        id: contentId, slug: api.index, name: api.name, data: trait.data, effects: trait.effects } });
  }
  expect(resolveOwnedAncestryDefenses(f.character, { status: "complete", character_id: f.character.id,
    system_id: f.character.system_id, refs: f.refs, grants: [] }).status).toBe("available");
  expect(providerSources(f.character, f.refs).asi?.status).toBe("available");
  const ordinary = (classSlug: string, n: number, prepared: boolean): CharacterSpell => {
    const name = `${classSlug === "bard" ? "Bard" : "Wizard"} ordinary control`;
    return { ...target, id: racialId(n), content_id: racialId(n + 1), name,
      class_slug: classSlug, source: "selection", always_prepared: false, is_prepared: prepared, in_spellbook: classSlug === "wizard", custom_data: null,
      content_definitions: { ...target.content_definitions!, id: racialId(n + 1), name, data: { ...target.content_definitions!.data, classes: [classSlug] } } };
  };
  const spells = [...f.spells, ordinary("bard", 40, false), ordinary("wizard", 42, true)];
  const schema = { ability_scores: providerAbilities, derived_stats: [{ slug: "proficiency_bonus", name: "Proficiency bonus", base: 3 }],
    skills: [], proficiency_levels: [], resources: [], currencies: [], content_types: [], creation_steps: [], sheet_sections: [] };
  const base = { ...providerBase, intelligence: 15, charisma: 8, constitution: 12 };
  const provider = () => {
    const character = { ...f.character, user_id: racialId(90), name: "Loaded racial source fixture", base_stats: base,
      state: structuredClone(stored), narrative: {}, narrative_rich: {} };
    return <CharacterProvider character={character as never} schema={schema} contentRefs={f.refs} contentSnapshotsComplete
      initialState={structuredClone(stored)} initialInventory={[]} initialSpells={spells}
      classData={Object.fromEntries(f.refs.map(ref => [ref.content_definitions.slug, { slug: ref.content_definitions.slug, data: ref.content_definitions.data }])) as never}
      allEffects={f.refs.flatMap(ref => ref.content_definitions.effects)} baseStatsWithLevel={{ ...base, level: 5 }} structuredSources={providerSources(character, f.refs)}
      isOwner isDm={false} hasSheet maxHp={20} primaryColor={null} onPrimaryColorChange={() => {}}><Probe target={target} /></CharacterProvider>;
  };
  const view = render(provider());
  return { ...f, target, refresh: () => view.rerender(provider()) };
}
beforeEach(() => {
  stored = { current_hp: 20, spell_slots_used: {}, active_effects: [], concentrating_on: null };
  rpc.mockReset(); vi.mocked(insertRoll).mockClear();
});

describe("earned racial source in the actual provider and spell surfaces", () => {
  it("shows separate racial CHA/DC/fixed2 and leaves ordinary known/prepared counters unchanged", () => {
    fixture();
    expect(screen.getByText("Ordinary Spells Known: 1/6")).toBeInTheDocument();
    expect(screen.getByText("Prepared: 1/5")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Hellish Rebuke/ }));
    expect(screen.getByText(/Charisma · save DC 11 · spell attack \+3/)).toBeInTheDocument();
    expect(screen.getByText(/Cast at 2nd level · once per long rest/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cast Hellish Rebuke" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cast Bard ordinary control" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cast Wizard ordinary control" })).toBeEnabled();
    expect(rpc).not.toHaveBeenCalled(); expect(insertRoll).not.toHaveBeenCalled();
  });
  it("disables a forced ordinary cast dialog without exposing unrelated slot or ritual controls", () => {
    fixture(); fireEvent.click(screen.getByRole("button", { name: "Inspect racial spell" }));
    expect(screen.getByText(/Racial trait · cast at 2nd level · once per long rest/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cast" })).toBeDisabled();
    expect(screen.queryByRole("radiogroup", { name: "Spell slot level" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled(); expect(insertRoll).not.toHaveBeenCalled();
  });
  it.each([{ type: "slot", level: 2 }, { type: "pact", level: 2 }, { type: "ritual" }, { type: "cantrip" }] as const)(
    "refuses direct provider %j before state/effect/resource/roll work", async choice => {
      const { target } = fixture(), before = structuredClone(stored);
      expect(latest.getCastingAbility(target)).toMatchObject({ status: "available", earnedRacial: { castLevel: 2 } });
      await expect(latest.castSpell(target, choice)).rejects.toThrow(/Racial spell casting.*not available/);
      expect(stored).toEqual(before); expect(rpc).not.toHaveBeenCalled(); expect(insertRoll).not.toHaveBeenCalled();
    });
  it("rejects a stale callback and the current unconfirmed parent revision without a write", async () => {
    const f = fixture(), oldCast = latest.castSpell;
    await act(async () => { f.character.action_revision = "8"; f.refresh(); });
    await expect(oldCast(f.target, { type: "slot", level: 2 })).rejects.toThrow(/source changed/);
    expect(latest.getCastingAbility(f.target).status).toBe("unavailable");
    await expect(latest.castSpell(f.target, { type: "slot", level: 2 })).rejects.toThrow(/source is unavailable/);
    expect(rpc).not.toHaveBeenCalled(); expect(insertRoll).not.toHaveBeenCalled();
  });
});
