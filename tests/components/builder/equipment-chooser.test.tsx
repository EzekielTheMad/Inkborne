import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EquipmentChooser } from "@/components/builder/equipment-chooser";
import {
  parseEquipmentGroups,
  type EquipmentCatalogItem,
} from "@/lib/builder/equipment-choices";

const CLERIC_EQUIPMENT =
  "A mace or a warhammer (if proficient); a shield and a holy symbol";

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
    id: "id-amulet",
    name: "Amulet",
    slug: "amulet",
    content_type: "item",
    weapon_category: null,
    weapon_range: null,
  },
];

function chooserGroups() {
  return parseEquipmentGroups({ classText: CLERIC_EQUIPMENT });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EquipmentChooser", () => {
  it("renders choice options with letter prefixes", () => {
    render(
      <EquipmentChooser
        groups={chooserGroups()}
        catalog={CATALOG}
        selections={{}}
        picks={{}}
        onSelectOption={vi.fn()}
        onPick={vi.fn()}
      />,
    );

    expect(screen.getByText("A mace")).toBeInTheDocument();
    expect(screen.getByText("A warhammer (if proficient)")).toBeInTheDocument();
    expect(screen.getByText("Choose one")).toBeInTheDocument();
  });

  it("renders fixed groups as granted rows", () => {
    render(
      <EquipmentChooser
        groups={chooserGroups()}
        catalog={CATALOG}
        selections={{}}
        picks={{}}
        onSelectOption={vi.fn()}
        onPick={vi.fn()}
      />,
    );

    expect(screen.getByText("You receive")).toBeInTheDocument();
    expect(screen.getByText("A shield and a holy symbol")).toBeInTheDocument();
  });

  it("calls onSelectOption when an option is clicked", () => {
    const onSelectOption = vi.fn();
    render(
      <EquipmentChooser
        groups={chooserGroups()}
        catalog={CATALOG}
        selections={{}}
        picks={{}}
        onSelectOption={onSelectOption}
        onPick={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /warhammer/i }));
    expect(onSelectOption).toHaveBeenCalledWith("class:0", "b");
  });

  it("marks the selected option with aria-pressed", () => {
    render(
      <EquipmentChooser
        groups={chooserGroups()}
        catalog={CATALOG}
        selections={{ "class:0": "a" }}
        picks={{}}
        onSelectOption={vi.fn()}
        onPick={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /a mace/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /warhammer/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("renders a category picker for the fixed holy-symbol slot", () => {
    render(
      <EquipmentChooser
        groups={chooserGroups()}
        catalog={CATALOG}
        selections={{}}
        picks={{}}
        onSelectOption={vi.fn()}
        onPick={vi.fn()}
      />,
    );

    // The fixed "a holy symbol" item exposes a labeled select trigger
    expect(
      screen.getByRole("combobox", { name: "Holy symbol" }),
    ).toBeInTheDocument();
  });

  it("shows the picked value in the category picker", () => {
    render(
      <EquipmentChooser
        groups={chooserGroups()}
        catalog={CATALOG}
        selections={{}}
        picks={{ "class:1:a:1:0": "amulet" }}
        onSelectOption={vi.fn()}
        onPick={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("combobox", { name: "Holy symbol" }),
    ).toHaveTextContent("Amulet");
  });

  it("calls onPick when a category option is chosen", () => {
    const onPick = vi.fn();
    render(
      <EquipmentChooser
        groups={chooserGroups()}
        catalog={CATALOG}
        selections={{}}
        picks={{}}
        onSelectOption={vi.fn()}
        onPick={onPick}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "Holy symbol" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: "Amulet" }));

    expect(onPick).toHaveBeenCalledWith("class:1:a:1:0", "amulet");
  });

  it("disables all inputs when disabled", () => {
    render(
      <EquipmentChooser
        groups={chooserGroups()}
        catalog={CATALOG}
        selections={{ "class:0": "a" }}
        picks={{ "class:1:a:1:0": "amulet" }}
        disabled
        onSelectOption={vi.fn()}
        onPick={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /a mace/i })).toBeDisabled();
    expect(
      screen.getByRole("combobox", { name: "Holy symbol" }),
    ).toBeDisabled();
  });
});
