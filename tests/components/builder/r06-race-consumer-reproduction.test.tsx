import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RaceStepClient } from "@/app/(app)/characters/[id]/builder/race/race-step-client";
import { AbilitiesStepClient } from "@/app/(app)/characters/[id]/builder/abilities/abilities-step-client";
import { ClassStepClient } from "@/app/(app)/characters/[id]/builder/class/class-step-client";
import { parseContentDefinition } from "@/lib/supabase/content-definitions-parser";
import { transformSubraceEntry } from "../../../scripts/transformers/races";
import { syntheticRacePin, raceParityBase, raceParitySchema, evaluateSyntheticPin, pinnedRaceRef } from "../../fixtures/r06-race-parity";
import type { Effect } from "@/lib/types/effects";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";

// Mock only navigation/persistence and the ability draft boundary. Calculators,
// actual three builder clients, StatPreview and ClassStepRail stay real.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/character-client", () => ({ updateCharacter: vi.fn(), updateCharacterAndReturn: vi.fn() }));
vi.mock("@/lib/supabase/content-refs-client", () => ({ insertContentRef: vi.fn(), removeContentRefById: vi.fn() }));
vi.mock("@/app/(app)/characters/[id]/builder/class/actions", () => ({
  reconcileClassFeatureRefsAction: vi.fn(), searchUsableFeatsAction: vi.fn(), setCharacterAsiChoiceAction: vi.fn(),
}));
vi.mock("@/lib/builder/use-ability-score-draft", () => ({
  discardAbilityScoreDraft: vi.fn(),
  useAbilityScoreDraft: (_owner: string, _character: string, initial: unknown) => ({
    draft: initial, status: "saved", changeDraft: vi.fn(), retry: vi.fn(),
  }),
}));
afterEach(cleanup);

function previewScore(abbr: string) {
  const preview = screen.getByText("Stats").parentElement!;
  return within(preview).getByText(abbr).parentElement!.children[1].textContent;
}
function abilityTotal(name: string) {
  const card = screen.getByRole("spinbutton", { name: `${name} score` }).closest('[data-slot="card"]')! as HTMLElement;
  return within(card).getByText("Total").nextElementSibling!.textContent;
}
function character(pin: ReturnType<typeof syntheticRacePin>["pin"]) {
  return { id: "r06-synthetic-character", name: "Synthetic Character", level: 3,
    system_id: pin.system_id,
    base_stats: raceParityBase, choices: { race: pin.slug, ability_method: "manual" as const },
  };
}

function classEvidence(saved: ReturnType<typeof character>, pin: ReturnType<typeof syntheticRacePin>["pin"], fighter: ReturnType<typeof classEntry>) {
  const raceRef = { ...pinnedRaceRef(pin), character_id: saved.id, feature_grant_id: null, created_at: "2026-10-12T16:00:00Z" };
  const classRef = { ...raceRef, id: "88888888-8888-4888-8888-888888888888", content_id: fighter.id, content_version: fighter.version,
    context: { source: "class" }, content_definitions: fighter };
  const refs = [raceRef, classRef] as ContentRefWithContent[];
  return { refs, evidence: { status: "complete" as const, character_id: saved.id, system_id: pin.system_id, refs, grants: [] } };
}
function classEntry(slug: string, id: string) {
  const entry = parseContentDefinition({ id, system_id: "22222222-2222-4222-8222-222222222222", slug,
    name: `Synthetic ${slug}`, content_type: "class", source: "homebrew", scope: "personal",
    owner_id: "44444444-4444-4444-8444-444444444444", version: 1, effects: [],
    data: { hit_die: 8, spellcasting: null, multiclass: { prerequisites: [], proficiencies_gained: [] },
      saving_throws: [], starting_proficiencies: [],
      levels: [1, 2, 3].map(level => ({ level, features: [] })),
    },
  });
  if (!entry) throw new Error("Synthetic class must pass actual parser");
  return entry;
}

describe("R06.1 actual builder consumers of synthetic immutable race pins", () => {
  it.each([
    ["dual", 14, 16, 14], ["scores-only", 12, 14, 12], ["effects-only", 12, 14, 12],
    ["imported", 12, 14, 12], ["declared-effects", 12, 14, 12], ["declared-scores", 14, 16, 14],
  ] as const)("Race client %s pin: preview STR=%i CON=%i; live STR=%i", (mode, previewStr, previewCon, liveStr) => {
    const { pin } = syntheticRacePin(mode);
    render(<RaceStepClient characterId="r06-synthetic-character" character={character(pin)} races={[pin]} subraces={[]} traits={[]}
      contentRefs={[pinnedRaceRef(pin)]} schema={raceParitySchema} />);
    expect(previewScore("STR")).toBe(String(previewStr));
    expect(previewScore("CON")).toBe(String(previewCon));
    expect(evaluateSyntheticPin(pin).stats.strength).toBe(liveStr);
    expect(screen.queryByText(/Both are retained, so totals/)).toBe(mode === "dual" ? screen.getByText(/Both are retained, so totals/) : null);
  });

  it.each(["dual", "scores-only", "effects-only", "imported", "declared-effects", "declared-scores"] as const)("Abilities %s totals/sidebar follow the shared race contract", mode => {
    const { pin } = syntheticRacePin(mode);
    render(<AbilitiesStepClient ownerId="r06-synthetic-owner" characterId="r06-synthetic-character" character={character(pin)}
      contentRefs={[pinnedRaceRef(pin)]} schema={raceParitySchema} />);
    const expected = evaluateSyntheticPin(pin);
    expect(abilityTotal("Strength")).toBe(String(expected.stats.strength));
    expect(abilityTotal("Constitution")).toBe(String(expected.stats.constitution));
    expect(previewScore("STR")).toBe(String(expected.stats.strength));
    expect(previewScore("CON")).toBe(String(expected.stats.constitution));
  });

  it.each(["dual", "scores-only", "effects-only", "imported", "declared-effects", "declared-scores"] as const)("Class %s pin sends the shared scores through real rail/prerequisites", mode => {
    const { pin } = syntheticRacePin(mode);
    const fighter = classEntry("fighter", "55555555-5555-4555-8555-555555555555");
    const barbarian = classEntry("barbarian", "66666666-6666-4666-8666-666666666666");
    const selected = { ...character(pin), choices: { ...character(pin).choices, classes: [{ slug: "fighter", level: 3 }] } };
    const input = classEvidence(selected, pin, fighter);
    render(<ClassStepClient characterId={selected.id} character={selected} classes={[fighter, barbarian]} subclasses={[]} features={[]}
      feats={[]} spells={[]} contentRefs={input.refs} asiEvidence={input.evidence}
      schema={raceParitySchema} />);
    const expected = evaluateSyntheticPin(pin);
    if (expected.stats.strength >= 13) expect(screen.getByRole("button", { name: /Add a class · 17 levels remaining/ })).not.toHaveAttribute("aria-disabled", "true");
    else expect(screen.getByRole("button", { name: /Add a class · Locked/ })).toHaveAttribute("aria-disabled", "true");
    expect(previewScore("STR")).toBe(String(expected.stats.strength));
    expect(previewScore("CON")).toBe(String(expected.stats.constitution));
  });

  it.each([
    ["same-value manual", { type: "mechanical", stat: "strength", op: "add", value: 2 }],
    ["conditional manual", { type: "mechanical", stat: "strength", op: "add", value: 2, condition: { field: "rage_active", op: "eq", value: true } }],
    ["formula manual", { type: "mechanical", stat: "strength", op: "formula", expr: "strength + 2" }],
  ] as Array<[string, Effect]>)("Abilities evaluates %s without losing its intent", (_label, effect) => {
    const { pin } = syntheticRacePin("scores-only", [effect]);
    render(<AbilitiesStepClient ownerId="r06-synthetic-owner" characterId="r06-synthetic-character" character={character(pin)}
      contentRefs={[pinnedRaceRef(pin)]} schema={raceParitySchema} />);
    expect(abilityTotal("Strength")).toBe(String(evaluateSyntheticPin(pin).stats.strength));
    expect(previewScore("STR")).toBe(String(evaluateSyntheticPin(pin).stats.strength));
    expect(pin.effects.at(-1)).toEqual(effect);
  });

  it("an inactive conditional bonus is omitted from both actual totals and preview", () => {
    const { pin } = syntheticRacePin("effects-only", [{ type: "mechanical", stat: "strength", op: "add", value: 2,
      condition: { field: "rage_active", op: "eq", value: true } }]);
    render(<AbilitiesStepClient ownerId="r06-synthetic-owner" characterId="r06-synthetic-character" character={character(pin)}
      contentRefs={[pinnedRaceRef(pin)]} schema={raceParitySchema} />);
    expect(abilityTotal("Strength")).toBe("12");
    expect(previewScore("STR")).toBe("12");
    expect(evaluateSyntheticPin(pin, { rage_active: false }).stats.strength).toBe(12);
    expect(evaluateSyntheticPin(pin, { rage_active: true }).stats.strength).toBe(14);
  });

  it("saved active state reaches actual Ability totals and sidebar at identical state", () => {
    const { pin } = syntheticRacePin("scores-only", [{ type: "mechanical", stat: "strength", op: "add", value: 2,
      condition: { field: "rage_active", op: "eq", value: true } }]);
    render(<AbilitiesStepClient ownerId="r06-synthetic-owner" characterId="r06-synthetic-character" character={{ ...character(pin), state: { rage_active: true } }}
      contentRefs={[pinnedRaceRef(pin)]} schema={raceParitySchema} />);
    expect(abilityTotal("Strength")).toBe("14");
    expect(previewScore("STR")).toBe("14");
    expect(evaluateSyntheticPin(pin, { rage_active: true }).stats.strength).toBe(14);
  });

  it.each([false, true])("actual Race and Class preview/prerequisites share conditional state (%s)", active => {
    const { pin } = syntheticRacePin("scores-only", [{ type: "mechanical", stat: "strength", op: "add", value: 2,
      condition: { field: "rage_active", op: "eq", value: true } }]);
    const saved = { ...character(pin), state: { rage_active: active } };
    const expected = evaluateSyntheticPin(pin, saved.state).stats.strength;
    const race = render(<RaceStepClient characterId={saved.id} character={saved} races={[pin]} subraces={[]} traits={[]}
      contentRefs={[pinnedRaceRef(pin)]} schema={raceParitySchema} />);
    expect(previewScore("STR")).toBe(String(expected));
    race.unmount();
    const fighter = classEntry("fighter", "55555555-5555-4555-8555-555555555555");
    const barbarian = classEntry("barbarian", "66666666-6666-4666-8666-666666666666");
    const input = classEvidence(saved, pin, fighter);
    render(<ClassStepClient characterId={saved.id} character={{ ...saved, choices: { ...saved.choices, classes: [{ slug: "fighter", level: 3 }] } }}
      classes={[fighter, barbarian]} subclasses={[]} features={[]} feats={[]} spells={[]}
      contentRefs={input.refs} asiEvidence={input.evidence}
      schema={raceParitySchema} />);
    expect(previewScore("STR")).toBe(String(expected));
    expect(expected).toBe(active ? 14 : 12);
    expect(screen.getByRole("button", { name: active ? /Add a class · 17 levels remaining/ : /Add a class · Locked/ }))
      .toHaveAttribute(active ? "type" : "aria-disabled", active ? "button" : "true");
  });

  it("retains unearned saved ASI attribution without accepting its addition to totals", () => {
    const { pin } = syntheticRacePin("imported");
    const saved = { ...character(pin), choices: { ...character(pin).choices, asi_choices: {
      "synthetic-asi": { mode: "asi" as const, allocations: [{ ability: "strength", amount: 2 }] },
    } } };
    const before = JSON.stringify(saved.choices);
    render(<AbilitiesStepClient ownerId="r06-synthetic-owner" characterId={saved.id} character={saved}
      contentRefs={[pinnedRaceRef(pin)]} schema={raceParitySchema} />);
    expect(abilityTotal("Strength")).toBe("12");
    expect(previewScore("STR")).toBe("12");
    expect(screen.getByText("Saved Ability Score Improvement")).toBeInTheDocument();
    expect(screen.getByText(/Only earned, exact pinned occurrences participate in evaluation/)).toBeInTheDocument();
    expect(screen.getByText(/Saved choice amounts are unverified evidence, not accepted totals/)).toBeInTheDocument();
    expect(evaluateSyntheticPin(pin).stats.strength).toBe(12);
    expect(JSON.stringify(saved.choices)).toBe(before);
  });

  it("preserves a supplied scores-only subrace display without expanding canonical parsing or live mechanics", () => {
    const { pin, raw } = syntheticRacePin("imported");
    const subrace = { ...pin, id: "77777777-7777-4777-8777-777777777777", content_type: "subrace", slug: "synthetic-score-child",
      name: "Synthetic Score Child", data: { parent_race: pin.slug, scores: [0, 0, 0, 0, 0, 2] }, effects: [] };
    const refs = [pinnedRaceRef(pin), pinnedRaceRef(subrace)];
    const before = JSON.stringify(refs);
    render(<AbilitiesStepClient ownerId="r06-synthetic-owner" characterId="r06-synthetic-character" character={character(pin)} contentRefs={refs} schema={raceParitySchema} />);
    expect(abilityTotal("Charisma")).toBe("12"); // prior separately displayed +2 retained
    expect(previewScore("CHA")).toBe("10");
    expect(screen.getByText("Saved subrace bonus: Synthetic Score Child")).toBeInTheDocument();
    expect(screen.getByText(/Stats preview and live sheet omit those score-only bonuses/)).toBeInTheDocument();
    expect(JSON.stringify(refs)).toBe(before);
    const parsed = parseContentDefinition({ ...raw, ...subrace });
    expect(parsed?.data).not.toHaveProperty("scores"); // actual current schema limitation, unchanged
  });

  it("ordinary actual-transformer subrace effects keep their existing behavior", () => {
    const { pin, raw } = syntheticRacePin("imported");
    const child = transformSubraceEntry({ index: "synthetic-effect-child", name: "Synthetic Effect Child", desc: "Original child notes.",
      race: { index: pin.slug, name: pin.name }, ability_bonuses: [{ ability_score: { index: "int", name: "INT" }, bonus: 1 }],
      racial_traits: [], starting_proficiencies: [], languages: [],
    });
    const subrace = parseContentDefinition({ ...raw, ...child, id: "77777777-7777-4777-8777-777777777777" });
    if (!subrace) throw new Error("Actual transformed synthetic subrace must parse");
    render(<AbilitiesStepClient ownerId="r06-synthetic-owner" characterId="r06-synthetic-character" character={character(pin)}
      contentRefs={[pinnedRaceRef(pin), pinnedRaceRef(subrace)]} schema={raceParitySchema} />);
    expect(abilityTotal("Intelligence")).toBe("11");
    expect(previewScore("INT")).toBe("11");
    expect(screen.queryByText(/Saved subrace score bonuses remain/)).toBeNull();
  });

  it("discloses a dual nonlinear subrace gap without inferring a duplicate or altering its formula", () => {
    const { pin } = syntheticRacePin("imported");
    const subrace = { ...pin, id: "77777777-7777-4777-8777-777777777777", content_type: "subrace", slug: "synthetic-dual-child",
      name: "Synthetic Dual Child", data: { parent_race: pin.slug, scores: [2, 0, 0, 0, 0, 0] },
      effects: [{ type: "mechanical", stat: "strength", op: "formula", expr: "strength * 2" }] as Effect[] };
    const before = JSON.stringify(subrace);
    render(<AbilitiesStepClient ownerId="r06-synthetic-owner" characterId="r06-synthetic-character" character={character(pin)}
      contentRefs={[pinnedRaceRef(pin), pinnedRaceRef(subrace)]} schema={raceParitySchema} />);
    // Prior blanket scores preference showed14 (base10 + race2 + child2).
    // No additive offset can generally recover that policy from nonlinear24.
    expect(abilityTotal("Strength")).toBe("24");
    expect(previewScore("STR")).toBe("24");
    expect(screen.getByText(/former score-preferred display differs/)).toBeInTheDocument();
    expect(JSON.stringify(subrace)).toBe(before);
  });
});
