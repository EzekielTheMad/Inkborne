import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { EquipmentStepClient } from "@/app/(app)/characters/[id]/builder/equipment/equipment-step-client";
import type { EquipmentCatalogItem } from "@/lib/builder/equipment-choices";
import type { StartingEquipmentSelections } from "@/lib/types/character";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/supabase/character-client", () => ({
  updateCharacter: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/app/(app)/characters/[id]/builder/equipment/actions", () => ({ confirmStartingEquipment: vi.fn() }));
import { confirmStartingEquipment } from "@/app/(app)/characters/[id]/builder/equipment/actions";
const mockedConfirm = vi.mocked(confirmStartingEquipment);

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
    version: 1,
    name: "Mace",
    slug: "mace",
    content_type: "weapon",
    weapon_category: "Simple",
    weapon_range: "Melee",
  },
  {
    id: "id-warhammer",
    version: 1,
    name: "Warhammer",
    slug: "warhammer",
    content_type: "weapon",
    weapon_category: "Martial",
    weapon_range: "Melee",
  },
  {
    id: "id-shield",
    version: 1,
    name: "Shield",
    slug: "shield",
    content_type: "armor",
    weapon_category: null,
    weapon_range: null,
  },
  {
    id: "id-amulet",
    version: 1,
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
    version: 1,
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
    version: number;
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
  mockedConfirm.mockResolvedValue({ status: "awarded", receipt: {
    grant_id: "11111111-1111-4111-8111-111111111111", inventory_ids: [], awarded_at: "2026-10-04",
    plan: { items: [{ content_id: null, content_version: null, name: "Recorded item", content_type: "item", quantity: 1 }], currency: { gp: 15 } },
  } });
  mockedUpdateCharacter.mockResolvedValue(undefined);
  mockedAddInventoryItem.mockResolvedValue({
    id: "inv-1",
  } as unknown as Awaited<ReturnType<typeof addInventoryItem>>);
  mockedUpdateCharacterState.mockResolvedValue(undefined);
});

describe("EquipmentStepClient", () => {
  it("waits for a selection save, retains an explicit retry, and does not grant optimistic selections", async () => {
    let rejectSave!: (error: Error) => void;
    mockedUpdateCharacter.mockReturnValueOnce(new Promise<void>((_, reject) => { rejectSave = reject; }));
    renderStep({ startingEquipment: { selections: { "class:0": "a" }, picks: { "class:1:a:1:0": "amulet" } } });
    fireEvent.click(screen.getByRole("button", { name: /warhammer/i }));
    expect(screen.getByRole("button", { name: "Confirm Equipment" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /a mace/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm Equipment" }));
    expect(mockedAddInventoryItem).not.toHaveBeenCalled();
    await act(async () => rejectSave(new Error("private database detail")));
    expect(screen.getByRole("alert")).toHaveTextContent("selection could not be confirmed");
    expect(screen.getByRole("alert")).not.toHaveTextContent("private database detail");
    expect(screen.getByRole("button", { name: /a mace/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Confirm Equipment" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /warhammer/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirm Equipment" })).toBeEnabled());
    expect(mockedUpdateCharacter).toHaveBeenCalledTimes(2);
    expect(mockedAddInventoryItem).not.toHaveBeenCalled();
  });

  it("blocks new confirmation after an uncertain atomic response without exposing server details", async () => {
    mockedConfirm.mockResolvedValueOnce({ status: "uncertain" });
    renderStep({ startingEquipment: { selections: { "class:0": "a" }, picks: { "class:1:a:1:0": "amulet" } } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Equipment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Check the saved award");
    expect(screen.getByRole("alert")).not.toHaveTextContent("private grant detail");
    expect(screen.getByRole("button", { name: "Confirm Equipment" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm Equipment" }));
    expect(mockedConfirm).toHaveBeenCalledTimes(1);
    expect(mockedAddInventoryItem).not.toHaveBeenCalled();
    expect(mockedUpdateCharacter).not.toHaveBeenCalled();
  });

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

  it("submits pinned selection intent once and displays the recorded receipt plan", async () => {
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

    expect(mockedConfirm).toHaveBeenCalledWith({
      characterId: "char-1", selections: { selections: { "class:0": "a" }, picks: { "class:1:a:1:0": "amulet" } },
      sources: { class: { id: "class-1", version: 1 }, background: null },
    });
    expect(screen.getByText("Recorded item")).toBeInTheDocument();
    expect(mockedAddInventoryItem).not.toHaveBeenCalled();
    expect(mockedUpdateCharacterState).not.toHaveBeenCalled();
    expect(mockedUpdateCharacter).not.toHaveBeenCalled();

    // Chooser is locked after confirm
    expect(screen.getByRole("button", { name: /a mace/i })).toBeDisabled();
  });

  it("leaves background currency and confirmation to the atomic server entry", async () => {
    renderStep({
      equipment: "A mace or a warhammer",
      startingEquipment: { selections: { "class:0": "a" }, picks: {} },
      backgroundContent: {
        id: "bg-1",
        name: "Acolyte",
        slug: "acolyte",
        version: 1,
        data: { equipment: "Vestments, and a pouch containing 15 gp" },
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Confirm Equipment" }));

    await screen.findByText("Added to inventory");
    expect(mockedConfirm).toHaveBeenCalledWith(expect.objectContaining({ sources: {
      class: { id: "class-1", version: 1 }, background: { id: "bg-1", version: 1 },
    } }));
    expect(mockedUpdateCharacterState).not.toHaveBeenCalled();
  });

  it("surfaces an error and stays unconfirmed when a grant fails", async () => {
    mockedConfirm.mockRejectedValue(new Error("private permission detail"));
    renderStep({
      equipment: "A mace or a warhammer",
      startingEquipment: { selections: { "class:0": "a" }, picks: {} },
    });

    fireEvent.click(screen.getByRole("button", { name: "Confirm Equipment" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/equipment could not be confirmed/i),
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
  it("blocks a stale saved category pick instead of confirming incomplete grants", () => {
    renderStep({ startingEquipment: { selections: { "class:0": "a" }, picks: { "class:1:a:1:0": "deleted-catalog-slug" } } });
    expect(screen.getByRole("button", { name: "Confirm Equipment" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("no longer available");
    fireEvent.click(screen.getByRole("button", { name: "Confirm Equipment" }));
    expect(mockedAddInventoryItem).not.toHaveBeenCalled();
  });

  it("blocks catalog items that do not belong to a saved pick's category", () => {
    renderStep({ startingEquipment: { selections: { "class:0": "a" }, picks: { "class:1:a:1:0": "warhammer" } } });
    expect(screen.getByRole("button", { name: "Confirm Equipment" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("current options");
  });

});

describe("atomic equipment recovery", () => {
  it("replays the exact request on an explicit receipt check and never uses sequential helpers", async () => {
    mockedConfirm.mockResolvedValueOnce({ status: "uncertain" });
    renderStep({ startingEquipment: { selections: { "class:0": "a" }, picks: { "class:1:a:1:0": "amulet" } } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Equipment" }));
    fireEvent.click(await screen.findByRole("button", { name: "Check saved equipment award" }));
    await screen.findByText("Added to inventory");
    expect(mockedConfirm.mock.calls[1]).toEqual(mockedConfirm.mock.calls[0]);
    expect(mockedAddInventoryItem).not.toHaveBeenCalled();
    expect(mockedUpdateCharacter).not.toHaveBeenCalled();
  });
  it.each(["conflict", "not_eligible"] as const)("locks %s without a grant retry", async status => {
    mockedConfirm.mockResolvedValue({ status });
    renderStep({ startingEquipment: { selections: { "class:0": "a" }, picks: { "class:1:a:1:0": "amulet" } } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Equipment" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Confirm Equipment" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Check saved equipment award" })).not.toBeInTheDocument();
  });
});

it("points to incomplete builder choices and prevents finishing before they are saved", () => {
  render(<EquipmentStepClient characterId="char-1" character={{ id: "char-1", level: 1, choices: {}, state: null }}
    classContent={null} backgroundContent={null} catalog={[]} completion={{ status: "inherited_completion" }}
    incompleteSteps={[{ type: "class", label: "Class" }]} />);
  expect(screen.getByRole("button", { name: "Finish & View Character" })).toBeDisabled();
  expect(screen.getByRole("link", { name: "Class" })).toHaveAttribute("href", "/characters/char-1/builder/class");
});

it("requires a confirmed equipment award even after all other builder steps are complete", () => {
  render(<EquipmentStepClient characterId="char-1" character={{ id: "char-1", level: 1, choices: {}, state: null }}
    classContent={null} backgroundContent={null} catalog={[]} incompleteSteps={[]} />);
  expect(screen.getByRole("button", { name: "Finish & View Character" })).toBeDisabled();
});

it.each(["awarded", "inherited_completion"] as const)("shows terminal %s with no catalog and no confirmation path", status => {
  const receipt = { grant_id: "11111111-1111-4111-8111-111111111111", inventory_ids: [], awarded_at: "2026-10-04", plan: { items: [{ content_id: null, content_version: null, name: "Consumed original item", content_type: "item" as const, quantity: 2 }], currency: { gp: 15 } } };
  render(<EquipmentStepClient characterId="char-1" character={{ id: "char-1", level: 1, choices: {}, state: null }} classContent={null} backgroundContent={null} catalog={[]} completion={status === "awarded" ? { status, receipt } : { status }} />);
  expect(screen.queryByRole("button", { name: "Confirm Equipment" })).not.toBeInTheDocument();
  expect(mockedConfirm).not.toHaveBeenCalled();
  if (status === "awarded") expect(screen.getByText("Consumed original item x2")).toBeInTheDocument();
  else expect(screen.getByText(/No new equipment or currency/)).toBeInTheDocument();
});
