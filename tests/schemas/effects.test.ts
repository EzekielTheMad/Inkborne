import { describe, it, expect } from "vitest";
import {
  mechanicalEffectSchema,
  narrativeEffectSchema,
  grantEffectSchema,
  effectSchema,
  statConditionSchema,
  progressionTierSchema,
} from "@/lib/schemas/effects";

describe("Effect Schemas", () => {
  describe("mechanicalEffectSchema", () => {
    it("validates a static add effect", () => {
      const result = mechanicalEffectSchema.safeParse({
        type: "mechanical",
        stat: "dexterity",
        op: "add",
        value: 2,
      });
      expect(result.success).toBe(true);
    });

    it("validates a formula effect", () => {
      const result = mechanicalEffectSchema.safeParse({
        type: "mechanical",
        stat: "armor_class",
        op: "formula",
        expr: "10 + mod(dexterity)",
      });
      expect(result.success).toBe(true);
    });

    it("rejects effect with missing stat", () => {
      const result = mechanicalEffectSchema.safeParse({
        type: "mechanical",
        op: "add",
        value: 2,
      });
      expect(result.success).toBe(false);
    });

    it("rejects formula effect without expr", () => {
      const result = mechanicalEffectSchema.safeParse({
        type: "mechanical",
        stat: "armor_class",
        op: "formula",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("narrativeEffectSchema", () => {
    it("validates a narrative effect", () => {
      const result = narrativeEffectSchema.safeParse({
        type: "narrative",
        text: "50% discount at org HQ",
        tag: "Organization Perk",
      });
      expect(result.success).toBe(true);
    });

    it("validates without optional tag", () => {
      const result = narrativeEffectSchema.safeParse({
        type: "narrative",
        text: "Can sleep in a crow's nest",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("grantEffectSchema", () => {
    it("validates a grant effect", () => {
      const result = grantEffectSchema.safeParse({
        type: "grant",
        stat: "perception",
        value: "proficient",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("effectSchema (union)", () => {
    it("discriminates mechanical effects", () => {
      const result = effectSchema.safeParse({
        type: "mechanical",
        stat: "strength",
        op: "add",
        value: 1,
      });
      expect(result.success).toBe(true);
    });

    it("discriminates narrative effects", () => {
      const result = effectSchema.safeParse({
        type: "narrative",
        text: "Access to safehouses",
      });
      expect(result.success).toBe(true);
    });

    it("rejects unknown type", () => {
      const result = effectSchema.safeParse({
        type: "unknown",
        stat: "strength",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("statConditionSchema", () => {
    it("validates a condition", () => {
      const result = statConditionSchema.safeParse({
        stat: "level",
        op: "gte",
        value: 4,
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid op", () => {
      const result = statConditionSchema.safeParse({
        stat: "level",
        op: "between",
        value: 4,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("progressionTierSchema", () => {
    it("validates an auto trigger tier", () => {
      const result = progressionTierSchema.safeParse({
        name: "Expert Rigger",
        description: "Years of climbing...",
        trigger: {
          type: "auto",
          conditions: [{ stat: "level", op: "gte", value: 4 }],
        },
        effects: [
          { type: "mechanical", stat: "climbing_speed", op: "add", value: 10 },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("validates a manual trigger tier with narrative effect", () => {
      const result = progressionTierSchema.safeParse({
        name: "Enforcer",
        description: "You enforce the org's will",
        trigger: { type: "manual" },
        effects: [
          { type: "mechanical", stat: "intimidation", op: "add", value: 1 },
          { type: "narrative", text: "Access to org safehouses" },
        ],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("choiceEffectSchema", () => {
    it("validates a choice with explicit list", () => {
      const result = effectSchema.safeParse({
        type: "choice",
        choose: 2,
        from: ["athletics", "acrobatics", "history"],
        grant_type: "skill_proficiency",
        choice_id: "fighter-skill-choice",
      });
      expect(result.success).toBe(true);
    });

    it("validates a choice with category string", () => {
      const result = effectSchema.safeParse({
        type: "choice",
        choose: 1,
        from: "all_languages",
        grant_type: "language",
        choice_id: "elf-language-choice",
      });
      expect(result.success).toBe(true);
    });

    it("rejects choice with choose < 1", () => {
      const result = effectSchema.safeParse({
        type: "choice",
        choose: 0,
        from: ["athletics"],
        grant_type: "skill_proficiency",
        choice_id: "bad-choice",
      });
      expect(result.success).toBe(false);
    });

    it("rejects choice without choice_id", () => {
      const result = effectSchema.safeParse({
        type: "choice",
        choose: 1,
        from: ["athletics"],
        grant_type: "skill_proficiency",
      });
      expect(result.success).toBe(false);
    });
  });
});
