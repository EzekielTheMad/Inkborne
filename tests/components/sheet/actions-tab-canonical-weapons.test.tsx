import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ActionsTab } from "@/components/sheet/tabs/actions-tab";
import { canonicalWeaponRef } from "../../../e2e/print/canonical-weapons";
import { printFixture } from "../../../e2e/print/fixtures";
import type { RollRequest, RollResult } from "@/lib/dice/types";

const mocks = vi.hoisted(() => ({ roll: vi.fn(), natural: 12 }));
vi.mock("@/lib/character/character-context", () => ({
  // Confirmed component input; actual provider admission has separate coverage.
  useRolls: () => ({ rolls: [], roll: mocks.roll, assertMechanics: vi.fn(), mechanics: { status: "available" } }),
  useActiveEffects: () => ({ activeEffects: [] }),
}));

function setup(kind: "melee" | "ranged" | "finesse", missingDamage = false) {
  const ctx = printFixture("martial"), ref = canonicalWeaponRef(kind);
  if (missingDamage) ref.content_definitions.data.damage = null;
  ctx.evalResult.stats = { strength: 12, strength_mod: 1, dexterity: 18, dexterity_mod: 4 };
  ctx.evalResult.grants = [{ type: "grant", stat: "simple_weapons", value: "proficient" }];
  render(<ActionsTab character={ctx.character} schema={ctx.schema} evalResult={ctx.evalResult} contentRefs={[ref]} />);
}
beforeEach(() => {
  mocks.natural = 12;
  mocks.roll.mockReset().mockImplementation((request: RollRequest): RollResult => ({ request, groups: [{ sides: 20, rolls: [mocks.natural], kept: [mocks.natural] }], modifier: 0, total: mocks.natural, natural: mocks.natural, rolled_at: "2026-10-11T00:00:00Z" }));
});
describe("actual ActionsTab with canonical parsed weapon data", () => {
  it("renders a canonical ranged weapon and rolls correct dice/type using DEX without simple proficiency", async () => {
    setup("ranged");
    expect(screen.getByText("120/480 ft")).toBeVisible();
    expect(screen.getByRole("button", { name: "Roll Ridge Bow damage" })).toHaveTextContent("1d8 +4 piercing");
    fireEvent.click(screen.getByRole("button", { name: "Roll Ridge Bow attack" }));
    fireEvent.click(await screen.findByRole("button", { name: "Roll" }));
    expect(mocks.roll).toHaveBeenLastCalledWith({ kind: "attack", label: "Ridge Bow — Attack", expression: "1d20+4" }, { abilities: ["dexterity"], computed: ["proficiency_bonus"], values: [4] });
    fireEvent.click(screen.getByRole("button", { name: "Roll Ridge Bow damage" }));
    expect(mocks.roll).toHaveBeenLastCalledWith({ kind: "damage", label: "Ridge Bow — Damage", expression: "1d8+4", meta: { damage_type: "piercing" } }, { abilities: ["dexterity"], values: [4] });
  });
  it("uses STR and the matching simple category for canonical melee", () => {
    setup("melee");
    expect(screen.getByRole("button", { name: "Roll Trail Mallet attack" })).toHaveTextContent("+4");
    fireEvent.click(screen.getByRole("button", { name: "Roll Trail Mallet damage" }));
    expect(mocks.roll).toHaveBeenLastCalledWith({ kind: "damage", label: "Trail Mallet — Damage", expression: "1d6+1", meta: { damage_type: "bludgeoning" } }, { abilities: ["strength"], values: [4] });
  });
  it("uses the stronger finesse ability and preserves one-shot crit arming", async () => {
    mocks.natural = 20; setup("finesse");
    fireEvent.click(screen.getByRole("button", { name: "Roll Courier Needle attack" }));
    fireEvent.click(await screen.findByRole("button", { name: "Roll" }));
    expect(screen.getByText("Crit!")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Roll Courier Needle damage" }));
    expect(mocks.roll).toHaveBeenLastCalledWith({ kind: "damage", label: "Courier Needle — Damage", expression: "1d8+4", crit: true, meta: { damage_type: "piercing" } }, { abilities: ["strength", "dexterity"], values: [4] });
    expect(screen.queryByText("Crit!")).toBeNull();
  });
  it("keeps missing canonical damage unavailable and disables its roll", () => {
    setup("melee", true);
    expect(screen.getByRole("button", { name: "Roll Trail Mallet damage" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Roll Trail Mallet damage" })).toHaveTextContent("Damage unavailable");
  });
});
