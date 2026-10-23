import { describe, expect, it } from "vitest";
import { resolveClassFeatureChoice } from "@/lib/builder/class-feature-choices";
import type { ChoiceEffect } from "@/lib/types/effects";

const choice = (choice_id: string, grant_type = "feature", choose = 1): ChoiceEffect => ({ type: "choice", choice_id,
  grant_type, choose, from: ["first", "second", "third"] });
const refs = (...effects: ChoiceEffect[]) => effects.map(effect => ({ content_definitions: { effects: [effect] } }));

describe("source-owned additional class feature picks", () => {
  it.each(["feature", "favored_terrain"])("excludes %s already earned by another active source", grant_type => {
    const first = choice("tier-1", grant_type), second = choice("tier-2", grant_type);
    expect(resolveClassFeatureChoice(second, refs(first, second), { resolved_choices: { "tier-1": ["first"] } }).from).toEqual(["second", "third"]);
    expect(resolveClassFeatureChoice(first, refs(first, second), { resolved_choices: { "tier-1": ["first"] } }).from).toEqual(first.from);
  });
  it("does not reserve values from stale, over-budget or ambiguous definitions", () => {
    const first = choice("tier-1"), second = choice("tier-2");
    for (const selections of [["unknown"], ["first", "second"], ["first", "first"]]) {
      expect(resolveClassFeatureChoice(second, refs(first, second), { resolved_choices: { "tier-1": selections } }).from).toEqual(second.from);
    }
    expect(resolveClassFeatureChoice(second, refs(first, first, second), { resolved_choices: { "tier-1": ["first"] } }).from).toEqual(second.from);
    expect(resolveClassFeatureChoice(second, refs(first, second, second), {}).from).toEqual([]);
  });
  it("does not mix terrain claims with feature claims or trust a removed source", () => {
    const first = choice("tier-1", "favored_terrain"), second = choice("tier-2");
    expect(resolveClassFeatureChoice(second, refs(first, second), { resolved_choices: { "tier-1": ["first"] } }).from).toEqual(second.from);
    expect(resolveClassFeatureChoice(second, refs(second), { resolved_choices: { "removed": ["first"] } }).from).toEqual(second.from);
  });
});
