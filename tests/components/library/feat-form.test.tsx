import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { featDataSchema } from "@/lib/schemas/content-types/feat";

vi.mock("@/app/(app)/homebrew/feats/actions", () => ({
  createHomebrewFeat: vi.fn(),
  updateHomebrewFeat: vi.fn(),
}));

import { FeatForm } from "@/components/library/feat-form";

describe("FeatForm", () => {
  it("renders accessible create fields without envelope or raw effect controls", () => {
    render(<FeatForm mode="create" />);

    expect(screen.getByLabelText("Name")).toBeRequired();
    expect(screen.getByLabelText("Feat description")).toBeRequired();
    expect(screen.getByLabelText("Ability")).toBeVisible();
    expect(screen.getByLabelText("Dexterity (DEX)")).toHaveValue(0);
    expect(screen.getByLabelText("Flat AC bonus")).toHaveValue(0);
    expect(screen.getByRole("button", { name: "Create private feat" })).toBeVisible();
    expect(screen.queryByLabelText(/effects|owner|scope|system/i)).not.toBeInTheDocument();
  });

  it("renders edit defaults and explains immutable versioning", () => {
    render(
      <FeatForm
        mode="edit"
        initialValue={{
          id: "11111111-1111-4111-8111-111111111111",
          name: "Ward-Bound Duelist",
          version: 2,
          data: featDataSchema.parse({
            description: "Your practiced stance turns aside small blows.",
            prerequisites: [{ stat: "dexterity", op: "gte", value: 13 }],
            scores: [0, 1, 0, 0, 0, 0],
            action: "reaction",
            usages: 2,
            recovery: "short rest",
            extraAC: 1,
          }),
        }}
      />,
    );

    expect(screen.getByLabelText("Name")).toHaveValue("Ward-Bound Duelist");
    expect(screen.getByLabelText("Ability")).toHaveValue("dexterity");
    expect(screen.getByLabelText("Minimum score")).toHaveValue(13);
    expect(screen.getByLabelText("Dexterity (DEX)")).toHaveValue(1);
    expect(screen.getByText(/changes create a new immutable version/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Save new version" })).toBeVisible();
  });

  it("retains authored values when React resets the form after validation", () => {
    const view = render(<FeatForm mode="create" />);
    const name = screen.getByLabelText("Name");
    const description = screen.getByLabelText("Feat description");
    const prerequisite = screen.getByLabelText("Ability");
    const dexterity = screen.getByLabelText("Dexterity (DEX)");
    const action = screen.getByLabelText("Action economy");

    fireEvent.change(name, { target: { value: "Ember Sentinel" } });
    fireEvent.change(description, { target: { value: "A watchful ember marks you." } });
    fireEvent.change(prerequisite, { target: { value: "dexterity" } });
    fireEvent.change(dexterity, { target: { value: "1" } });
    fireEvent.change(action, { target: { value: "reaction" } });

    const form = screen.getByRole("button", { name: "Create private feat" }).closest("form");
    expect(form).not.toBeNull();
    fireEvent.reset(form!);
    view.rerender(<FeatForm mode="create" />);

    expect(name).toHaveValue("Ember Sentinel");
    expect(description).toHaveValue("A watchful ember marks you.");
    expect(prerequisite).toHaveValue("dexterity");
    expect(dexterity).toHaveValue(1);
    expect(action).toHaveValue("reaction");
  });
});
