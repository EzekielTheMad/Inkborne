import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
  RollToaster,
  ROLL_TOAST_DURATION_MS,
} from "@/components/sheet/rolls/roll-toaster";
import type { RollLogEntry } from "@/lib/types/rolls";

let mockRolls: RollLogEntry[] = [];

vi.mock("@/lib/character/character-context", () => ({
  useRolls: () => ({ rolls: mockRolls, roll: vi.fn() }),
}));

function mkEntry(overrides: Partial<RollLogEntry> = {}): RollLogEntry {
  const id = overrides.id ?? `roll-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    character_id: "char-1",
    user_id: "user-1",
    kind: "check",
    label: "Athletics Check",
    expression: "1d20+5",
    result: {
      request: {
        kind: "check",
        label: "Athletics Check",
        expression: "1d20+5",
      },
      groups: [{ sides: 20, rolls: [14, 8], kept: [14] }],
      modifier: 5,
      total: 19,
      natural: 14,
      rolled_at: "2026-07-16T10:00:00.000Z",
    },
    total: 19,
    rolled_at: "2026-07-16T10:00:00.000Z",
    ...overrides,
  };
}

describe("<RollToaster>", () => {
  beforeEach(() => {
    mockRolls = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not toast rolls that were already present at mount (hydrated history)", () => {
    mockRolls = [mkEntry({ id: "hydrated-1" })];
    render(<RollToaster />);
    expect(screen.queryByTestId("roll-toast")).not.toBeInTheDocument();
  });

  it("toasts a new roll with label, total, and dice breakdown", () => {
    const { rerender } = render(<RollToaster />);
    mockRolls = [mkEntry({ id: "fresh-1" })];
    rerender(<RollToaster />);

    const toast = screen.getByTestId("roll-toast");
    expect(toast).toHaveTextContent("Athletics Check");
    expect(toast).toHaveTextContent("19");
    // Breakdown: both faces plus the modifier.
    expect(toast).toHaveTextContent("d20:");
    expect(toast).toHaveTextContent("14");
    expect(toast).toHaveTextContent("8");
    expect(toast).toHaveTextContent("+5");
  });

  it("auto-dismisses after the toast duration", () => {
    const { rerender } = render(<RollToaster />);
    mockRolls = [mkEntry({ id: "fresh-1" })];
    rerender(<RollToaster />);
    expect(screen.getByTestId("roll-toast")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(ROLL_TOAST_DURATION_MS + 100);
    });
    expect(screen.queryByTestId("roll-toast")).not.toBeInTheDocument();
  });

  it("a pinned toast survives the auto-dismiss timer and dismisses via its close button", () => {
    const { rerender } = render(<RollToaster />);
    mockRolls = [mkEntry({ id: "fresh-1" })];
    rerender(<RollToaster />);

    // Pin by clicking the toast.
    act(() => {
      screen.getByTestId("roll-toast").click();
    });
    act(() => {
      vi.advanceTimersByTime(ROLL_TOAST_DURATION_MS * 3);
    });
    expect(screen.getByTestId("roll-toast")).toBeInTheDocument();

    act(() => {
      screen.getByRole("button", { name: "Dismiss roll" }).click();
    });
    expect(screen.queryByTestId("roll-toast")).not.toBeInTheDocument();
  });

  it("stacks multiple new rolls", () => {
    const { rerender } = render(<RollToaster />);
    mockRolls = [mkEntry({ id: "b", label: "Second" }), mkEntry({ id: "a", label: "First" })];
    rerender(<RollToaster />);
    expect(screen.getAllByTestId("roll-toast")).toHaveLength(2);
  });

  it("marks a natural 20 as a crit", () => {
    const { rerender } = render(<RollToaster />);
    const entry = mkEntry({ id: "crit-1" });
    entry.result = { ...entry.result, natural: 20 };
    mockRolls = [entry];
    rerender(<RollToaster />);
    expect(screen.getByTestId("roll-toast")).toHaveTextContent("Critical!");
  });

  it("marks a natural 1 as a fumble", () => {
    const { rerender } = render(<RollToaster />);
    const entry = mkEntry({ id: "fumble-1" });
    entry.result = { ...entry.result, natural: 1 };
    mockRolls = [entry];
    rerender(<RollToaster />);
    expect(screen.getByTestId("roll-toast")).toHaveTextContent("Fumble");
  });
});
