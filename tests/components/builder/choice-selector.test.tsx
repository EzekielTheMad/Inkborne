import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChoiceSelector } from "@/components/builder/choice-selector";
import type { ChoiceEffect } from "@/lib/types/effects";

const mockChoice: ChoiceEffect = {
  type: "choice",
  choose: 2,
  from: ["athletics", "acrobatics", "stealth", "perception"],
  grant_type: "skill_proficiency",
  choice_id: "fighter-skills",
};

describe("ChoiceSelector", () => {
  it("renders all options", () => {
    render(
      <ChoiceSelector
        choiceEffect={mockChoice}
        currentSelections={[]}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("athletics")).toBeTruthy();
    expect(screen.getByText("acrobatics")).toBeTruthy();
    expect(screen.getByText("stealth")).toBeTruthy();
    expect(screen.getByText("perception")).toBeTruthy();
  });

  it("shows selection count", () => {
    render(
      <ChoiceSelector
        choiceEffect={mockChoice}
        currentSelections={["athletics"]}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("1 / 2 selected")).toBeTruthy();
  });

  it("calls onSelect when an option is clicked", () => {
    const onSelect = vi.fn();
    render(
      <ChoiceSelector
        choiceEffect={mockChoice}
        currentSelections={[]}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByText("athletics"));
    expect(onSelect).toHaveBeenCalledWith(["athletics"]);
  });

  it("deselects when a selected option is clicked", () => {
    const onSelect = vi.fn();
    render(
      <ChoiceSelector
        choiceEffect={mockChoice}
        currentSelections={["athletics"]}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByText("athletics"));
    expect(onSelect).toHaveBeenCalledWith([]);
  });

  it("prevents selecting more than allowed", () => {
    const onSelect = vi.fn();
    render(
      <ChoiceSelector
        choiceEffect={mockChoice}
        currentSelections={["athletics", "acrobatics"]}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByText("stealth"));
    // Should not call onSelect since 2/2 are already selected
    expect(onSelect).not.toHaveBeenCalled();
  });
});
