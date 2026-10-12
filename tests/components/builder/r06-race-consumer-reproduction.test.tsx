import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RaceStepClient } from "@/app/(app)/characters/[id]/builder/race/race-step-client";
import { AbilitiesStepClient } from "@/app/(app)/characters/[id]/builder/abilities/abilities-step-client";
import { ClassStepClient } from "@/app/(app)/characters/[id]/builder/class/class-step-client";
import { parseContentDefinition } from "@/lib/supabase/content-definitions-parser";
import { syntheticRacePin, raceParityBase, raceParitySchema, evaluateSyntheticPin, pinnedRaceRef } from "../../fixtures/r06-race-parity";
import type { Effect } from "@/lib/types/effects";

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
    base_stats: raceParityBase, choices: { race: pin.slug, ability_method: "manual" as const },
  };
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
    ["dual", 12, 14, 14], ["scores-only", 10, 12, 12], ["effects-only", 12, 14, 12],
  ] as const)("Race client %s pin: preview STR=%i CON=%i; live STR=%i", (mode, previewStr, previewCon, liveStr) => {
    const { pin } = syntheticRacePin(mode);
    render(<RaceStepClient characterId="r06-synthetic-character" character={character(pin)} races={[pin]} subraces={[]} traits={[]}
      contentRefs={[pinnedRaceRef(pin)]} schema={raceParitySchema} />);
    expect(previewScore("STR")).toBe(String(previewStr));
    expect(previewScore("CON")).toBe(String(previewCon));
    expect(evaluateSyntheticPin(pin).stats.strength).toBe(liveStr);
  });

  it.each(["dual", "scores-only", "effects-only"] as const)("Abilities %s pin displays original bonuses once; its sidebar follows effects", mode => {
    const { pin } = syntheticRacePin(mode);
    render(<AbilitiesStepClient ownerId="r06-synthetic-owner" characterId="r06-synthetic-character" character={character(pin)}
      contentRefs={[pinnedRaceRef(pin)]} schema={raceParitySchema} />);
    expect(abilityTotal("Strength")).toBe("12");
    expect(abilityTotal("Constitution")).toBe("14");
    expect(previewScore("STR")).toBe(mode === "scores-only" ? "10" : "12");
    expect(previewScore("CON")).toBe(mode === "scores-only" ? "12" : "14");
  });

  it.each(["dual", "scores-only", "effects-only"] as const)("Class %s pin sends effects-only scores through real rail/prerequisites", mode => {
    const { pin } = syntheticRacePin(mode);
    const fighter = classEntry("fighter", "55555555-5555-4555-8555-555555555555");
    const barbarian = classEntry("barbarian", "66666666-6666-4666-8666-666666666666");
    const selected = { ...character(pin), choices: { ...character(pin).choices, classes: [{ slug: "fighter", level: 3 }] } };
    render(<ClassStepClient characterId={selected.id} character={selected} classes={[fighter, barbarian]} subclasses={[]} features={[]}
      feats={[]} spells={[]} contentRefs={[pinnedRaceRef(pin), { ...pinnedRaceRef(pin), content_id: fighter.id, content_version: 1, content_definitions: fighter }]}
      schema={raceParitySchema} />);
    // Only Barbarian is unselected: STR12 or10 fails13 in the actual class rail;
    // live dual STR14 incorrectly meets it (shown in the engine reproduction).
    expect(screen.getByRole("button", { name: /Add a class · Locked/ })).toHaveAttribute("aria-disabled", "true");
    expect(previewScore("STR")).toBe(mode === "scores-only" ? "10" : "12");
    expect(previewScore("CON")).toBe(mode === "scores-only" ? "12" : "14");
  });

  it.each([
    ["same-value manual", { type: "mechanical", stat: "strength", op: "add", value: 2 }],
    ["conditional manual", { type: "mechanical", stat: "strength", op: "add", value: 2, condition: { field: "rage_active", op: "eq", value: true } }],
    ["formula manual", { type: "mechanical", stat: "strength", op: "formula", expr: "strength + 2" }],
  ] as Array<[string, Effect]>)("Abilities scores preference omits %s from its total; preserve the effect's intent", (_label, effect) => {
    const { pin } = syntheticRacePin("scores-only", [effect]);
    render(<AbilitiesStepClient ownerId="r06-synthetic-owner" characterId="r06-synthetic-character" character={character(pin)}
      contentRefs={[pinnedRaceRef(pin)]} schema={raceParitySchema} />);
    expect(abilityTotal("Strength")).toBe("12"); // currently ignores every ability effect on scores-bearing race
    expect(evaluateSyntheticPin(pin, { rage_active: true }).stats.strength).toBe(14);
    expect(pin.effects.at(-1)).toEqual(effect);
  });

  it("effects-only conditional fallback attributes an inactive bonus even though the real preview omits it", () => {
    const { pin } = syntheticRacePin("effects-only", [{ type: "mechanical", stat: "strength", op: "add", value: 2,
      condition: { field: "rage_active", op: "eq", value: true } }]);
    render(<AbilitiesStepClient ownerId="r06-synthetic-owner" characterId="r06-synthetic-character" character={character(pin)}
      contentRefs={[pinnedRaceRef(pin)]} schema={raceParitySchema} />);
    expect(abilityTotal("Strength")).toBe("14");
    expect(previewScore("STR")).toBe("12");
    expect(evaluateSyntheticPin(pin, { rage_active: false }).stats.strength).toBe(12);
    expect(evaluateSyntheticPin(pin, { rage_active: true }).stats.strength).toBe(14);
  });
});
