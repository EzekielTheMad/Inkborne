import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(app)/homebrew/spells/actions", () => ({
  createHomebrewSpell: vi.fn(),
  updateHomebrewSpell: vi.fn(),
}));

import { SpellForm } from "@/components/library/spell-form";

const classes = [
  { slug: "wizard", name: "Wizard" },
  { slug: "sorcerer", name: "Sorcerer" },
];

describe("SpellForm", () => {
  it("renders accessible create fields and keeps automation secondary", () => {
    render(<SpellForm mode="create" classes={classes} />);

    expect(screen.getByLabelText("Name")).toBeRequired();
    expect(screen.getByLabelText("Casting time")).toBeRequired();
    expect(screen.getByLabelText("Spell description")).toBeRequired();
    expect(screen.getByLabelText("Wizard")).toBeVisible();
    expect(screen.getByText("Optional automation")).toBeVisible();
    expect(screen.getByRole("button", { name: "Create private spell" })).toBeVisible();
  });

  it("renders edit defaults and explains immutable versioning", () => {
    render(
      <SpellForm
        mode="edit"
        classes={classes}
        initialValue={{
          id: "11111111-1111-4111-8111-111111111111",
          name: "Ember Thread",
          version: 2,
          data: {
            level: 1,
            school: "evocation",
            casting_time: "1 action",
            range: "60 feet",
            components: ["V", "S"],
            duration: "Concentration, up to 1 minute",
            concentration: true,
            ritual: false,
            description: "A bright strand of fire lashes out.",
            attack_type: "ranged",
            damage: { type: "fire", dice_at_slot_level: { "1": "2d6" } },
            heal_at_slot_level: null,
            dc: null,
            area_of_effect: null,
            classes: ["wizard"],
            subclasses: [],
            dependencies: [],
          },
        }}
      />,
    );

    expect(screen.getByLabelText("Name")).toHaveValue("Ember Thread");
    expect(screen.getByLabelText("Wizard")).toBeChecked();
    expect(screen.getByText(/saving creates version 3/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Save new version" })).toBeVisible();
  });
});
