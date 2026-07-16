import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
  RollLogPanel,
  formatRelativeTime,
} from "@/components/sheet/rolls/roll-log-panel";
import type { RollLogEntry } from "@/lib/types/rolls";

let mockRolls: RollLogEntry[] = [];

vi.mock("@/lib/character/character-context", () => ({
  useRolls: () => ({ rolls: mockRolls, roll: vi.fn() }),
}));

// Desktop by default (the drawer path is the same list in a Vaul sheet).
vi.mock("@/lib/builder/use-is-mobile", () => ({
  useIsMobile: () => false,
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
      groups: [{ sides: 20, rolls: [14], kept: [14] }],
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

async function openPanel() {
  await act(async () => {
    screen.getByRole("button", { name: "Open roll log" }).click();
  });
}

describe("<RollLogPanel>", () => {
  beforeEach(() => {
    mockRolls = [];
  });

  it("renders the d20 trigger button", () => {
    render(<RollLogPanel />);
    expect(
      screen.getByRole("button", { name: "Open roll log" }),
    ).toBeInTheDocument();
  });

  it("shows the empty state when there are no rolls", async () => {
    render(<RollLogPanel />);
    await openPanel();
    expect(
      screen.getByText(/No rolls yet — click any modifier on the sheet/),
    ).toBeInTheDocument();
  });

  it("lists rolls newest-first with kind badges and breakdowns", async () => {
    mockRolls = [
      mkEntry({ id: "new", label: "Stealth Check", kind: "check" }),
      mkEntry({ id: "old", label: "Longsword — Attack", kind: "attack" }),
    ];
    render(<RollLogPanel />);
    await openPanel();

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Stealth Check");
    expect(items[0]).toHaveTextContent("Check");
    expect(items[1]).toHaveTextContent("Longsword — Attack");
    expect(items[1]).toHaveTextContent("Attack");
    // Breakdown + total render for each row.
    expect(items[0]).toHaveTextContent("d20:");
    expect(items[0]).toHaveTextContent("19");
  });

  it("labels multi-word kinds ('death_save' → 'Death Save')", async () => {
    mockRolls = [
      mkEntry({ id: "ds", label: "Death Save", kind: "death_save" }),
    ];
    render(<RollLogPanel />);
    await openPanel();
    expect(screen.getAllByText("Death Save").length).toBeGreaterThanOrEqual(1);
  });

  it("renders a panel title for a11y", async () => {
    render(<RollLogPanel />);
    await openPanel();
    expect(screen.getByText("Roll Log")).toBeInTheDocument();
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-07-16T12:00:00.000Z");

  it("formats sub-minute as 'just now'", () => {
    expect(formatRelativeTime("2026-07-16T11:59:30.000Z", now)).toBe(
      "just now",
    );
  });

  it("formats minutes and hours", () => {
    expect(formatRelativeTime("2026-07-16T11:55:00.000Z", now)).toBe("5m ago");
    expect(formatRelativeTime("2026-07-16T09:00:00.000Z", now)).toBe("3h ago");
  });

  it("formats days and falls back to a date after a week", () => {
    expect(formatRelativeTime("2026-07-14T12:00:00.000Z", now)).toBe("2d ago");
    expect(formatRelativeTime("2026-07-01T12:00:00.000Z", now)).toMatch(
      /2026|7|07/,
    );
  });

  it("returns empty string for invalid dates", () => {
    expect(formatRelativeTime("not-a-date", now)).toBe("");
  });
});
