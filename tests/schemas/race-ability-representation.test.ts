import { describe, expect, it, vi } from "vitest";
import { raceDataSchema } from "@/lib/schemas/content-types/race";
import { parseContentDefinition, parseContentVersionSnapshot } from "@/lib/supabase/content-definitions-parser";
import { syntheticRacePin } from "../fixtures/r06-race-parity";

describe("parsed optional race ability representation", () => {
  it("does not invent a declaration on legacy data", () => {
    const legacy = raceDataSchema.parse({ size: "Medium", speed: 30, scores: [2, 0, 0, 0, 0, 0] });
    expect(legacy).not.toHaveProperty("ability_score_representation");
  });
  it("scores mode requires six slots and permits an actual all-zero array", () => {
    const data = { size: "Medium", speed: 30, ability_score_representation: { version: 1, mode: "scores" } };
    expect(raceDataSchema.safeParse(data).success).toBe(false);
    expect(raceDataSchema.safeParse({ ...data, scores: [0, 0, 0, 0, 0, 0] }).success).toBe(true);
    for (const scores of [[2], [2, 0, 0, 0, 0, 0, 0], [1.5, 0, 0, 0, 0, 0], null]) {
      expect(raceDataSchema.safeParse({ ...data, scores }).success).toBe(false);
    }
  });
  it("effects mode preserves valid optional scores as metadata through both canonical parsers", () => {
    const { definition, pin } = syntheticRacePin("declared-effects");
    expect(definition.data.ability_score_representation).toEqual({ version: 1, mode: "effects" });
    expect(pin.data.ability_score_representation).toEqual(definition.data.ability_score_representation);
    expect(pin.data.scores).toEqual([2, 0, 2, 0, 0, 0]);
    expect(syntheticRacePin("imported").pin.data.scores).toBeUndefined();
  });
  it.each([null, {}, { version: 2, mode: "effects" }, { version: 1, mode: "unknown" },
    { version: 1, mode: "effects", extra: true }, { version: "1", mode: "scores" }])("invalid declaration fails closed (%j)", declaration => {
    const { raw, snapshot } = syntheticRacePin();
    const data = { ...raw.data, ability_score_representation: declaration };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(raceDataSchema.safeParse(data).success).toBe(false);
      expect(parseContentDefinition({ ...raw, data })).toBeNull();
      expect(parseContentVersionSnapshot({ ...snapshot, data_snapshot: data })).toBeNull();
    } finally { log.mockRestore(); }
  });
});
