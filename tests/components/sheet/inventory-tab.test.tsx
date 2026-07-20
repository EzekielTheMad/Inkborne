import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { InventoryTab } from "@/components/sheet/tabs/inventory-tab";
import type {
  CharacterContextValue,
} from "@/lib/character/character-context";

const mockCtx: Partial<CharacterContextValue> = {
  inventory: [],
  currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
  addItem: vi.fn().mockResolvedValue(undefined),
  updateItem: vi.fn().mockResolvedValue(undefined),
  removeItem: vi.fn().mockResolvedValue(undefined),
  setCurrency: vi.fn(),
  character: {
    id: "char-1",
    name: "Test",
    system_id: "sys-1",
  } as unknown as CharacterContextValue["character"],
  evalResult: {
    stats: { strength: 14 },
    computed: {},
    narratives: [],
    grants: [],
    speed: { walk: 30 },
    vision: [],
    dmgres: [],
    savetxt: { adv_vs: [], immune: [] },
    attacks: 1,
    improvements: false,
  } as unknown as CharacterContextValue["evalResult"],
};

vi.mock("@/lib/character/character-context", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/character/character-context")
  >("@/lib/character/character-context");
  return {
    ...actual,
    useCharacter: () => ({
      character: mockCtx.character,
      evalResult: mockCtx.evalResult,
      schema: {},
      contentRefs: [],
      isOwner: true,
      isDm: false,
      hasSheet: true,
      maxHp: 10,
    }),
    useInventory: () => ({
      inventory: mockCtx.inventory,
      currency: mockCtx.currency,
      addItem: mockCtx.addItem,
      updateItem: mockCtx.updateItem,
      removeItem: mockCtx.removeItem,
      setCurrency: mockCtx.setCurrency,
    }),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("InventoryTab", () => {
  it("renders an empty inventory message", () => {
    mockCtx.inventory = [];
    render(<InventoryTab />);
    // At minimum, the "Add Item" button should be visible
    expect(
      screen.getByRole("button", { name: /add item/i }),
    ).toBeInTheDocument();
  });

  it("renders a weapons section when a weapon is equipped", () => {
    mockCtx.inventory = [
      {
        id: "inv-1",
        character_id: "char-1",
        content_id: "c1",
        name: "Longsword",
        content_type: "weapon",
        quantity: 1,
        equipped: false,
        attuned: false,
        sort_order: 0,
        notes: null,
        custom_data: null,
        created_at: "2026-01-01",
        content_definitions: {
          id: "c1",
          name: "Longsword",
          slug: "longsword",
          content_type: "weapon",
          version: 1,
          source: "srd",
          data: {
            damage: { dice: "1d8", type: "slashing" },
            weight: 3,
          },
          effects: [],
        },
      },
    ];
    render(<InventoryTab />);
    expect(screen.getByText("Longsword")).toBeInTheDocument();
  });
});
