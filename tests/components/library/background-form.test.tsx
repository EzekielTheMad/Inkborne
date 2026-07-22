import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { backgroundDataSchema } from "@/lib/schemas/content-types/background";

vi.mock("@/app/(app)/library/backgrounds/actions", () => ({
  createHomebrewBackground: vi.fn(),
  updateHomebrewBackground: vi.fn(),
}));

import { BackgroundForm } from "@/components/library/background-form";

describe("BackgroundForm", () => {
  it("renders finite accessible controls without raw envelopes or effects", () => {
    render(<BackgroundForm mode="create" />);

    expect(screen.getByLabelText("Name")).toBeRequired();
    expect(screen.getByLabelText("Feature name")).toBeRequired();
    expect(screen.getByLabelText("Feature description")).toBeRequired();
    expect(screen.getByLabelText("Survival")).toBeVisible();
    expect(screen.getByLabelText("Choose any languages")).toBeVisible();
    expect(screen.getByRole("button", { name: "Create private background" })).toBeVisible();
    expect(screen.queryByLabelText(/effects|owner|scope|system/i)).not.toBeInTheDocument();
  });

  it("renders canonical edit defaults and immutable-version guidance", () => {
    render(
      <BackgroundForm
        mode="edit"
        initialValue={{
          id: "11111111-1111-4111-8111-111111111111",
          name: "Lantern Courier",
          version: 2,
          data: backgroundDataSchema.parse({
            feature: { name: "Known Roads", description: "You remember hidden crossings." },
            personality_traits: ["I always carry a spare light."],
            ideals: [{ text: "No road is truly lost.", alignment: "Good" }],
            bonds: ["My old route still matters."],
            flaws: ["I trust maps too much."],
            skills: ["survival", "perception"],
            gold: 12,
            languageProfs: ["elvish", { choose: 1, from: "any" }],
            toolProfs: ["cartographers-tools"],
            equipment: "A hooded lantern and a road map.",
            variant: null,
            source_refs: [],
          }),
        }}
      />,
    );

    expect(screen.getByLabelText("Name")).toHaveValue("Lantern Courier");
    expect(screen.getByLabelText("Survival")).toBeChecked();
    expect(screen.getByLabelText("Fixed languages")).toHaveValue("elvish");
    expect(screen.getByLabelText("Choose any languages")).toHaveValue(1);
    expect(screen.getByLabelText("Ideals")).toHaveValue("No road is truly lost. | Good");
    expect(screen.getByText(/changes create a new immutable version/i)).toBeVisible();
  });

  it("retains authored values when React resets after validation", () => {
    const view = render(<BackgroundForm mode="create" />);
    const name = screen.getByLabelText("Name");
    const feature = screen.getByLabelText("Feature name");
    const survival = screen.getByLabelText("Survival");

    fireEvent.change(name, { target: { value: "Road Warden" } });
    fireEvent.change(feature, { target: { value: "Trail Memory" } });
    fireEvent.click(survival);

    const form = screen.getByRole("button", { name: "Create private background" }).closest("form");
    expect(form).not.toBeNull();
    fireEvent.reset(form!);
    view.rerender(<BackgroundForm mode="create" />);

    expect(name).toHaveValue("Road Warden");
    expect(feature).toHaveValue("Trail Memory");
    expect(survival).toBeChecked();
  });
});
