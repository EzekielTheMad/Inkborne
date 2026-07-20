import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EquipmentStepClient } from "@/app/(app)/characters/[id]/builder/equipment/equipment-step-client";
import type { EquipmentCatalogItem } from "@/lib/builder/equipment-choices";
import type { StartingEquipmentSelections } from "@/lib/types/character";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/supabase/character-client", () => ({
  updateCharacter: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/supabase/inventory", () => ({
  addInventoryItem: vi.fn().mockResolvedValue({ id: "inv-1" }),
}));

vi.mock("@/lib/sheet/update-state", () => ({
  updateCharacterState: vi.fn().mockResolvedValue(undefined),
}));

import { updateCharacter } from "@/lib/supabase/character-client";
import { addInventoryItem } from "@/lib/supabase/inventory";
import { updateCharacterState } from "@/lib/sheet/update-state";

const mockedUpdateCharacter = vi.mocked(updateCharacter);
const mockedAddInventoryItem = vi.mocked(addInventoryItem);
const mockedUpdateCharacterState = vi.mocked(updateCharacterState);

const CATALOG: EquipmentCatalogItem[] = [
  {
    id: "id-mace",
    name: "Mace",
    slug: "mace",
    content_type: "weapon",
    weapon_category: "Simple",
    weapon_range: "Melee",
  },
  {
    id: "id-warhammer",
    name: "Warhammer",
    slug: "warhammer",
    content_type: "weapon",
    weapon_category: "Martial",
    weapon_range: "Melee",
  },
  {
    id: "id-shield",
    name: "Shield",
    slug: "shield",
    content_type: "armor",
    weapon_category: null,
    weapon_range: null,
  },
  {
    id: "id-amulet",
    name: "Amulet",
    slug: "amulet",
    content_type: "item",
    weapon_category: null,
    weapon_range: null,
  },
];

function classContent(equipment: string) {
  return {
    id: "class-1",
    name: "Cleric",
    slug: "cleric",
    data: { equipment },
  };
}

function renderStep({
  equipment = "A mace or a warhammer; a shield and a holy symbol",
  startingEquipment,
  backgroundContent = null,
}: {
  equipment?: string;
  startingEquipment?: string | StartingEquipmentSelections;
  backgroundContent?: {
    id: string;
    name: string;
    slug: string;
    data: Record<string, unknown>;
  } | null;
} = {}) {
  return render(
    <EquipmentStepClient
      characterId="char-1"
      character={{
        id: "char-1",
        level: 1,
        choices: { starting_equipment: startingEquipment },
        state: null,
      }}
      classContent={classContent(equipment)}
      backgroundContent={backgroundContent}
      catalog={CATALOG}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedUpdateCharacter.mockResolvedValue(undefined);
  mockedAddInventoryItem.mockResolvedValue({
    id: "inv-1",
  } as unknown as Awaited<ReturnType<typeof addInventoryItem>>);
  mockedUpdateCharacterState.mockResolvedValue(undefined);
});

describe("EquipmentStepClient", () => {
  it("disables Confirm until every choice and pick is made", async () => {
    renderStep();

    const confirm = screen.getByRole("button", { name: "Confirm Equipment" });
    expect(confirm).toBeDisabled();

    // Choose the mace
    fireEvent.click(screen.getByRole("button", { name: /a mace/i }));
    await waitFor(() => expect(mockedUpdateCharacter).toHaveBeenCalled());
    expect(confirm).toBeDisabled();

    // Pick the holy symbol
    fireEvent.click(screen.getByRole("combobox", { name: "Holy symbol" }));
    fireEvent.click(screen.getByRole("option", { name: "Amulet" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Confirm Equipment" }),
      ).toBeEnabled(),
    );
  });

  it("persists selections as they are made", async () => {
    renderStep();

    fireEvent.click(screen.getByRole("button", { name: /warhammer/i }));

    await waitFor(() =>
      expect(mockedUpdateCharacter).toHaveBeenCalledWith("char-1", {
        choices: {
          starting_equipment: {
            selections: { "class:0": "b" },
            picks: {},
          },
        },
      }),
    );
  });

  it("restores persisted selections on revisit", () => {
    renderStep({
      startingEquipment: {
        selections: { "class:0": "a" },
        picks: { "class:1:a:1:0": "amulet" },
      },
    });

    expect(screen.getByRole("button", { name: /a mace/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("combobox", { name: "Holy symbol" }),
    ).toHaveTextContent("Amulet");
    expect(
      screen.getByRole("button", { name: "Confirm Equipment" }),
    ).toBeEnabled();
  });

  it("grants the selected items on confirm and marks the step confirmed", async () => {
    renderStep({
      startingEquipment: {
        selections: { "class:0": "a" },
        picks: { "class:1:a:1:0": "amulet" },
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Confirm Equipment" }));

    await waitFor(() =>
      expect(screen.getByText("Added to inventory")).toBeInTheDocument(),
    );

    expect(mockedAddInventoryItem).toHaveBeenCalledTimes(3);
    expect(mockedAddInventoryItem).toHaveBeenCalledWith("char-1", {
      content_id: "id-mace",
      name: "Mace",
      content_type: "weapon",
      quantity: 1,
    });
    expect(mockedAddInventoryItem).toHaveBeenCalledWith("char-1", {
      content_id: "id-shield",
      name: "Shield",
      content_type: "armor",
      quantity: 1,
    });
    expect(mockedAddInventoryItem).toHaveBeenCalledWith("char-1", {
      content_id: "id-amulet",
      name: "Amulet",
      content_type: "item",
      quantity: 1,
    });

    // Unselected option was NOT granted
    expect(mockedAddInventoryItem).not.toHaveBeenCalledWith(
      "char-1",
      expect.objectContaining({ name: "Warhammer" }),
    );

    // No currency in this equipment string
    expect(mockedUpdateCharacterState).not.toHaveBeenCalled();

    // Confirmed flag persisted
    expect(mockedUpdateCharacter).toHaveBeenLastCalledWith("char-1", {
      choices: {
        starting_equipment: {
          selections: { "class:0": "a" },
          picks: { "class:1:a:1:0": "amulet" },
          confirmed: true,
        },
      },
    });

    // Chooser is locked after confirm
    expect(screen.getByRole("button", { name: /a mace/i })).toBeDisabled();
  });

  it("grants background currency through the state patch helper", async () => {
    renderStep({
      equipment: "A mace or a warhammer",
      startingEquipment: { selections: { "class:0": "a" }, picks: {} },
      backgroundContent: {
        id: "bg-1",
        name: "Acolyte",
        slug: "acolyte",
        data: { equipment: "Vestments, and a pouch containing 15 gp" },
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Confirm Equipment" }));

    await waitFor(() =>
      expect(mockedUpdateCharacterState).toHaveBeenCalledWith("char-1", {
        currency: { cp: 0, sp: 0, ep: 0, gp: 15, pp: 0 },
      }),
    );
  });

  it("surfaces an error and stays unconfirmed when a grant fails", async () => {
    mockedAddInventoryItem.mockRejectedValue(new Error("permission denied"));
    renderStep({
      equipment: "A mace or a warhammer",
      startingEquipment: { selections: { "class:0": "a" }, picks: {} },
    });

    fireEvent.click(screen.getByRole("button", { name: "Confirm Equipment" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/could not add/i),
    );
    expect(screen.queryByText("Added to inventory")).not.toBeInTheDocument();
    // The confirmed flag was never written
    expect(mockedUpdateCharacter).not.toHaveBeenCalledWith(
      "char-1",
      expect.objectContaining({
        choices: expect.objectContaining({
          starting_equipment: expect.objectContaining({ confirmed: true }),
        }),
      }),
    );
  });

  it("renders legacy acknowledged characters read-only", () => {
    renderStep({ startingEquipment: "acknowledged" });

    expect(
      screen.getByText(/equipment was confirmed for this character/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Confirm Equipment" }),
    ).not.toBeInTheDocument();
  });

  it("prompts for a class when none is selected", () => {
    render(
      <EquipmentStepClient
        characterId="char-1"
        character={{ id: "char-1", level: 1, choices: {}, state: null }}
        classContent={null}
        backgroundContent={null}
        catalog={CATALOG}
      />,
    );

    expect(
      screen.getByText(/select a class first/i),
    ).toBeInTheDocument();
  });
});
