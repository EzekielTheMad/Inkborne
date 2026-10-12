import { classDataSchema } from "@/lib/schemas/content-types/class";
import { resolveSpellSlots } from "@/lib/spells/helpers";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { Activity, useState } from "react";
import { CastDialog } from "@/components/sheet/spells/cast-dialog";
import type {
  CasterInfo,
  CharacterSpell,
  ConcentrationState,
  MaxSlotsByLevel,
  SpellSlotsUsed,
} from "@/lib/types/spells";
import type { CastChoice, CastOutcome } from "@/lib/spells/casting";
import type { RollRequest, RollResult } from "@/lib/dice/types";

// ---------------------------------------------------------------------------
// Context mocks
// ---------------------------------------------------------------------------

const castSpell = vi.fn<(spell: CharacterSpell, choice: CastChoice) => Promise<CastOutcome>>();
const roll = vi.fn<(request: RollRequest) => RollResult>();

let mockMaxSlots: MaxSlotsByLevel = {};
let mockSlotState: SpellSlotsUsed = {};
let mockPactSlotLevel: number | null = null;
let mockConcentration: ConcentrationState | null = null;
let mockCasterInfo: CasterInfo;

const viewport = vi.hoisted(() => ({ mobile: false }));
vi.mock("@/lib/builder/use-is-mobile", () => ({ useIsMobile: () => viewport.mobile }));

vi.mock("@/lib/character/character-context", () => ({
  useCharacter: () => ({ character: { id: "char-1", level: 3 }, isOwner: true }),
  useSpells: () => ({
    slotResolution: { status: "available", maxSlots: mockMaxSlots, pactSlotLevel: mockPactSlotLevel },
    maxSlots: mockMaxSlots,
    slotState: mockSlotState,
    pactSlotLevel: mockPactSlotLevel,
    casterInfo: mockCasterInfo,
    concentration: mockConcentration,
    castSpell,
    getCastingAbility: (spell: CharacterSpell) => ({ status: "available", spell, profile: { classSlug: spell.class_slug || "wizard", ability: "intelligence", abilityModifier: 3, spellDc: mockCasterInfo.spellDc, spellAttackBonus: mockCasterInfo.spellAttackBonus } }),
  }),
  useRolls: () => ({ roll }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function mkCasterInfo(): CasterInfo {
  return {
    isCaster: true,
    classes: [
      {
        slug: "wizard",
        level: 3,
        type: "full",
        ability: "intelligence",
        prepared: true,
        cantripsKnown: 3,
        spellsKnown: "all",
        maxPrepared: 6,
        ritualCasting: true,
      },
    ],
    spellDc: 13,
    spellAttackBonus: 5,
  };
}

function mkSpell(
  dataOverrides: Record<string, unknown> = {},
  overrides: Partial<CharacterSpell> = {},
): CharacterSpell {
  return {
    id: "spell-1",
    character_id: "char-1",
    content_id: "content-1",
    name: "Burning Hands",
    class_slug: "wizard",
    is_known: true,
    is_prepared: true,
    always_prepared: false,
    in_spellbook: true,
    source: "selection",
    custom_data: null,
    created_at: new Date().toISOString(),
    content_definitions: {
      id: "content-1",
      name: "Burning Hands",
      slug: "burning-hands",
      content_type: "spell",
      data: {
        level: 1,
        school: "evocation",
        components: ["V", "S"],
        range: "Self (15-foot cone)",
        casting_time: "1 action",
        duration: "Instantaneous",
        concentration: false,
        ritual: false,
        damage: {
          type: "fire",
          dice_at_slot_level: { "1": "3d6", "2": "4d6", "3": "5d6" },
        },
        dc: { type: "dexterity", success: "half" },
        ...dataOverrides,
      },
      effects: [],
    },
    ...overrides,
  } as CharacterSpell;
}

function mkOutcome(overrides: Partial<CastOutcome> = {}): CastOutcome {
  return {
    statePatch: { spell_slots_used: { "1": 1 } },
    rollRequests: [],
    activeEffect: null,
    castLevel: 1,
    dcInfo: null,
    ...overrides,
  };
}

function mkRollResult(overrides: Partial<RollResult> = {}): RollResult {
  return {
    request: { kind: "attack", label: "x", expression: "1d20+5" },
    groups: [{ sides: 20, rolls: [12], kept: [12] }],
    modifier: 5,
    total: 17,
    natural: 12,
    rolled_at: new Date().toISOString(),
    ...overrides,
  };
}

function renderDialog(
  spell = mkSpell(),
  castability: "full" | "ritual-only" = "full",
) {
  const onClose = vi.fn();
  render(
    <CastDialog spell={spell} castability={castability} open onClose={onClose} />,
  );
  return { onClose };
}

beforeEach(() => {
  vi.clearAllMocks();
  viewport.mobile = false;
  mockMaxSlots = { "1": 4, "2": 2 };
  mockSlotState = {};
  mockPactSlotLevel = null;
  mockConcentration = null;
  mockCasterInfo = mkCasterInfo();
  castSpell.mockResolvedValue(mkOutcome());
  roll.mockReturnValue(mkRollResult());
});

// ---------------------------------------------------------------------------
// Configure pane
// ---------------------------------------------------------------------------

describe("CastDialog - configure pane", () => {
  it("shows a canonical large slot pool numerically without allocating readonly dots", async () => {
    const data = classDataSchema.parse({ hit_die: 6, spellcasting: { type: "full", ability: "intelligence" },
      multiclass: { prerequisites: [], proficiencies_gained: [] }, saving_throws: [], starting_proficiencies: [],
      levels: [{ level: 1, features: [], spellcasting: { spell_slots: [4294967296, 0, 0, 0, 0, 0, 0, 0, 0] } }] });
    const resolution = resolveSpellSlots([{ slug: "original", level: 1 }], { original: data });
    if (resolution.status !== "available") throw new Error(resolution.reason);
    mockMaxSlots = resolution.maxSlots;
    renderDialog();
    expect(screen.getByText("4294967296/4294967296")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cast" }));
    await waitFor(() => expect(castSpell).toHaveBeenCalledOnce());
    expect(castSpell.mock.calls[0][1]).toEqual({ type: "slot", level: 1 });
  });
  it("shows a cast failure settled while Activity is hidden and allows explicit retry", async () => {
    let rejectSave!: (error: Error) => void;
    castSpell.mockReturnValueOnce(new Promise<CastOutcome>((_, reject) => { rejectSave = reject; }));
    const dialog = <CastDialog spell={mkSpell()} castability="full" open onClose={vi.fn()} />;
    const view = render(<Activity mode="visible">{dialog}</Activity>);
    fireEvent.click(screen.getByRole("button", { name: "Cast" }));
    view.rerender(<Activity mode="hidden">{dialog}</Activity>);
    await act(async () => rejectSave(new Error("offline")));
    view.rerender(<Activity mode="visible">{dialog}</Activity>);
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be saved");
    expect(screen.getByRole("button", { name: "Cast" })).toBeEnabled();
    expect(castSpell).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Cast" }));
    expect(await screen.findByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(castSpell).toHaveBeenCalledTimes(2);
  });

  it.each([true, false])("retains the cast outcome through Activity Back (settleHidden=%s)", async (settleHidden) => {
    let resolveSave!: (outcome: CastOutcome) => void;
    castSpell.mockReturnValueOnce(new Promise<CastOutcome>((resolve) => { resolveSave = resolve; }));
    const onClose = vi.fn();
    const dialog = <CastDialog spell={mkSpell()} castability="full" open onClose={onClose} />;
    const view = render(<Activity mode="visible">{dialog}</Activity>);
    fireEvent.click(screen.getByRole("button", { name: "Cast" }));
    view.rerender(<Activity mode="hidden">{dialog}</Activity>);
    if (settleHidden) await act(async () => resolveSave(mkOutcome()));
    view.rerender(<Activity mode="visible">{dialog}</Activity>);
    if (!settleHidden) {
      expect(screen.getByRole("button", { name: "Cast" })).toBeDisabled();
      await act(async () => resolveSave(mkOutcome()));
    }
    expect(await screen.findByRole("button", { name: "Done" })).toBeEnabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(castSpell).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each([false, true])("prevents pending dismissal and recovers through close/reopen (mobile=%s)", async (mobile) => {
    viewport.mobile = mobile;
    let rejectSave!: (error: Error) => void;
    castSpell.mockReturnValueOnce(new Promise<CastOutcome>((_resolve, reject) => { rejectSave = reject; }));
    const onClose = vi.fn();
    const spell = mkSpell();
    function Harness() {
      const [open, setOpen] = useState(true);
      return <>
        <button onClick={() => setOpen(true)}>Open cast</button>
        <CastDialog spell={spell} castability="full" open={open} onClose={() => { onClose(); setOpen(false); }} />
      </>;
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Cast" }));
    expect(screen.getByRole("status")).toHaveTextContent("Please wait");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => rejectSave(new Error("offline")));
    expect(screen.getByRole("alert")).toHaveTextContent("could not be saved");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Open cast" }));
    expect(screen.getByRole("button", { name: "Cast" })).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not display an old cast outcome after an external close and reopen", async () => {
    let resolveSave!: (outcome: CastOutcome) => void;
    castSpell.mockReturnValueOnce(new Promise<CastOutcome>((resolve) => { resolveSave = resolve; }));
    const spell = mkSpell(); const onClose = vi.fn();
    const mounted = render(<CastDialog spell={spell} castability="full" open onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Cast" }));
    mounted.rerender(<CastDialog spell={spell} castability="full" open={false} onClose={onClose} />);
    mounted.rerender(<CastDialog spell={spell} castability="full" open onClose={onClose} />);
    await act(async () => resolveSave(mkOutcome()));
    expect(screen.queryByRole("button", { name: "Done" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cast" })).toBeEnabled();
    expect(onClose).not.toHaveBeenCalled();
  });
  it("keeps failed casts in the configure pane and supports another attempt", async () => {
    castSpell.mockRejectedValueOnce(new Error("save denied"));
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Cast" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be saved");
    expect(screen.queryByRole("button", { name: "Done" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cast" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument());
  });
  it("renders slot options and defaults to the lowest available", () => {
    renderDialog();
    const first = screen.getByRole("radio", { name: /1st/ });
    const second = screen.getByRole("radio", { name: /2nd/ });
    expect(first).toHaveAttribute("aria-checked", "true");
    expect(second).toHaveAttribute("aria-checked", "false");
  });

  it("disables exhausted levels and defaults past them", () => {
    mockSlotState = { "1": 4 };
    renderDialog();
    expect(screen.getByRole("radio", { name: /1st/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /2nd/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("rechecks live slot availability without resetting the selected cast level", () => {
    const spell = mkSpell();
    const dialog = <CastDialog spell={spell} castability="full" open onClose={vi.fn()} />;
    const view = render(dialog);
    fireEvent.click(screen.getByRole("radio", { name: /2nd/ }));

    mockSlotState = { "2": 2 };
    view.rerender(<CastDialog spell={spell} castability="full" open onClose={vi.fn()} />);
    expect(screen.getByRole("radio", { name: /2nd/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cast" })).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: /1st/ }));
    mockSlotState = {};
    view.rerender(<CastDialog spell={spell} castability="full" open onClose={vi.fn()} />);
    expect(screen.getByRole("radio", { name: /1st/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /2nd/ })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Cast" }));
    expect(castSpell).toHaveBeenCalledWith(spell, { type: "slot", level: 1 });
  });

  it("updates the upcast damage preview when the selection changes", () => {
    renderDialog();
    expect(screen.getByText(/3d6\s*fire damage/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /2nd/ }));
    expect(screen.getByText(/4d6\s*fire damage/)).toBeInTheDocument();
  });

  it("shows the save DC in the preview", () => {
    renderDialog();
    expect(screen.getByText(/Dexterity save DC 13/)).toBeInTheDocument();
    expect(screen.getByText(/half on success/)).toBeInTheDocument();
  });

  it("offers pact slots as a first-class option", () => {
    mockMaxSlots = { "1": 3, pact: 2 };
    mockPactSlotLevel = 2;
    renderDialog();
    fireEvent.click(screen.getByRole("radio", { name: /Pact 2nd/ }));
    fireEvent.click(screen.getByRole("button", { name: "Cast" }));
    expect(castSpell).toHaveBeenCalledWith(expect.anything(), {
      type: "pact",
      level: 2,
    });
  });

  it("disables Cast with a rest hint when every slot is spent", () => {
    mockSlotState = { "1": 4, "2": 2 };
    renderDialog();
    expect(
      screen.getByText(/No available slots — take a rest/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cast" })).toBeDisabled();
  });

  it("the ritual path still works when slots are exhausted", () => {
    mockSlotState = { "1": 4, "2": 2 };
    renderDialog(mkSpell({ ritual: true }));
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Cast" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Cast" }));
    expect(castSpell).toHaveBeenCalledWith(expect.anything(), { type: "ritual" });
  });

  it("ritual-only mode locks the ritual path on", () => {
    renderDialog(
      mkSpell({ ritual: true }, { is_prepared: false }),
      "ritual-only",
    );
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeDisabled();
    expect(
      screen.getByText(/castable only as a ritual from the spellbook/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cast" }));
    expect(castSpell).toHaveBeenCalledWith(expect.anything(), { type: "ritual" });
  });

  it("hides the ritual toggle for non-ritual spells", () => {
    renderDialog();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("warns when casting will replace active concentration", () => {
    mockConcentration = {
      spell_slug: "bless",
      spell_name: "Bless",
      slot_level: 1,
      started_at: new Date().toISOString(),
    };
    renderDialog(mkSpell({ concentration: true }));
    expect(screen.getByText(/casting will end/i)).toBeInTheDocument();
    expect(screen.getByText("Bless")).toBeInTheDocument();
  });

  it("cantrips skip the slot picker and scale by character level", () => {
    renderDialog(
      mkSpell({
        level: 0,
        damage: {
          type: "fire",
          dice_at_slot_level: { "1": "1d10", "5": "2d10" },
        },
        dc: null,
      }),
    );
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.getByText(/no spell slot required/i)).toBeInTheDocument();
    // Character level 3 → tier 1 damage.
    expect(screen.getByText(/1d10\s*fire damage/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cast" }));
    expect(castSpell).toHaveBeenCalledWith(expect.anything(), { type: "cantrip" });
  });

  it("casts with the selected leveled slot", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("radio", { name: /2nd/ }));
    fireEvent.click(screen.getByRole("button", { name: "Cast" }));
    expect(castSpell).toHaveBeenCalledWith(expect.anything(), {
      type: "slot",
      level: 2,
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument(),
    );
  });
});

// ---------------------------------------------------------------------------
// Result pane
// ---------------------------------------------------------------------------

describe("CastDialog — result pane", () => {
  async function castAndGetResultPane(outcome: CastOutcome) {
    castSpell.mockResolvedValue(outcome);
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Cast" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument(),
    );
  }

  it("offers exactly the returned roll requests", async () => {
    await castAndGetResultPane(
      mkOutcome({
        rollRequests: [
          {
            kind: "attack",
            label: "Burning Hands — Attack",
            expression: "1d20+5",
          },
          {
            kind: "damage",
            label: "Burning Hands — Damage",
            expression: "3d6",
          },
        ],
      }),
    );
    expect(screen.getByRole("button", { name: /Roll Attack/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Advantage/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Disadvantage/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Roll Damage \(3d6\)/ })).toBeInTheDocument();
  });

  it("rolls through useRolls and shows the total", async () => {
    await castAndGetResultPane(
      mkOutcome({
        rollRequests: [
          { kind: "damage", label: "Burning Hands — Damage", expression: "3d6" },
        ],
      }),
    );
    roll.mockReturnValue(mkRollResult({ total: 11, natural: undefined }));
    fireEvent.click(screen.getByRole("button", { name: /Roll Damage/ }));
    expect(roll).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "damage", expression: "3d6" }),
    );
    expect(screen.getByText("→ 11")).toBeInTheDocument();
  });

  it("advantage attack rolls pass the mode through", async () => {
    await castAndGetResultPane(
      mkOutcome({
        rollRequests: [
          { kind: "attack", label: "A", expression: "1d20+5" },
        ],
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Advantage" }));
    expect(roll).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "advantage" }),
    );
  });

  it("a natural 20 attack arms the damage roll with crit", async () => {
    await castAndGetResultPane(
      mkOutcome({
        rollRequests: [
          { kind: "attack", label: "A", expression: "1d20+5" },
          { kind: "damage", label: "D", expression: "3d6" },
        ],
      }),
    );
    roll.mockReturnValue(mkRollResult({ natural: 20, total: 25 }));
    fireEvent.click(screen.getByRole("button", { name: /Roll Attack/ }));
    expect(screen.getByText(/critical hit/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Roll Damage/ }));
    expect(roll).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: "damage", crit: true }),
    );
  });

  it("a normal hit does not arm crit", async () => {
    await castAndGetResultPane(
      mkOutcome({
        rollRequests: [
          { kind: "attack", label: "A", expression: "1d20+5" },
          { kind: "damage", label: "D", expression: "3d6" },
        ],
      }),
    );
    roll.mockReturnValue(mkRollResult({ natural: 12 }));
    fireEvent.click(screen.getByRole("button", { name: /Roll Attack/ }));
    fireEvent.click(screen.getByRole("button", { name: /Roll Damage/ }));
    const lastCall = roll.mock.calls.at(-1)![0];
    expect(lastCall.crit).toBeUndefined();
  });

  it("shows the applied active effect and closes on Done", async () => {
    const { ...rest } = mkOutcome({
      activeEffect: {
        id: "e1",
        name: "Mage Armor",
        slug: "mage-armor",
        source: "spell",
        content_id: "c1",
        effects: [],
        duration: { type: "hours", value: 8 },
        concentration: false,
        applied_at: new Date().toISOString(),
        expires_at: null,
      },
    });
    castSpell.mockResolvedValue(rest);
    const { onClose } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Cast" }));
    await waitFor(() =>
      expect(
        screen.getByText(/Mage Armor added to Active Effects/),
      ).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalled();
  });
});
