import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ActionsTab } from "@/components/sheet/tabs/actions-tab";
import { canonicalWeaponRef } from "../../../e2e/print/canonical-weapons";
import { printFixture } from "../../../e2e/print/fixtures";
import type { RollRequest, RollResult } from "@/lib/dice/types";
import type { InventoryItem } from "@/lib/types/inventory";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";

const mocks = vi.hoisted(() => ({ roll: vi.fn(), natural: 12, inventory: [] as InventoryItem[] }));
vi.mock("@/lib/character/character-context", () => ({
  // Confirmed component input; actual provider admission has separate coverage.
  useRolls: () => ({ rolls: [], roll: mocks.roll, assertMechanics: vi.fn(), mechanics: { status: "available" } }),
  useActiveEffects: () => ({ activeEffects: [] }),
  useInventory: () => ({ inventory: mocks.inventory }),
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
  mocks.inventory = [];
  mocks.roll.mockReset().mockImplementation((request: RollRequest): RollResult => ({ request, groups: [{ sides: 20, rolls: [mocks.natural], kept: [mocks.natural] }], modifier: 0, total: mocks.natural, natural: mocks.natural, rolled_at: "2026-10-11T00:00:00Z" }));
});

function savedWeapon(overrides: Partial<InventoryItem> = {}): InventoryItem {
  const ref = canonicalWeaponRef("melee"), ctx = printFixture("martial");
  return { id: "saved-weapon", character_id: ctx.character.id, content_id: ref.content_id,
    content_version: ref.content_version, name: ref.content_definitions.name, content_type: "weapon", quantity: 1,
    equipped: true, attuned: false, sort_order: 0, notes: null, custom_data: null, created_at: "2026-10-29",
    content_definitions: { ...ref.content_definitions, system_id: ctx.character.system_id }, ...overrides };
}
function renderInventory(refs: ContentRefWithContent[] = []) {
  const ctx = printFixture("martial");
  ctx.evalResult.stats = { strength: 12, strength_mod: 1, dexterity: 18, dexterity_mod: 4 };
  ctx.evalResult.grants = [{ type: "grant", stat: "simple_weapons", value: "proficient" }];
  return render(<ActionsTab character={ctx.character} schema={ctx.schema} evalResult={ctx.evalResult} contentRefs={refs} />);
}

describe("ActionsTab consumes equipped saved inventory", () => {
  it("offers and rolls a pinned equipped inventory weapon without a separate weapon ref", async () => {
    mocks.inventory = [savedWeapon()]; renderInventory();
    expect(screen.getByRole("button", { name: "Roll Trail Mallet attack" })).toHaveTextContent("+4");
    fireEvent.click(screen.getByRole("button", { name: "Roll Trail Mallet attack" }));
    fireEvent.click(await screen.findByRole("button", { name: "Roll" }));
    expect(mocks.roll).toHaveBeenLastCalledWith({ kind: "attack", label: "Trail Mallet — Attack", expression: "1d20+4" },
      { abilities: ["strength"], computed: ["proficiency_bonus"], values: [4] });
  });
  it.each([
    { equipped: false }, { quantity: 0 }, { character_id: "another-character" },
    { content_id: null }, { content_version: 4 }, { content_definitions: null }, { content_type: "magic_item" },
  ] satisfies Partial<InventoryItem>[]) ("does not invent an inventory attack from invalid authority %j", change => {
    mocks.inventory = [savedWeapon(change)]; renderInventory();
    expect(screen.queryByRole("button", { name: /attack$/ })).toBeNull();
  });
  it("deduplicates a matching plain pin while retaining another pinned version", () => {
    const ref = canonicalWeaponRef("melee"), other = canonicalWeaponRef("melee");
    other.content_version = 4; other.content_definitions = { ...other.content_definitions, version: 4, name: "Earlier Mallet" };
    mocks.inventory = [savedWeapon()]; renderInventory([ref, other]);
    expect(screen.getAllByRole("button", { name: "Roll Trail Mallet attack" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Roll Earlier Mallet attack" })).toBeVisible();
  });
  it("retains a named instance and its supported inventory overrides beside the legacy definition", () => {
    mocks.inventory = [savedWeapon({ name: "Personal Mallet", custom_data: { damage: { dice: "1d10", type: "fire" } } })];
    renderInventory([canonicalWeaponRef("melee")]);
    expect(screen.getByRole("button", { name: "Roll Personal Mallet damage" })).toHaveTextContent("1d10 +1 fire");
    expect(screen.getByRole("button", { name: "Roll Trail Mallet attack" })).toBeVisible();
  });
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
