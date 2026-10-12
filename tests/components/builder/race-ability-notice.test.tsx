import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RaceAbilityNotice } from "@/components/builder/race-ability-notice";
import { syntheticRacePin, pinnedRaceRef } from "../../fixtures/r06-race-parity";

describe("legacy race ambiguity notice shared by builder and sheet", () => {
  it("shows retained historical semantics without claiming duplicate intent or changing the version", () => {
    const { pin } = syntheticRacePin();
    const before = JSON.stringify(pin);
    render(<RaceAbilityNotice contentRefs={[pinnedRaceRef(pin)]} />);
    expect(screen.getByRole("status")).toHaveTextContent("Both are retained, so totals may include overlapping bonuses");
    expect(screen.getByRole("status")).toHaveTextContent("Its saved version is unchanged");
    expect(JSON.stringify(pin)).toBe(before);
  });
  it.each(["scores-only", "effects-only", "imported", "declared-scores", "declared-effects"] as const)("does not warn on unambiguous or explicit %s mode", mode => {
    render(<RaceAbilityNotice contentRefs={[pinnedRaceRef(syntheticRacePin(mode).pin)]} />);
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("only considers the first race, matching the live structured collector", () => {
    render(<RaceAbilityNotice contentRefs={[pinnedRaceRef(syntheticRacePin("imported").pin), pinnedRaceRef(syntheticRacePin().pin)]} />);
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("does not infer away a conditional or formula ambiguity", () => {
    const { pin } = syntheticRacePin("scores-only", [{ type: "mechanical", stat: "strength", op: "formula", expr: "strength + 2",
      condition: { field: "rage_active", op: "eq", value: true } }]);
    render(<RaceAbilityNotice contentRefs={[pinnedRaceRef(pin)]} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
