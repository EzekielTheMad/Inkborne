import { describe, expect, it } from "vitest";
import { invocationCapacity, resolveClassFeatureChoice } from "@/lib/builder/class-feature-choices";
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

describe("Warlock invocation eligibility", () => {
  const invocation: ChoiceEffect = { type: "choice", choice_id: "eldritch-invocations", choose: 2, grant_type: "invocation",
    from: ["ordinary", "spell-required", "pact-required", "level-required"] };
  const pact: ChoiceEffect = { type: "choice", choice_id: "pact-boon", choose: 1, grant_type: "feature", from: ["pact-of-the-blade", "pact-of-the-chain"] };
  const features = [
    { slug: "ordinary", data: { class: "warlock", selection_prerequisites: [{ kind: "class_level", minimum: 2 }] } },
    { slug: "spell-required", data: { class: "warlock", selection_prerequisites: [{ kind: "class_level", minimum: 2 }, { kind: "spell", slug: "eldritch-blast" }] } },
    { slug: "pact-required", data: { class: "warlock", selection_prerequisites: [{ kind: "class_level", minimum: 2 }, { kind: "feature", slug: "pact-of-the-blade" }] } },
    { slug: "level-required", data: { class: "warlock", selection_prerequisites: [{ kind: "class_level", minimum: 9 }] } },
  ];
  const classRef = { content_definitions: { slug: "warlock", content_type: "class", data: { levels: [
    { level: 3, class_specific: { invocations_known: 2 } }, { level: 5, class_specific: { invocations_known: 3 } },
  ] } } };
  const active = [...refs(invocation, pact), classRef];
  it("uses the exact pinned class table, not a character-level guess", () => {
    const choices = { classes: [{ slug: "fighter", level: 8 }, { slug: "warlock", level: 5 }] };
    expect(invocationCapacity(active, choices)).toBe(3);
    expect(resolveClassFeatureChoice(invocation, active, choices, { features, knownSpellSlugs: new Set() })).toMatchObject({ choose: 3, from: ["ordinary"] });
    expect(invocationCapacity([...active, classRef], choices)).toBeUndefined();
  });
  it("requires a valid owned pact and exact saved knowledge for conditional options", () => {
    const choices = { classes: [{ slug: "warlock", level: 3 }], resolved_choices: { "pact-boon": ["pact-of-the-blade"] } };
    expect(resolveClassFeatureChoice(invocation, active, choices, { features, knownSpellSlugs: new Set(["eldritch-blast"]) }).from)
      .toEqual(["ordinary", "spell-required", "pact-required"]);
    expect(resolveClassFeatureChoice(invocation, [...refs(invocation), classRef], choices, { features, knownSpellSlugs: new Set() }).from).toEqual(["ordinary"]);
    expect(resolveClassFeatureChoice(invocation, [...active, ...refs(invocation)], choices, { features }).from).toEqual([]);
  });
});
