import { CharacterStateReloadError } from "@/lib/character/state-save-error";
import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import {
  CharacterProvider,
  useCharacter,
  useCharacterState,
  useInventory,
  useSpells,
  useActiveEffects,
  useRest,
} from "@/lib/character/character-context";
import type { ClassContentData } from "@/lib/character/character-context";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import type {
  CharacterWithSystem,
  CharacterState,
} from "@/lib/types/character";
import type { ActiveEffect } from "@/lib/types/active-effects";
import { computeMaxHp } from "@/lib/character/max-hp";
import { initializeState } from "@/lib/sheet/helpers";

import { ActiveEffectsWidget } from "@/components/sheet/active-effects-widget";
import { HPTracker } from "@/components/sheet/hp-tracker";
import { RestDialog } from "@/components/sheet/rest-dialog";
import { executeRoll } from "@/lib/dice/roller";
vi.mock("@/lib/dice/roller", () => ({ executeRoll: vi.fn() }));
vi.mock("@/lib/supabase/rolls", () => ({ insertRoll: vi.fn().mockResolvedValue(undefined) }));

// Mock the supabase paths the provider invokes.
vi.mock("@/lib/sheet/update-state", () => ({
  updateCharacterState: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/supabase/inventory", () => ({
  addInventoryItem: vi.fn(),
  updateInventoryItem: vi.fn().mockResolvedValue(undefined),
  removeInventoryItem: vi.fn().mockResolvedValue(undefined),
  unequipAllArmor: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/supabase/spells", () => ({
  addCharacterSpell: vi.fn(),
  updateCharacterSpell: vi.fn().mockResolvedValue(undefined),
  removeCharacterSpell: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/supabase/character-client", () => ({
  updateCharacter: vi.fn().mockResolvedValue(undefined),
  updateCharacterColor: vi.fn().mockResolvedValue(undefined),
}));

import { updateCharacterState } from "@/lib/sheet/update-state";
import { addInventoryItem } from "@/lib/supabase/inventory";
import { addCharacterSpell } from "@/lib/supabase/spells";

const mockedUpdateState = vi.mocked(updateCharacterState);
const mockedAddInventoryItem = vi.mocked(addInventoryItem);
const mockedAddSpell = vi.mocked(addCharacterSpell);

const mockCharacter = {
  id: "char-1",
  user_id: "user-1",
  system_id: "system-1",
  campaign_id: null,
  name: "Test Character",
  visibility: "private",
  archived: false,
  level: 1,
  base_stats: {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  },
  choices: { classes: [] },
  state: {},
  narrative: {},
  narrative_rich: {},
  primary_color: null,
  game_systems: {
    id: "system-1",
    name: "D&D 5e",
    slug: "dnd-5e",
    schema_definition: {} as unknown,
  },
} as unknown as CharacterWithSystem;

const mockSchema = {
  ability_scores: [
    { slug: "strength", name: "Strength", abbr: "STR" },
    { slug: "dexterity", name: "Dexterity", abbr: "DEX" },
    { slug: "constitution", name: "Constitution", abbr: "CON" },
    { slug: "intelligence", name: "Intelligence", abbr: "INT" },
    { slug: "wisdom", name: "Wisdom", abbr: "WIS" },
    { slug: "charisma", name: "Charisma", abbr: "CHA" },
  ],
  proficiency_levels: [],
  derived_stats: [],
  skills: [],
  resources: [],
  content_types: [],
  currencies: [],
  creation_steps: [],
  sheet_sections: [],
} as unknown;

interface ProbeProps {
  maxHp?: number;
  initialState?: CharacterState;
  primaryColor?: string | null;
  onPrimaryColorChange?: (c: string | null) => void;
  character?: CharacterWithSystem;
  contentRefs?: ContentRefWithContent[];
  classData?: ClassContentData;
}

function renderWithProvider(
  Probe: React.ComponentType,
  overrides: ProbeProps = {},
) {
  return render(
    <CharacterProvider
      character={overrides.character ?? mockCharacter}
      schema={mockSchema as never}
      contentRefs={overrides.contentRefs ?? []}
      initialState={overrides.initialState ?? ({} as never)}
      initialInventory={[]}
      initialSpells={[]}
      classData={overrides.classData ?? ({} as never)}
      allEffects={[]}
      baseStatsWithLevel={{
        level: 1,
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      }}
      structuredSources={{} as never}
      isOwner={true}
      isDm={false}
      hasSheet={true}
      maxHp={overrides.maxHp ?? 10}
      primaryColor={overrides.primaryColor ?? null}
      onPrimaryColorChange={overrides.onPrimaryColorChange ?? (() => {})}
    >
      <Probe />
    </CharacterProvider>,
  );
}

describe("<CharacterProvider> public hook surface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the actual effect editor draft through a rejected provider save and confirms retry once", async () => {
    let rejectSave!: (error: Error) => void;
    mockedUpdateState.mockReturnValueOnce(new Promise<void>((_, reject) => { rejectSave = reject; }));
    const existing: ActiveEffect = {
      id: "existing", name: "Guarded", slug: "guarded", source: "custom", content_id: null,
      effects: [], duration: { type: "special" }, concentration: false,
      applied_at: "2026-10-02T18:00:00.000Z", expires_at: null,
    };
    renderWithProvider(ActiveEffectsWidget, { initialState: { active_effects: [existing] } });
    fireEvent.click(screen.getByRole("button", { name: /^Add effect$/ }));
    fireEvent.change(screen.getByLabelText("Custom effect name"), { target: { value: "Half cover" } });
    fireEvent.change(screen.getByLabelText("Modified stat"), { target: { value: "armor_class" } });
    fireEvent.change(screen.getByLabelText("Modifier value"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Duration type"), { target: { value: "minutes" } });
    fireEvent.change(screen.getByLabelText("Duration value"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Add custom effect" }));
    expect(screen.getByLabelText("Custom effect name")).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Add effect$/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Add custom effect" }));
    await waitFor(() => expect(mockedUpdateState).toHaveBeenCalledOnce());
    await act(async () => rejectSave(new Error("private persistence detail")));
    expect(await screen.findByText(/This effect could not be confirmed/)).toBeVisible();
    expect(screen.getByLabelText("Custom effect name")).toHaveValue("Half cover");
    expect(screen.getByLabelText("Modifier value")).toHaveValue(2);
    expect(screen.getByLabelText("Duration value")).toHaveValue(30);
    expect(screen.queryByText("private persistence detail")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add custom effect" }));
    await waitFor(() => expect(screen.queryByLabelText("Custom effect name")).not.toBeInTheDocument());
    expect(mockedUpdateState).toHaveBeenCalledTimes(2);
    const effects = mockedUpdateState.mock.calls[1][1].active_effects;
    expect(effects?.map(effect => effect.name)).toEqual(["Guarded", "Half cover"]);
  });

  it("opens a newly built fighter's sheet and recovers a failed first play save", async () => {
    const character: CharacterWithSystem = {
      ...mockCharacter,
      name: "New adventurer",
      choices: {
        classes: [{ slug: "fighter", level: 1 }], race: "human", background: "soldier",
        ability_method: "standard_array",
        starting_equipment: { selections: {}, picks: {}, confirmed: true },
      },
      base_stats: { strength: 15, dexterity: 13, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 },
    };
    const maxHp = computeMaxHp(character.choices.classes!, {
      fighter: { slug: "fighter", data: { hit_die: 10 } },
    }, character.base_stats.constitution);
    let save: ReturnType<typeof useCharacterState>["patchState"];
    function Probe() {
      const { state, patchState } = useCharacterState();
      save = patchState;
      return <span data-testid="new-fighter-hp">{state.current_hp}</span>;
    }
    renderWithProvider(Probe, { character, maxHp, classData: { fighter: { slug: "fighter", data: { hit_die: 10 } } }, initialState: initializeState({}, maxHp) });
    expect(screen.getByTestId("new-fighter-hp")).toHaveTextContent("12");
    mockedUpdateState.mockRejectedValueOnce(new Error("offline"));
    await act(async () => { expect(await save!({ current_hp: maxHp - 3 })).toBe(false); });
    expect(screen.getByTestId("new-fighter-hp")).toHaveTextContent("12");
    expect(screen.getByRole("alert")).toHaveTextContent(/try that action again/i);
    await act(async () => { expect(await save!({ current_hp: maxHp - 3 })).toBe(true); });
    expect(screen.getByTestId("new-fighter-hp")).toHaveTextContent("9");
    expect(mockedUpdateState).toHaveBeenLastCalledWith("char-1", { current_hp: 9 }, {});
  });

  it("rejects a hit-die heal during pending UI damage before rolling, then heals confirmed HP on retry", async () => {
    let rejectDamage!: (error: Error) => void;
    mockedUpdateState.mockReturnValueOnce(new Promise<void>((_, reject) => { rejectDamage = reject; }));
    vi.mocked(executeRoll).mockReturnValue({ total: 3, rolled_at: "2026-10-02T15:00:00Z" } as never);
    function Probe() {
      const { state, patchState, patchActionState } = useCharacterState();
      const [restOpen, setRestOpen] = useState(false);
      return <><button onClick={() => setRestOpen(true)}>Open rest</button><HPTracker currentHp={state.current_hp ?? 20} tempHp={state.temp_hp ?? 0} maxHp={20} patchState={patchState} patchActionState={patchActionState} /><RestDialog open={restOpen} onClose={() => setRestOpen(false)} /><span data-testid="hp">{state.current_hp}</span><span data-testid="spent">{state.hit_dice_spent?.fighter ?? 0}</span></>;
    }
    renderWithProvider(Probe, { maxHp: 20, initialState: { current_hp: 10 }, character: { ...mockCharacter, choices: { classes: [{ slug: "fighter", level: 1 }] } }, classData: { fighter: { slug: "fighter", data: { hit_die: 10 } } } });
    fireEvent.click(screen.getByRole("button", { name: /HP tracker/i }));
    fireEvent.change(screen.getByPlaceholderText("Amount"), { target: { value: "5" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Damage" })); });
    expect(screen.getByTestId("hp")).toHaveTextContent("5");
    fireEvent.click(screen.getByRole("button", { name: "Open rest" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /spend & roll/i })); });
    expect(executeRoll).not.toHaveBeenCalled();
    expect(mockedUpdateState).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/hit die could not be spent/i)).toBeInTheDocument();
    await act(async () => { rejectDamage(new Error("offline")); });
    expect(screen.getByTestId("hp")).toHaveTextContent("10");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /spend & roll/i })); });
    expect(screen.getByTestId("hp")).toHaveTextContent("13");
    expect(screen.getByTestId("spent")).toHaveTextContent("1");
    expect(mockedUpdateState).toHaveBeenLastCalledWith("char-1", expect.objectContaining({ current_hp: 13, hit_dice_spent: { fighter: 1 } }), {});
  });

  it.each(["shortRest", "longRest"] as const)("refuses %s computed from pending HP/resource edits and preserves an independent absolute edit", async (action) => {
    let rejectSave!: (error: Error) => void;
    mockedUpdateState.mockReturnValueOnce(new Promise<void>((_, reject) => { rejectSave = reject; }));
    let hooks!: ReturnType<typeof useRest>;
    let saves!: ReturnType<typeof useCharacterState>;
    function Probe() {
      hooks = useRest(); saves = useCharacterState();
      return <span data-testid="rest-hp">{saves.state.current_hp}</span>;
    }
    renderWithProvider(Probe, { maxHp: 20, initialState: { current_hp: 10, spell_slots_used: { pact: 1 } } });
    let first!: Promise<boolean>;
    await act(async () => { first = saves.patchState({ current_hp: 5, spell_slots_used: { pact: 2 } }); });
    await act(async () => { expect(await hooks[action]()).toBe(false); });
    expect(mockedUpdateState).toHaveBeenCalledTimes(1);
    let absolute!: Promise<boolean>;
    await act(async () => { absolute = saves.patchState({ current_hp: 16, inspiration: true }); });
    await act(async () => { rejectSave(new Error("offline")); expect(await first).toBe(false); expect(await absolute).toBe(true); });
    expect(screen.getByTestId("rest-hp")).toHaveTextContent("16");
    expect(saves.state).toMatchObject({ spell_slots_used: { pact: 1 }, inspiration: true });
    await act(async () => { expect(await hooks[action]()).toBe(true); });
    expect(mockedUpdateState).toHaveBeenCalledTimes(3);
  });

  it("useCharacter() exposes character, schema, contentRefs, isOwner, isDm, hasSheet", () => {
    function Probe() {
      const c = useCharacter();
      return (
        <div>
          <span data-testid="name">{c.character.name}</span>
          <span data-testid="isOwner">{String(c.isOwner)}</span>
          <span data-testid="isDm">{String(c.isDm)}</span>
          <span data-testid="hasSheet">{String(c.hasSheet)}</span>
        </div>
      );
    }
    renderWithProvider(Probe);
    expect(screen.getByTestId("name").textContent).toBe("Test Character");
    expect(screen.getByTestId("isOwner").textContent).toBe("true");
    expect(screen.getByTestId("isDm").textContent).toBe("false");
    expect(screen.getByTestId("hasSheet").textContent).toBe("true");
  });

  it("useCharacter() exposes primaryColor and setPrimaryColor (PR-F)", () => {
    const onChange = vi.fn();
    function Probe() {
      const c = useCharacter();
      return (
        <button
          data-testid="set"
          onClick={() => c.setPrimaryColor("#7c3aed")}
        >
          {c.primaryColor ?? "none"}
        </button>
      );
    }
    renderWithProvider(Probe, {
      primaryColor: "#abcdef",
      onPrimaryColorChange: onChange,
    });
    expect(screen.getByTestId("set").textContent).toBe("#abcdef");
    act(() => {
      screen.getByTestId("set").click();
    });
    expect(onChange).toHaveBeenCalledWith("#7c3aed");
  });

  it("requires reload after an HP conflict, waits for independent queued notes, and never resends HP", async () => {
    let rejectHp!: (error: Error) => void; let resolveNotes!: () => void;
    mockedUpdateState.mockReturnValueOnce(new Promise((_, reject) => { rejectHp = reject; }))
      .mockReturnValueOnce(new Promise<void>(resolve => { resolveNotes = resolve; }));
    let write!: ReturnType<typeof useCharacterState>["patchState"];
    let action!: ReturnType<typeof useCharacterState>["patchActionState"];
    function Probe() { const ctx = useCharacterState(); write = ctx.patchState; action = ctx.patchActionState;
      return <output data-testid="conflict-notes">{ctx.state.quick_notes}</output>; }
    renderWithProvider(Probe, { initialState: { current_hp: 10, quick_notes: "old" } });
    let hp!: Promise<boolean>; let notes!: Promise<boolean>;
    await act(async () => { hp = write({ current_hp: 8 }); notes = write({ quick_notes: "new" }); });
    await act(async () => { rejectHp(new CharacterStateReloadError("This character changed in another tab. Reload before choosing a new HP action.")); expect(await hp).toBe(false); });
    expect(screen.getByRole("button", { name: "Reload character" })).toBeDisabled();
    expect(screen.getByTestId("conflict-notes")).toHaveTextContent("new");
    await act(async () => { resolveNotes(); expect(await notes).toBe(true); });
    expect(screen.getByRole("button", { name: "Reload character" })).toBeEnabled();
    await act(async () => { await expect(action({ current_hp: 7 })).rejects.toThrow("Reload"); });
    expect(mockedUpdateState).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("alert")).toHaveTextContent("changed in another tab");
  });

  it("useCharacterState().patchState calls the atomic-merge RPC and updates local state", async () => {
    function Probe() {
      const { state, patchState } = useCharacterState();
      return (
        <button
          data-testid="apply"
          onClick={() => {
            void patchState({ current_hp: 7 });
          }}
        >
          {String((state as CharacterState).current_hp ?? "null")}
        </button>
      );
    }
    renderWithProvider(Probe);
    expect(screen.getByTestId("apply").textContent).toBe("null");
    await act(async () => {
      screen.getByTestId("apply").click();
    });
    expect(mockedUpdateState).toHaveBeenCalledWith("char-1", { current_hp: 7 }, {});
    expect(screen.getByTestId("apply").textContent).toBe("7");
  });

  it("useCharacterState restores failed changes and shows a recoverable save error", async () => {
    mockedUpdateState.mockRejectedValueOnce(new Error("RLS denied"));
    function Probe() {
      const { state, patchState } = useCharacterState();
      return (
        <button
          data-testid="apply"
          onClick={() => {
            void patchState({ current_hp: 7 });
          }}
        >
          {String((state as CharacterState).current_hp ?? "null")}
        </button>
      );
    }
    renderWithProvider(Probe);
    await act(async () => {
      screen.getByTestId("apply").click();
    });
    expect(screen.getByRole("alert")).toHaveTextContent("could not be saved");
    expect(screen.getByTestId("apply").textContent).toBe("null");
  });

  it("useInventory().addItem appends the returned row to local inventory", async () => {
    mockedAddInventoryItem.mockResolvedValueOnce({
      id: "inv-1",
      character_id: "char-1",
      content_id: "potion-of-healing",
      name: "Potion of Healing",
      quantity: 1,
      equipped: false,
      attuned: false,
      notes: null,
      custom_data: null,
    } as never);
    function Probe() {
      const { inventory, addItem } = useInventory();
      return (
        <div>
          <button
            data-testid="add"
            onClick={() => {
              void addItem({
                content_id: "potion-of-healing",
                name: "Potion of Healing",
                content_type: "item",
              });
            }}
          />
          <span data-testid="count">{inventory.length}</span>
        </div>
      );
    }
    renderWithProvider(Probe);
    expect(screen.getByTestId("count").textContent).toBe("0");
    await act(async () => {
      screen.getByTestId("add").click();
    });
    expect(mockedAddInventoryItem).toHaveBeenCalledWith("char-1", {
      content_id: "potion-of-healing",
      name: "Potion of Healing",
      content_type: "item",
    });
    expect(screen.getByTestId("count").textContent).toBe("1");
  });

  it("useSpells().addSpell appends the returned row to local spells", async () => {
    mockedAddSpell.mockResolvedValueOnce({
      id: "spell-1",
      character_id: "char-1",
      content_id: "magic-missile",
      name: "Magic Missile",
      level: 1,
      always_prepared: false,
      always_known: false,
      prepared: false,
    } as never);
    function Probe() {
      const { spells, addSpell } = useSpells();
      return (
        <div>
          <button
            data-testid="add"
            onClick={() => {
              void addSpell({
                content_id: "magic-missile",
                name: "Magic Missile",
                level: 1,
              } as never);
            }}
          />
          <span data-testid="count">{spells.length}</span>
        </div>
      );
    }
    renderWithProvider(Probe);
    expect(screen.getByTestId("count").textContent).toBe("0");
    await act(async () => {
      screen.getByTestId("add").click();
    });
    expect(mockedAddSpell).toHaveBeenCalled();
    expect(screen.getByTestId("count").textContent).toBe("1");
  });

  it("useActiveEffects().applyEffect patches state atomically (concentration replacement)", async () => {
    const bless: ActiveEffect = {
      id: "e-bless",
      name: "Bless",
      slug: "bless",
      source: "spell",
      content_id: null,
      effects: [],
      duration: { type: "minutes", value: 1 },
      concentration: true,
      cast_at_level: 1,
      applied_at: "2026-07-15T12:00:00.000Z",
      expires_at: null,
    };
    function Probe() {
      const { activeEffects, applyEffect } = useActiveEffects();
      return (
        <button
          data-testid="apply"
          onClick={() => {
            void applyEffect(bless);
          }}
        >
          {activeEffects.map((e) => e.name).join(",") || "none"}
        </button>
      );
    }
    renderWithProvider(Probe, {
      initialState: {
        active_effects: [
          {
            ...bless,
            id: "e-old",
            name: "Old Concentration",
            slug: "old-conc",
          },
        ],
      } as CharacterState,
    });
    expect(screen.getByTestId("apply").textContent).toBe("Old Concentration");
    await act(async () => {
      screen.getByTestId("apply").click();
    });
    // One atomic patch: old concentration effect stripped, new appended,
    // concentrating_on replaced.
    expect(mockedUpdateState).toHaveBeenCalledTimes(1);
    const patch = mockedUpdateState.mock.calls[0][1] as CharacterState;
    expect(patch.active_effects?.map((e) => e.id)).toEqual(["e-bless"]);
    expect(patch.concentrating_on).toMatchObject({
      spell_slug: "bless",
      slot_level: 1,
    });
    expect(screen.getByTestId("apply").textContent).toBe("Bless");
  });

  it("useActiveEffects().removeEffect clears concentrating_on with the last linked entry", async () => {
    function Probe() {
      const { activeEffects, removeEffect } = useActiveEffects();
      return (
        <button
          data-testid="remove"
          onClick={() => {
            void removeEffect("e-bless");
          }}
        >
          {String(activeEffects.length)}
        </button>
      );
    }
    renderWithProvider(Probe, {
      initialState: {
        active_effects: [
          {
            id: "e-bless",
            name: "Bless",
            slug: "bless",
            source: "spell",
            content_id: null,
            effects: [],
            duration: { type: "minutes", value: 1 },
            concentration: true,
            applied_at: "2026-07-15T12:00:00.000Z",
            expires_at: null,
          },
        ],
        concentrating_on: {
          spell_slug: "bless",
          spell_name: "Bless",
          slot_level: 1,
          started_at: "2026-07-15T12:00:00.000Z",
        },
      } as CharacterState,
    });
    await act(async () => {
      screen.getByTestId("remove").click();
    });
    expect(mockedUpdateState).toHaveBeenCalledWith("char-1", {
      active_effects: [],
      concentrating_on: null,
    });
    expect(screen.getByTestId("remove").textContent).toBe("0");
  });

  it("active-effect snapshots feed evalResult (Shield-shaped add raises a stat)", () => {
    function Probe() {
      const { evalResult } = useCharacter();
      return (
        <span data-testid="ac-bonus">
          {String(evalResult.stats.ac_bonus ?? 0)}
        </span>
      );
    }
    renderWithProvider(Probe, {
      initialState: {
        active_effects: [
          {
            id: "e-shield",
            name: "Shield",
            slug: "shield",
            source: "spell",
            content_id: null,
            effects: [
              { type: "mechanical", stat: "ac_bonus", op: "add", value: 5 },
            ],
            duration: { type: "rounds", value: 1 },
            concentration: false,
            applied_at: "2026-07-15T12:00:00.000Z",
            expires_at: null,
          },
        ],
      } as CharacterState,
    });
    // mockSchema has no derived stats, so the add lands in stats — proving
    // the snapshot flowed through evaluate() via the combined effects array.
    expect(screen.getByTestId("ac-bonus").textContent).toBe("5");
  });

  // --- Arcane Recovery through useRest() (T8) ---

  // Wizard 3 fixture: full caster (multiclass slots {1:4, 2:2}), owning the
  // arcane-recovery feature (usages 1, recovery long — the PR #24 enrichment
  // shape), with two spent 1st-level slots.
  const wizardCharacter = {
    ...mockCharacter,
    choices: { classes: [{ slug: "wizard", level: 3 }] },
  } as unknown as CharacterWithSystem;

  const wizardClassData = {
    wizard: {
      slug: "wizard",
      data: {
        hit_die: 6,
        spellcasting: { type: "full", ability: "intelligence" },
      },
    },
  } as unknown as ClassContentData;

  it("rejects a failed cast instead of returning success and restores its slot", async () => {
    mockedUpdateState.mockRejectedValueOnce(new Error("offline"));
    let cast!: ReturnType<typeof useSpells>["castSpell"];
    function Probe() {
      cast = useSpells().castSpell;
      const { state } = useCharacterState();
      return <span data-testid="slots">{state.spell_slots_used?.["1"] ?? 0}</span>;
    }
    renderWithProvider(Probe, { character: wizardCharacter, classData: wizardClassData });
    await act(async () => {
      await expect(cast({
        name: "Magic Missile", class_slug: "wizard",
        content_definitions: { id: "magic-missile", name: "Magic Missile", slug: "magic-missile", data: { level: 1, duration: "Instantaneous" }, effects: [] },
      } as never, { type: "slot", level: 1 })).rejects.toThrow("could not be saved");
    });
    expect(mockedUpdateState).toHaveBeenCalledWith("char-1", { spell_slots_used: { "1": 1 } });
    expect(screen.getByTestId("slots")).toHaveTextContent("0");
    expect(screen.getByRole("alert")).toHaveTextContent("could not be saved");
  });

  it("rejects a queued cast while the first save is pending, then spends only one slot after failure and retry", async () => {
    let rejectFirst!: (reason: Error) => void;
    mockedUpdateState.mockReturnValueOnce(new Promise<void>((_resolve, reject) => { rejectFirst = reject; }));
    let cast!: ReturnType<typeof useSpells>["castSpell"];
    function Probe() {
      cast = useSpells().castSpell;
      const { state } = useCharacterState();
      return <span data-testid="queued-slots">{state.spell_slots_used?.["1"] ?? 0}</span>;
    }
    const spell = {
      name: "Magic Missile", class_slug: "wizard",
      content_definitions: { id: "magic-missile", name: "Magic Missile", slug: "magic-missile", data: { level: 1, duration: "Instantaneous" }, effects: [] },
    } as never;
    renderWithProvider(Probe, { character: wizardCharacter, classData: wizardClassData });
    let first!: Promise<unknown>;
    await act(async () => { first = cast(spell, { type: "slot", level: 1 }).catch((error: Error) => error); });
    let second!: Promise<unknown>;
    await act(async () => { second = cast(spell, { type: "slot", level: 1 }).catch((error: Error) => error); });
    await act(async () => {
      rejectFirst(new Error("offline"));
      expect(await first).toBeInstanceOf(Error);
      expect(await second).toBeInstanceOf(Error);
      expect(mockedUpdateState).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId("queued-slots")).toHaveTextContent("0");
    await act(async () => { await cast(spell, { type: "slot", level: 1 }); });
    expect(mockedUpdateState).toHaveBeenCalledTimes(2);
    expect(mockedUpdateState).toHaveBeenLastCalledWith("char-1", { spell_slots_used: { "1": 1 } });
    expect(screen.getByTestId("queued-slots")).toHaveTextContent("1");
  });

  it("rejects simultaneous and stale cast callbacks while allowing a fresh later cast", async () => {
    let resolveFirst!: () => void;
    mockedUpdateState.mockReturnValueOnce(new Promise<void>((resolve) => { resolveFirst = resolve; }));
    let cast!: ReturnType<typeof useSpells>["castSpell"];
    function Probe() { cast = useSpells().castSpell; return null; }
    const spell = {
      name: "Magic Missile", class_slug: "wizard",
      content_definitions: { id: "magic-missile", name: "Magic Missile", slug: "magic-missile", data: { level: 1, duration: "Instantaneous" }, effects: [] },
    } as never;
    renderWithProvider(Probe, { character: wizardCharacter, classData: wizardClassData });
    const staleCast = cast;
    let first!: Promise<unknown>;
    await act(async () => {
      first = staleCast(spell, { type: "slot", level: 1 });
      await expect(staleCast(spell, { type: "slot", level: 1 })).rejects.toThrow(/saving|changed/i);
    });
    await act(async () => { resolveFirst(); await first; });
    await expect(staleCast(spell, { type: "slot", level: 1 })).rejects.toThrow(/saving|changed/i);
    await act(async () => { await cast(spell, { type: "slot", level: 1 }); });
    expect(mockedUpdateState).toHaveBeenCalledTimes(2);
    expect(mockedUpdateState).toHaveBeenLastCalledWith("char-1", { spell_slots_used: { "1": 2 } });
  });

  it("returns failure for an unsaved rest and restores HP before retry", async () => {
    mockedUpdateState.mockRejectedValueOnce(new Error("offline"));
    let rest!: ReturnType<typeof useRest>["longRest"];
    function Probe() {
      rest = useRest().longRest;
      const { state } = useCharacterState();
      return <span data-testid="hp">{state.current_hp}</span>;
    }
    renderWithProvider(Probe, { initialState: { current_hp: 4 } as CharacterState });
    await act(async () => { expect(await rest()).toBe(false); });
    expect(screen.getByTestId("hp")).toHaveTextContent("4");
    await act(async () => { expect(await rest()).toBe(true); });
    expect(screen.getByTestId("hp")).toHaveTextContent("10");
  });

  const arcaneRecoveryRef = {
    content_definitions: {
      id: "content-ar",
      name: "Arcane Recovery",
      slug: "arcane-recovery",
      content_type: "feature",
      data: { class: "wizard", level: 1, usages: 1, recovery: "long rest" },
      effects: [],
    },
  } as unknown as ContentRefWithContent;

  function renderRestProbe(initialState: CharacterState, picks: Record<string, number>) {
    function Probe() {
      const { shortRest, arcaneRecovery } = useRest();
      return (
        <button data-testid="rest" onClick={() => shortRest(picks)}>
          {String(arcaneRecovery.available)}:{arcaneRecovery.budget}
        </button>
      );
    }
    renderWithProvider(Probe, {
      initialState,
      character: wizardCharacter,
      contentRefs: [arcaneRecoveryRef],
      classData: wizardClassData,
    });
  }

  it("useRest().shortRest folds Arcane Recovery picks into ONE atomic patch", async () => {
    renderRestProbe(
      { spell_slots_used: { "1": 2 } } as CharacterState,
      { "1": 2 },
    );
    // Wizard 3: available, budget ⌈3/2⌉ = 2.
    expect(screen.getByTestId("rest").textContent).toBe("true:2");
    await act(async () => {
      screen.getByTestId("rest").click();
    });
    expect(mockedUpdateState).toHaveBeenCalledTimes(1);
    expect(mockedUpdateState).toHaveBeenCalledWith("char-1", {
      spell_slots_used: { "1": 0 },
      feature_uses: { "arcane-recovery": 1 },
    });
  });

  it("useRest().shortRest ignores invalid picks instead of writing state", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderRestProbe(
      { spell_slots_used: { "1": 2 } } as CharacterState,
      { "1": 5 }, // more than spent AND over budget
    );
    await act(async () => {
      screen.getByTestId("rest").click();
    });
    // Picks rejected; nothing else recoverable on a short rest → no write.
    expect(mockedUpdateState).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[arcane-recovery]"),
    );
    warnSpy.mockRestore();
  });

  it("useRest().arcaneRecovery is unavailable once the feature use is spent", () => {
    renderRestProbe(
      {
        spell_slots_used: { "1": 2 },
        feature_uses: { "arcane-recovery": 1 },
      } as CharacterState,
      {},
    );
    expect(screen.getByTestId("rest").textContent).toBe("false:2");
  });

  it("useCharacter() throws when called outside <CharacterProvider>", () => {
    function Probe() {
      useCharacter();
      return null;
    }
    // Suppress React's error logging for the expected throw.
    expect(() => render(<Probe />)).toThrow(
      /Character hook used outside CharacterProvider/,
    );
  });
});
