import { describe, expect, it } from "vitest";
import { resolveSubclassHitPointBonus } from "@/lib/character/subclass-hit-points";
import { computeMaxHp } from "@/lib/character/max-hp";
import { subclassDataSchema } from "@/lib/schemas/content-types/subclass";
import { hpId, subclassHpFixture } from "../../fixtures/subclass-hit-points";

describe("frozen selected subclass HP root bonus", () => {
  it("adds own class levels after each base per-level floor without mutating snapshots", () => {
    const f = subclassHpFixture(), before = JSON.stringify(f);
    expect(resolveSubclassHitPointBonus(f.character, f.refs)).toEqual({ status: "available", bonus: 3 });
    const classes = { sorcerer: f.classRef.content_definitions };
    expect(computeMaxHp(f.character.choices.classes, classes, 15, {}, "free_choice", hpId(3), 3)).toBe(23);
    expect(computeMaxHp(f.character.choices.classes, classes, 1, {}, "free_choice", hpId(3), 3)).toBe(6);
    expect(JSON.stringify(f)).toBe(before);
  });
  it("old versions without the field retain zero without requiring new evidence or recognizing slugs", () => {
    const f = subclassHpFixture(); delete f.subclassRef.content_definitions.data.hit_points_bonus_per_class_level;
    f.subclassRef.content_version = 1; f.subclassRef.content_definitions.version = 1;
    f.subclassRef.context = {}; f.subclassRef.choice_source = null;
    expect(resolveSubclassHitPointBonus(f.character, f.refs)).toEqual({ status: "available", bonus: 0 });
    expect(resolveSubclassHitPointBonus({ ...f.character, system_id: "legacy" }, [])).toEqual({ status: "available", bonus: 0 });
    expect(subclassDataSchema.parse(f.subclassRef.content_definitions.data)).not.toHaveProperty("hit_points_bonus_per_class_level");
  });
  it.each([null, 0, 2, -1, 1.5, "1", true])("rejects malformed explicitly declared metadata %s", value => {
    const f = subclassHpFixture(); f.subclassRef.content_definitions.data.hit_points_bonus_per_class_level = value;
    expect(subclassDataSchema.safeParse(f.subclassRef.content_definitions.data).success).toBe(false);
    expect(resolveSubclassHitPointBonus(f.character, f.refs)).toEqual({ status: "unavailable" });
  });
  it.each(["character", "system", "version", "id", "source", "context", "class", "owner", "occurrence", "level", "total", "orphan", "duplicate",
    "missing-role", "stale-role", "wrong-controller", "changed-root", "extra-context", "feature-root"])(
    "refuses %s mismatches rather than granting a slug-based bonus", kind => {
      const f = subclassHpFixture();
      if (kind === "character") f.subclassRef.character_id = hpId(99);
      if (kind === "system") f.subclassRef.content_definitions.system_id = hpId(99);
      if (kind === "version") f.subclassRef.content_version = 1;
      if (kind === "id") f.subclassRef.content_id = hpId(99);
      if (kind === "source") f.subclassRef.choice_source = `builder:subclass:${hpId(99)}`;
      if (kind === "context") f.subclassRef.context.source = "feature";
      if (kind === "class") f.subclassRef.content_definitions.data.parent_class = "wizard";
      if (kind === "owner") f.subclassRef.context.class = "wizard";
      if (kind === "occurrence") f.character.choices.classes[0].occurrence_id = "missing";
      if (kind === "level") f.character.choices.classes[0].level = 21;
      if (kind === "total") f.character.level = 4;
      if (kind === "orphan") f.character.choices.classes[0].subclass = "other";
      if (kind === "duplicate") f.refs.push({ ...f.subclassRef, id: hpId(99) });
      if (kind === "missing-role") delete f.classRef.class_role;
      if (kind === "stale-role") f.classRef.class_role!.action_revision = "6";
      if (kind === "wrong-controller") f.classRef.class_role!.controller_ref_id = hpId(99);
      if (kind === "changed-root") f.classRef.content_definitions.data.hit_die = 8;
      if (kind === "extra-context") f.subclassRef.context.level = 1;
      if (kind === "feature-root") f.subclassRef.feature_grant_id = hpId(99);
      expect(resolveSubclassHitPointBonus(f.character, f.refs)).toEqual({ status: "unavailable" });
    });
  it("uses metadata from another valid subclass identity rather than a Draconic read-time waiver", () => {
    const f = subclassHpFixture(); f.character.choices.classes[0].subclass = "custom-scales";
    f.subclassRef.content_definitions.slug = "custom-scales";
    expect(resolveSubclassHitPointBonus(f.character, f.refs)).toEqual({ status: "available", bonus: 3 });
  });
  it("counts only the owning class levels and preserves the proved original after reordering", () => {
    const f = subclassHpFixture();
    const secondary = structuredClone(f.classRef);
    secondary.id = hpId(10); secondary.content_id = hpId(11); secondary.content_definitions.id = hpId(11);
    secondary.content_definitions.slug = "cleric"; secondary.content_definitions.data.hit_die = 8;
    secondary.class_role = { ...secondary.class_role!, role: "secondary", occurrence_id: hpId(12), controller_ref_id: secondary.id,
      content_id: secondary.content_id, raw_data: structuredClone(secondary.content_definitions.data),
      evaluation_data: structuredClone(secondary.content_definitions.data) };
    const choices = { ...f.character.choices, classes: [
      { slug: "cleric", level: 2, occurrence_id: hpId(12) }, ...f.character.choices.classes,
    ] };
    const result = resolveSubclassHitPointBonus({ ...f.character, level: 5, choices }, [...f.refs, secondary]);
    expect(result).toEqual({ status: "available", bonus: 3 });
    expect(computeMaxHp(choices.classes, { sorcerer: f.classRef.content_definitions, cleric: secondary.content_definitions },
      15, {}, "free_choice", hpId(3), result.status === "available" ? result.bonus : Number.NaN)).toBe(37);
  });
});
