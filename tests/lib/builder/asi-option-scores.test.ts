import { describe, expect, it } from "vitest";
import { asiOptionScores } from "@/lib/builder/asi-option-scores";
import { originalAsiFixture, originalAsiPin, asiId, asiSchema } from "../../fixtures/r06-asi";

describe("ASI dropdown score baseline", () => {
  it("removes only the current earned ASI without changing saved sources", () => {
    const f = originalAsiFixture({ mode: "asi", allocations: [{ ability: "strength", amount: 2 }] });
    const before = JSON.stringify(f);
    const result = asiOptionScores(f.character, f.evidence, asiSchema);
    expect(result[f.feature.slug].strength).toBe(12);
    expect(JSON.stringify(f)).toBe(before);
  });
  it("removes the exact old feat effects when switching to an ability increase", () => {
    const feat = originalAsiPin("feat", "old-feat", { description: "Old feat." }, asiId(80), [{ type: "mechanical", stat: "wisdom", op: "add", value: 2 }]);
    const f = originalAsiFixture({ mode: "feat", featId: feat.id, featVersion: feat.version, featName: feat.name });
    f.refs.push(f.ref(feat, asiId(81), null, `choice:asi:${f.grant.id}`));
    const result = asiOptionScores(f.character, f.evidence, asiSchema);
    expect(result[f.feature.slug].wisdom).toBe(10);
    expect(f.refs.at(-1)?.content_id).toBe(feat.id);
  });
  it("offers no scores from missing, foreign or unearned evidence", () => {
    const f = originalAsiFixture();
    expect(asiOptionScores(f.character, undefined, asiSchema)).toEqual({});
    f.evidence.character_id = asiId(99);
    expect(asiOptionScores(f.character, f.evidence, asiSchema)).toEqual({});
  });
});
