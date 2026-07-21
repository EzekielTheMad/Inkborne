import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ActionsTab } from "@/components/sheet/tabs/actions-tab";
import type { CharacterWithSystem } from "@/lib/types/character";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { EvaluationResult } from "@/lib/engine/evaluator";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import type { RollRequest, RollResult } from "@/lib/dice/types";

const rollMock = vi.fn();

vi.mock("@/lib/character/character-context", () => ({
  useRolls: () => ({ rolls: [], roll: rollMock }),
  useActiveEffects: () => ({
    activeEffects: [],
    applyEffect: vi.fn(),
    removeEffect: vi.fn(),
    addCustomEffect: vi.fn(),
  }),
}));

/** Seed the next d20 roll's natural face. */
function seedNatural(natural: number) {
  rollMock.mockImplementation(
    (request: RollRequest): RollResult => ({
      request,
      groups: [{ sides: 20, rolls: [natural], kept: [natural] }],
      modifier: 5,
      total: natural + 5,
      natural,
      rolled_at: "2026-07-16T12:00:00.000Z",
    }),
  );
}

const character = { id: "char-1", choices: { classes: [] } } as unknown as CharacterWithSystem;
const schema = { ability_scores: [], skills: [] } as unknown as SystemSchemaDefinition;

// STR 16 (+3), proficient with simple weapons, prof +2 → mace hits at +5.
const evalResult = {
  stats: { strength: 16, dexterity: 12 },
  computed: { proficiency_bonus: 2 },
  grants: [{ type: "grant", stat: "simple_weapons", value: "proficient" }],
} as unknown as EvaluationResult;

const maceRef = {
  id: "ref-1",
  content_definitions: {
    id: "content-1",
    name: "Mace",
    slug: "mace",
    content_type: "weapon",
    data: {
      damage: "1d6",
      damage_type: "bludgeoning",
      range: "5 ft",
      properties: [],
      weapon_type: "melee",
    },
  },
} as unknown as ContentRefWithContent;

const reactionFeatRef = {
  id: "feat-ref-1",
  content_definitions: {
    id: "feat-content-1",
    name: "Ember Sentinel",
    slug: "ember-sentinel",
    content_type: "feat",
    data: {
      description: "Raise a ward when danger strikes.",
      action: "reaction",
    },
  },
} as unknown as ContentRefWithContent;

function setup() {
  return render(
    <ActionsTab
      character={character}
      schema={schema}
      evalResult={evalResult}
      contentRefs={[maceRef]}
    />,
  );
}

async function rollAttack() {
  fireEvent.click(screen.getByRole("button", { name: "Roll Mace attack" }));
  fireEvent.click(await screen.findByRole("button", { name: "Roll" }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("<ActionsTab> — attack rolls", () => {
  it("rolls the attack with the computed hit bonus", async () => {
    seedNatural(12);
    setup();
    await rollAttack();
    expect(rollMock).toHaveBeenCalledWith({
      kind: "attack",
      label: "Mace — Attack",
      expression: "1d20+5",
    });
  });

  it("rolls damage immediately with dice + ability modifier and the damage type in meta", () => {
    seedNatural(12);
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Roll Mace damage" }));
    expect(rollMock).toHaveBeenCalledWith({
      kind: "damage",
      label: "Mace — Damage",
      expression: "1d6+3",
      meta: { damage_type: "bludgeoning" },
    });
  });
});

describe("<ActionsTab> — attack → damage crit chain", () => {
  it("a natural 20 arms crit on that row's next damage roll and shows the indicator", async () => {
    seedNatural(20);
    setup();
    await rollAttack();
    expect(screen.getByText("Crit!")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Roll Mace damage" }));
    expect(rollMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        kind: "damage",
        expression: "1d6+3",
        crit: true,
      }),
    );
  });

  it("the crit arming is consumed by the damage roll", async () => {
    seedNatural(20);
    setup();
    await rollAttack();
    fireEvent.click(screen.getByRole("button", { name: "Roll Mace damage" }));
    expect(screen.queryByText("Crit!")).not.toBeInTheDocument();

    // Second damage roll: back to normal dice.
    fireEvent.click(screen.getByRole("button", { name: "Roll Mace damage" }));
    const lastRequest = rollMock.mock.calls.at(-1)?.[0] as RollRequest;
    expect(lastRequest.kind).toBe("damage");
    expect(lastRequest.crit).toBeUndefined();
  });

  it("a normal hit does not arm crit", async () => {
    seedNatural(14);
    setup();
    await rollAttack();
    expect(screen.queryByText("Crit!")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Roll Mace damage" }));
    const lastRequest = rollMock.mock.calls.at(-1)?.[0] as RollRequest;
    expect(lastRequest.crit).toBeUndefined();
  });

  it("a later non-crit attack disarms a previously armed crit", async () => {
    seedNatural(20);
    setup();
    await rollAttack();
    expect(screen.getByText("Crit!")).toBeInTheDocument();

    seedNatural(9);
    await rollAttack();
    expect(screen.queryByText("Crit!")).not.toBeInTheDocument();
  });
});

describe("<ActionsTab> — feat actions", () => {
  it("shows a selected feat under its action filter", () => {
    render(
      <ActionsTab
        character={character}
        schema={schema}
        evalResult={evalResult}
        contentRefs={[reactionFeatRef]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reaction" }));
    expect(screen.getByText("Ember Sentinel")).toBeInTheDocument();
    expect(screen.getByText("Raise a ward when danger strikes.")).toBeInTheDocument();
    expect(screen.getByText("reaction")).toBeInTheDocument();
  });
});
