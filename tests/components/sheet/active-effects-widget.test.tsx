import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ActiveEffectsWidget } from "@/components/sheet/active-effects-widget";
import type { ActiveEffect, CustomEffectInput } from "@/lib/types/active-effects";
import type { CharacterSpell } from "@/lib/types/spells";

const applyEffect = vi.fn().mockResolvedValue(undefined);
const removeEffect = vi.fn().mockResolvedValue(undefined);
const addCustomEffect = vi.fn().mockResolvedValue(undefined);

let mockActiveEffects: ActiveEffect[] = [];
let mockSpells: CharacterSpell[] = [];

vi.mock("@/lib/character/character-context", () => ({
  useActiveEffects: () => ({
    activeEffects: mockActiveEffects,
    applyEffect,
    removeEffect,
    addCustomEffect,
  }),
  useSpells: () => ({ spells: mockSpells }),
}));

const FUTURE = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 60 * 60 * 1000).toISOString();

const mkEffect = (overrides: Partial<ActiveEffect> = {}): ActiveEffect => ({
  id: "e1",
  name: "Mage Armor",
  slug: "mage-armor",
  source: "spell",
  content_id: "c1",
  effects: [],
  duration: { type: "hours", value: 8 },
  concentration: false,
  applied_at: new Date().toISOString(),
  expires_at: FUTURE,
  ...overrides,
});

const mkSpell = (overrides: Partial<CharacterSpell> = {}): CharacterSpell =>
  ({
    id: "s1",
    character_id: "char-1",
    content_id: "c-bless",
    name: "Bless",
    class_slug: "cleric",
    is_known: true,
    is_prepared: true,
    always_prepared: false,
    in_spellbook: false,
    source: "selection",
    custom_data: null,
    created_at: new Date().toISOString(),
    content_definitions: {
      id: "c-bless",
      name: "Bless",
      slug: "bless",
      content_type: "spell",
      data: { level: 1, duration: "1 minute", concentration: true },
      effects: [
        { type: "mechanical", stat: "roll_attack", op: "add", value: "1d4" },
      ],
    },
    ...overrides,
  }) as CharacterSpell;

describe("ActiveEffectsWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveEffects = [];
    mockSpells = [];
  });

  it("renders nothing when there are no active effects", () => {
    const { container } = render(<ActiveEffectsWidget />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists effects with name and remaining duration", () => {
    mockActiveEffects = [
      mkEffect(),
      mkEffect({
        id: "e2",
        name: "Bless",
        concentration: true,
        duration: { type: "minutes", value: 1 },
        expires_at: null,
      }),
    ];
    render(<ActiveEffectsWidget />);
    expect(screen.getByText("Active Effects")).toBeInTheDocument();
    expect(screen.getByText("Mage Armor")).toBeInTheDocument();
    expect(screen.getByText("Bless")).toBeInTheDocument();
    expect(screen.getByText("1 min (10 rounds)")).toBeInTheDocument();
    // Real-time countdown renders hours remaining
    expect(screen.getByText(/\d+h \d+m/)).toBeInTheDocument();
  });

  it("marks concentration entries and warns removal ends concentration", () => {
    mockActiveEffects = [
      mkEffect({
        id: "e-bless",
        name: "Bless",
        concentration: true,
        duration: { type: "minutes", value: 1 },
        expires_at: null,
      }),
    ];
    render(<ActiveEffectsWidget />);
    expect(screen.getByLabelText("Concentration")).toBeInTheDocument();
    const removeButton = screen.getByRole("button", {
      name: "Remove Bless (ends concentration)",
    });
    fireEvent.click(removeButton);
    expect(removeEffect).toHaveBeenCalledWith("e-bless");
  });

  it("removes non-concentration entries without the warning label", () => {
    mockActiveEffects = [mkEffect()];
    render(<ActiveEffectsWidget />);
    const removeButton = screen.getByRole("button", {
      name: "Remove Mage Armor",
    });
    fireEvent.click(removeButton);
    expect(removeEffect).toHaveBeenCalledWith("e1");
  });

  it("dims expired entries and shows the expired badge", () => {
    mockActiveEffects = [mkEffect({ expires_at: PAST })];
    render(<ActiveEffectsWidget />);
    // Both the countdown text and the badge read "expired"
    expect(screen.getAllByText("expired")).toHaveLength(2);
  });

  it("applies a known non-instantaneous spell from the adder", async () => {
    mockActiveEffects = [mkEffect()];
    mockSpells = [
      mkSpell(),
      // Instantaneous spells must not be offered
      mkSpell({
        id: "s2",
        content_id: "c-cure",
        name: "Cure Wounds",
        content_definitions: {
          id: "c-cure",
          name: "Cure Wounds",
          slug: "cure-wounds",
          content_type: "spell",
          data: { level: 1, duration: "Instantaneous", concentration: false },
          effects: [],
        },
      }),
    ];
    render(<ActiveEffectsWidget />);
    fireEvent.click(screen.getByRole("button", { name: /add effect/i }));
    expect(screen.queryByText("Cure Wounds")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bless" }));
    await vi.waitFor(() => expect(applyEffect).toHaveBeenCalledTimes(1));

    const entry = applyEffect.mock.calls[0][0] as ActiveEffect;
    expect(entry).toMatchObject({
      name: "Bless",
      slug: "bless",
      source: "spell",
      content_id: "c-bless",
      concentration: true,
      cast_at_level: 1,
      duration: { type: "minutes", value: 1 },
    });
    expect(entry.effects).toHaveLength(1);
  });

  it("adds a custom effect with a flat stat modifier", async () => {
    mockActiveEffects = [mkEffect()];
    render(<ActiveEffectsWidget />);
    fireEvent.click(screen.getByRole("button", { name: /add effect/i }));

    fireEvent.change(screen.getByLabelText("Custom effect name"), {
      target: { value: "Half cover" },
    });
    fireEvent.change(screen.getByLabelText("Modified stat"), {
      target: { value: "armor_class" },
    });
    fireEvent.change(screen.getByLabelText("Modifier value"), {
      target: { value: "2" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Add custom effect" }),
    );

    await vi.waitFor(() => expect(addCustomEffect).toHaveBeenCalledTimes(1));
    expect(addCustomEffect).toHaveBeenCalledWith({
      name: "Half cover",
      stat: "armor_class",
      value: 2,
      duration: { type: "special" },
    } satisfies CustomEffectInput);
  });

  it("disables the custom add button until a name is entered", () => {
    mockActiveEffects = [mkEffect()];
    render(<ActiveEffectsWidget />);
    fireEvent.click(screen.getByRole("button", { name: /add effect/i }));
    expect(
      screen.getByRole("button", { name: "Add custom effect" }),
    ).toBeDisabled();
  });
});
