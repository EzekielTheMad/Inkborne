import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RollBreakdown } from "@/components/sheet/rolls/roll-breakdown";
import type { RollResult } from "@/lib/dice/types";

function mkResult(overrides: Partial<RollResult> = {}): RollResult {
  return {
    request: { kind: "check", label: "Athletics Check", expression: "1d20+5" },
    groups: [{ sides: 20, rolls: [14], kept: [14] }],
    modifier: 5,
    total: 19,
    natural: 14,
    rolled_at: "2026-07-16T12:00:00.000Z",
    ...overrides,
  };
}

describe("<RollBreakdown> — roll-modifier attribution", () => {
  it("names trailing rider groups from meta.roll_modifiers", () => {
    const result = mkResult({
      request: {
        kind: "attack",
        label: "Mace — Attack",
        expression: "1d20+5+1d4",
        meta: { roll_modifiers: [{ name: "Bless", dice: "1d4" }] },
      },
      groups: [
        { sides: 20, rolls: [14], kept: [14] },
        { sides: 4, rolls: [3], kept: [3] },
      ],
      total: 22,
    });
    render(<RollBreakdown result={result} />);
    expect(screen.getByText("(Bless)")).toBeInTheDocument();
    expect(screen.getByText("d4:")).toBeInTheDocument();
    expect(screen.getByText("+5")).toBeInTheDocument();
  });

  it("does not annotate the base d20 group", () => {
    const result = mkResult({
      request: {
        kind: "save",
        label: "WIS Save",
        expression: "1d20+2-1d4",
        meta: { roll_modifiers: [{ name: "Bane", dice: "-1d4" }] },
      },
      groups: [
        { sides: 20, rolls: [11], kept: [11] },
        { sides: 4, rolls: [2], kept: [2] },
      ],
    });
    const { container } = render(<RollBreakdown result={result} />);
    const spans = container.querySelectorAll("[data-slot='roll-breakdown'] > span");
    expect(spans[0].textContent).not.toContain("(Bane)");
    expect(spans[1].textContent).toContain("(Bane)");
  });

  it("renders no annotation without meta.roll_modifiers", () => {
    const { container } = render(<RollBreakdown result={mkResult()} />);
    expect(container.textContent).not.toContain("(");
  });
});
