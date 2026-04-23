import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Conditions } from "@/components/sheet/conditions";

function setup(
  overrides: Partial<{
    conditions: string[];
    exhaustion: number;
  }> = {},
) {
  const patchState = vi.fn();
  const props = {
    conditions: overrides.conditions ?? [],
    exhaustion: overrides.exhaustion ?? 0,
    patchState,
  };
  render(<Conditions {...props} />);
  return { patchState };
}

describe("Conditions widget (redesigned)", () => {
  it("renders empty state with Add Condition button when nothing applied", () => {
    setup();
    expect(screen.getByText(/no active conditions/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add condition/i })).toBeInTheDocument();
  });

  it("renders a pill for each applied boolean condition", () => {
    setup({ conditions: ["Poisoned", "Prone"] });
    expect(screen.getByText("Poisoned")).toBeInTheDocument();
    expect(screen.getByText("Prone")).toBeInTheDocument();
    expect(screen.queryByText(/no active conditions/i)).not.toBeInTheDocument();
  });

  it("removes a condition when its × is clicked", () => {
    const { patchState } = setup({ conditions: ["Poisoned", "Prone"] });
    fireEvent.click(screen.getByRole("button", { name: /remove poisoned/i }));
    expect(patchState).toHaveBeenCalledWith({ conditions: ["Prone"] });
  });

  it("opens popover when Add Condition is clicked", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /add condition/i }));
    expect(screen.getByText("Blinded")).toBeInTheDocument();
    expect(screen.getByText("Exhaustion")).toBeInTheDocument();
  });

  it("popover hides conditions that are already applied", () => {
    setup({ conditions: ["Blinded"] });
    fireEvent.click(screen.getByRole("button", { name: /add condition/i }));
    const blindedElements = screen.getAllByText("Blinded");
    expect(blindedElements).toHaveLength(1);
  });

  it("clicking Exhaustion in popover sets level = 1", () => {
    const { patchState } = setup();
    fireEvent.click(screen.getByRole("button", { name: /add condition/i }));
    fireEvent.click(screen.getByRole("button", { name: /^exhaustion$/i }));
    expect(patchState).toHaveBeenCalledWith({ exhaustion: 1 });
  });

  it("exhaustion pill shows level/6 with stepper buttons", () => {
    setup({ exhaustion: 2 });
    expect(screen.getByText(/2\/6/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /increase exhaustion/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /decrease exhaustion/i })).toBeInTheDocument();
  });

  it("[+] increments exhaustion by 1, clamped at 6", () => {
    const { patchState } = setup({ exhaustion: 5 });
    fireEvent.click(screen.getByRole("button", { name: /increase exhaustion/i }));
    expect(patchState).toHaveBeenCalledWith({ exhaustion: 6 });
  });

  it("[−] at level > 1 decrements exhaustion", () => {
    const { patchState } = setup({ exhaustion: 3 });
    fireEvent.click(screen.getByRole("button", { name: /decrease exhaustion/i }));
    expect(patchState).toHaveBeenCalledWith({ exhaustion: 2 });
  });

  it("[−] at level 1 removes exhaustion (sets to 0)", () => {
    const { patchState } = setup({ exhaustion: 1 });
    fireEvent.click(screen.getByRole("button", { name: /decrease exhaustion/i }));
    expect(patchState).toHaveBeenCalledWith({ exhaustion: 0 });
  });

  it("exhaustion pill applies warning styling at level >= 5", () => {
    const { container } = render(
      <Conditions conditions={[]} exhaustion={5} patchState={vi.fn()} />,
    );
    const hasWarning = container.innerHTML.match(/destructive|warning|amber/i);
    expect(hasWarning).toBeTruthy();
  });
});
