import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { magicItemDataSchema } from "@/lib/schemas/content-types/magic-item";

vi.mock("@/app/(app)/homebrew/magic-items/actions", () => ({
  createHomebrewMagicItem: vi.fn(),
  updateHomebrewMagicItem: vi.fn(),
}));

import { MagicItemForm } from "@/components/library/magic-item-form";

describe("MagicItemForm", () => {
  it("renders accessible finite fields without envelope or raw effect controls", () => {
    render(<MagicItemForm mode="create" />);

    expect(screen.getByLabelText("Name")).toBeRequired();
    expect(screen.getByLabelText("Rarity")).toHaveValue("Common");
    expect(screen.getByLabelText("Magic item description")).toBeRequired();
    expect(screen.getByLabelText("Equipment category")).toHaveValue("");
    expect(screen.getByLabelText("Requires attunement")).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: "Create private magic item" }),
    ).toBeVisible();
    expect(screen.queryByLabelText(/effects|owner|scope|system/i)).not.toBeInTheDocument();
  });

  it("renders edit defaults and immutable-version guidance", () => {
    render(
      <MagicItemForm
        mode="edit"
        initialValue={{
          id: "11111111-1111-4111-8111-111111111111",
          name: "Oathbound Compass",
          version: 2,
          data: magicItemDataSchema.parse({
            rarity: "Rare",
            description: "It points toward your last promise.",
            equipment_category: "Wondrous item",
            requires_attunement: true,
          }),
        }}
      />,
    );

    expect(screen.getByLabelText("Name")).toHaveValue("Oathbound Compass");
    expect(screen.getByLabelText("Rarity")).toHaveValue("Rare");
    expect(screen.getByLabelText("Equipment category")).toHaveValue("Wondrous item");
    expect(screen.getByLabelText("Requires attunement")).toBeChecked();
    expect(screen.getByText(/changes create a new immutable version/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Save new version" })).toBeVisible();
  });

  it("retains authored values when React resets after validation", () => {
    const view = render(<MagicItemForm mode="create" />);
    const name = screen.getByLabelText("Name");
    const rarity = screen.getByLabelText("Rarity");
    const description = screen.getByLabelText("Magic item description");
    const category = screen.getByLabelText("Equipment category");
    const attunement = screen.getByLabelText("Requires attunement");

    fireEvent.change(name, { target: { value: "Lantern of Returning" } });
    fireEvent.change(rarity, { target: { value: "Very Rare" } });
    fireEvent.change(description, { target: { value: "It remembers every road home." } });
    fireEvent.change(category, { target: { value: "Wondrous item" } });
    fireEvent.click(attunement);

    const form = screen
      .getByRole("button", { name: "Create private magic item" })
      .closest("form");
    expect(form).not.toBeNull();
    fireEvent.reset(form!);
    view.rerender(<MagicItemForm mode="create" />);

    expect(name).toHaveValue("Lantern of Returning");
    expect(rarity).toHaveValue("Very Rare");
    expect(description).toHaveValue("It remembers every road home.");
    expect(category).toHaveValue("Wondrous item");
    expect(attunement).toBeChecked();
  });
});
