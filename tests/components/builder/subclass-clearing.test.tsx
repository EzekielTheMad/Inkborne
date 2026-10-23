import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChoiceCardSubclass } from "@/components/builder/class-step-rail/choice-card-subclass";
import type { ContentEntry } from "@/components/builder/content-browser";

const fiend: ContentEntry = { id: "fiend", slug: "fiend", name: "Fiend", content_type: "subclass", version: 1,
  source: "srd", effects: [], data: { parent_class: "warlock" } };

describe("Subclass clearing", () => {
  it("uses an explicit clear action while clicking the selected card remains idempotent", () => {
    const onSelect = vi.fn();
    render(<ChoiceCardSubclass classSlug="warlock" subclasses={[fiend]} currentSelection="fiend" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Fiend", exact: true }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText("Clearing this choice also removes its subclass features and spell choices.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear subclass", exact: true }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it("offers selection without a clear action when there is no selected subclass", () => {
    const onSelect = vi.fn();
    render(<ChoiceCardSubclass classSlug="warlock" subclasses={[fiend]} currentSelection={undefined} onSelect={onSelect} />);
    expect(screen.queryByRole("button", { name: "Clear subclass" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fiend", exact: true }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("fiend");
  });
});
