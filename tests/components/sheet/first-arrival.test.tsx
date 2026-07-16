import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { FirstArrival, markFirstArrival } from "@/components/sheet/first-arrival";

const CHARACTER_ID = "char-123";
const STORAGE_KEY = `inkborne:first-arrival:${CHARACTER_ID}`;

function renderArrival(overrides?: Partial<React.ComponentProps<typeof FirstArrival>>) {
  const onSeen = vi.fn();
  const utils = render(
    <FirstArrival
      characterId={CHARACTER_ID}
      characterName="Thalindra Moonweave"
      seenBefore={false}
      onSeen={onSeen}
      {...overrides}
    />,
  );
  return { onSeen, ...utils };
}

describe("<FirstArrival>", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("renders nothing when the builder didn't mark an arrival", () => {
    const { onSeen } = renderArrival();
    expect(screen.queryByTestId("first-arrival")).not.toBeInTheDocument();
    expect(onSeen).not.toHaveBeenCalled();
  });

  it("plays the moment when marked, consumes the flag, and persists seen", () => {
    markFirstArrival(CHARACTER_ID);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe("1");

    const { onSeen } = renderArrival();

    expect(screen.getByTestId("first-arrival")).toBeInTheDocument();
    expect(screen.getByText("Thalindra Moonweave")).toBeInTheDocument();
    expect(screen.getByText("Your character is ready")).toBeInTheDocument();
    // Flag is consumed so a reload won't replay it.
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    // Persisted so re-running the builder won't replay it either.
    expect(onSeen).toHaveBeenCalledTimes(1);
  });

  it("never plays for a character that has already seen it", () => {
    markFirstArrival(CHARACTER_ID);
    const { onSeen } = renderArrival({ seenBefore: true });
    expect(screen.queryByTestId("first-arrival")).not.toBeInTheDocument();
    expect(onSeen).not.toHaveBeenCalled();
  });

  it("only responds to its own character's marker", () => {
    markFirstArrival("someone-else");
    const { onSeen } = renderArrival();
    expect(screen.queryByTestId("first-arrival")).not.toBeInTheDocument();
    expect(onSeen).not.toHaveBeenCalled();
  });
});
