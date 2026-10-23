import { describe, expect, it } from "vitest";
import { attachBuilderClassRoles, originalClassOccurrence } from "@/lib/character/builder-class-roles";
import { resolveCharacterChoiceEffects } from "@/lib/character/choice-effects";
import { computeMaxHp } from "@/lib/character/max-hp";
import type { Effect } from "@/lib/types/effects";

const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function fixture() {
  const source = (slug: string, n: number, effects: Effect[]) => ({ id: id(n), character_id: id(1), content_id: id(n + 10),
    content_version: 1, content_definitions: { id: id(n + 10), version: 1, content_type: "class", slug,
      data: { hit_die: slug === "fighter" ? 10 : 8 }, effects } });
  const fighter = source("fighter", 3, [{ type: "grant", stat: "save_strength", value: "proficient" },
    { type: "choice", choice_id: "fighter-skills", choose: 2, from: ["skill-athletics"], grant_type: "proficiency" }]);
  const cleric = source("cleric", 4, [{ type: "grant", stat: "save_wisdom", value: "proficient" },
    { type: "choice", choice_id: "cleric-skills", choose: 2, from: ["skill-medicine"], grant_type: "proficiency" }]);
  // Deliberately reverse the display array. Its position cannot establish role.
  const choices = { classes: [{ slug: "cleric", level: 1, occurrence_id: id(24) }, { slug: "fighter", level: 2, occurrence_id: id(23) }],
    resolved_choices: { "fighter-skills": ["skill-athletics"], "cleric-skills": ["skill-medicine"] } };
  const parent = { id: id(1), system_id: id(2), action_revision: "8", choices };
  const raw = { status: "available", contract_version: 1, character_id: id(1), system_id: id(2), action_revision: "8",
    original_occurrence_id: id(23), source_order: [fighter.id, cleric.id], class_sources: [
      { occurrence_id: id(23), controller_ref_id: fighter.id, content_id: fighter.content_id, content_version: 1, role: "original",
        raw_effects: fighter.content_definitions.effects, raw_data: fighter.content_definitions.data,
        evaluation_effects: fighter.content_definitions.effects, evaluation_data: fighter.content_definitions.data },
      { occurrence_id: id(24), controller_ref_id: cleric.id, content_id: cleric.content_id, content_version: 1, role: "secondary",
        raw_effects: cleric.content_definitions.effects, raw_data: cleric.content_definitions.data,
        evaluation_effects: [{ type: "grant", stat: "medium-armor", value: "proficient" }],
        evaluation_data: { ...cleric.content_definitions.data, starting_proficiencies: ["medium-armor"] } },
    ] };
  return { fighter, cleric, refs: [cleric, fighter], choices, parent, raw };
}

describe("native builder class role projection admission", () => {
  it("uses exact original identity despite array order, keeps raw snapshots, and suppresses secondary starting saves/skills", () => {
    const input = fixture(), before = JSON.stringify(input.refs);
    const result = attachBuilderClassRoles(input.refs, input.raw, input.parent);
    expect(result.classRoles.status).toBe("available");
    expect(result.refs.map(ref => ref.id)).toEqual(input.raw.source_order);
    const effects = resolveCharacterChoiceEffects(result.refs, input.choices);
    expect(effects).toContainEqual({ type: "grant", stat: "saving_throw_strength", value: "proficient" });
    expect(effects).toContainEqual({ type: "grant", stat: "athletics", value: "proficient" });
    expect(effects).toContainEqual({ type: "grant", stat: "medium-armor", value: "proficient" });
    expect(effects.some(effect => effect.type === "grant" && ["saving_throw_wisdom", "medicine", "save_wisdom"].includes(effect.stat))).toBe(false);
    const original = originalClassOccurrence(result.refs, input.choices);
    expect(original).toBe(id(23));
    expect(computeMaxHp(input.choices.classes, { fighter: input.fighter.content_definitions, cleric: input.cleric.content_definitions }, 14, {}, "free_choice", original)).toBe(27);
    expect(JSON.stringify(input.refs)).toBe(before);
  });
  it("refuses stale revisions, incomplete order, wrong immutable snapshot and missing occurrence identity", () => {
    const input = fixture();
    for (const raw of [{ ...input.raw, action_revision: "9" }, { ...input.raw, source_order: [id(3)] },
      { ...input.raw, class_sources: input.raw.class_sources.map((source, i) => i ? { ...source, raw_effects: [] } : source) },
      { ...input.raw, class_sources: input.raw.class_sources.map((source, i) => i ? { ...source, occurrence_id: id(99) } : source) }]) {
      expect(attachBuilderClassRoles(input.refs, raw, input.parent).classRoles.status).toBe("unavailable");
    }
  });
  it("does not grant either full starting class profile when multiclass evidence is unavailable", () => {
    const input = fixture();
    const effects = resolveCharacterChoiceEffects(input.refs, input.choices);
    expect(effects.filter(effect => effect.type === "grant")).toEqual([]);
    expect(originalClassOccurrence(input.refs, input.choices)).toBeUndefined();
  });
});
