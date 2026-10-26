import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ChoiceSelector } from "@/components/builder/choice-selector";
import type { ChoiceEffect } from "@/lib/types/effects";

const choice: ChoiceEffect = { type: "choice", choose: 2, from: ["athletics", "acrobatics", "stealth"], grant_type: "proficiency", choice_id: "skills" };

describe("builder choice dropdowns", () => {
  it("renders one labeled dropdown per pick and no option buttons", () => {
    render(<ChoiceSelector choiceEffect={choice} currentSelections={[]} onSelect={vi.fn()} />);
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
    expect(screen.getByLabelText("Choose 2 proficiency 1")).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Athletics" })).not.toBeInTheDocument();
    expect(within(screen.getAllByRole("combobox")[0]).getByRole("option", { name: "Athletics" })).toBeInTheDocument();
  });
  it("selects, replaces and clears through the same bounded saved payload", () => {
    const save = vi.fn();
    render(<ChoiceSelector choiceEffect={choice} currentSelections={["athletics"]} onSelect={save} />);
    fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: "stealth" } });
    expect(save).toHaveBeenLastCalledWith(["athletics", "stealth"]);
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "acrobatics" } });
    expect(save).toHaveBeenLastCalledWith(["acrobatics"]);
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "" } });
    expect(save).toHaveBeenLastCalledWith([]);
  });
  it("omits picks already used in another slot and keeps replacements available at the limit", () => {
    render(<ChoiceSelector choiceEffect={choice} currentSelections={["athletics", "stealth"]} onSelect={vi.fn()} />);
    const [first, second] = screen.getAllByRole("combobox");
    expect(within(second).queryByRole("option", { name: "Athletics" })).not.toBeInTheDocument();
    expect(within(first).queryByRole("option", { name: "Stealth" })).not.toBeInTheDocument();
    expect(within(first).getByRole("option", { name: "Acrobatics" })).toBeInTheDocument();
    expect(screen.getByText("2 / 2 selected")).toBeInTheDocument();
  });
  it("retains unavailable saved picks until an explicit clear", () => {
    const save = vi.fn();
    render(<ChoiceSelector choiceEffect={choice} currentSelections={["unavailable"]} onSelect={save} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Saved selections do not match");
    expect(screen.getByText("Saved selections: unavailable.")).toBeInTheDocument();
    expect(screen.getAllByRole("combobox").every(item => (item as HTMLSelectElement).disabled)).toBe(true);
    expect(screen.queryByRole("option", { name: "Unavailable" })).not.toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Clear saved selections" }));
    expect(save).toHaveBeenCalledWith([]);
  });
  it("never guesses an unresolved category vocabulary", () => {
    render(<ChoiceSelector choiceEffect={{ ...choice, from: "all_languages", grant_type: "language" }} currentSelections={["elvish"]} onSelect={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Options for this choice are unavailable");
    expect(screen.getByText("Saved selections: elvish.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear saved selections" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("combobox").every(item => (item as HTMLSelectElement).disabled)).toBe(true);
  });
});
