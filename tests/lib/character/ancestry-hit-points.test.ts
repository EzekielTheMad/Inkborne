import { describe, expect, it, vi } from "vitest";
import { resolveAncestryHitPointBonus } from "@/lib/character/ancestry-hit-points";
import { computeMaxHp } from "@/lib/character/max-hp";
import { subraceDataSchema } from "@/lib/schemas/content-types/subrace";
import { ancestryHpFixture } from "../../fixtures/ancestry-hit-points";
import { hpId } from "../../fixtures/subclass-hit-points";
import { parseContentVersionSnapshot } from "@/lib/supabase/content-definitions-parser";

describe("exact saved ancestry HP root", () => {
  it("adds total character levels after the ordinary minimum and retains every source byte", () => {
    const f = ancestryHpFixture(), before = JSON.stringify(f);
    expect(resolveAncestryHitPointBonus(f.character, f.refs, true)).toEqual({ status: "available", bonus: 3 });
    expect(computeMaxHp(f.character.choices.classes!, { barbarian: f.classRef.content_definitions }, 16,
      f.character.choices.hp_rolls, "free_choice", hpId(103), 0, 3)).toBe(38);
    expect(computeMaxHp([{ slug: "sorcerer", level: 3 }], { sorcerer: { slug: "sorcerer", data: { hit_die: 6 } } },
      1, {}, "free_choice", undefined, 0, 3)).toBe(6);
    expect(JSON.stringify(f)).toBe(before);
  });
  it("keeps an old root at zero without new role metadata; a later root does not replace it", () => {
    const f = ancestryHpFixture(), current = structuredClone(f.subraceRef);
    delete f.subraceRef.content_definitions.data.hit_points_bonus_per_character_level;
    f.subraceRef.content_version = 1; f.subraceRef.content_definitions.version = 1;
    delete f.classRef.class_role; f.subraceRef.context = {};
    const before = JSON.stringify(f);
    expect(current.content_definitions.data.hit_points_bonus_per_character_level).toBe(1);
    expect(resolveAncestryHitPointBonus(f.character, f.refs, true)).toEqual({ status: "available", bonus: 0 });
    expect(subraceDataSchema.parse(f.subraceRef.content_definitions.data)).not.toHaveProperty("hit_points_bonus_per_character_level");
    expect(JSON.stringify(f)).toBe(before);
  });
  it("does not interpret a failed or filtered snapshot as absent metadata", () => {
    const f = ancestryHpFixture();
    expect(resolveAncestryHitPointBonus(f.character, [], false)).toEqual({ status: "unavailable" });
    expect(resolveAncestryHitPointBonus(f.character, f.refs, false)).toEqual({ status: "unavailable" });
    expect(resolveAncestryHitPointBonus(f.character, [f.classRef, f.raceRef], true)).toEqual({ status: "unavailable" });
  });
  it("the actual immutable parser preserves literal metadata and rejects explicit invalid raw data", () => {
    const f = ancestryHpFixture(), definition = f.subraceRef.content_definitions;
    const raw = { content_id: definition.id, version: definition.version, system_id_snapshot: definition.system_id,
      content_type_snapshot: "subrace", slug_snapshot: definition.slug, name_snapshot: "Hill Dwarf", data_snapshot: structuredClone(definition.data),
      effects_snapshot: definition.effects, source_snapshot: definition.source, scope_snapshot: definition.scope, owner_id_snapshot: definition.owner_id };
    expect(parseContentVersionSnapshot(raw)?.data.hit_points_bonus_per_character_level).toBe(1);
    delete raw.data_snapshot.hit_points_bonus_per_character_level;
    expect(parseContentVersionSnapshot(raw)?.data).not.toHaveProperty("hit_points_bonus_per_character_level");
    raw.data_snapshot.hit_points_bonus_per_character_level = null;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try { expect(parseContentVersionSnapshot(raw)).toBeNull(); } finally { log.mockRestore(); }
  });
  it.each([null, 0, 2, -1, 1.5, "1", true])("refuses explicit unsupported metadata %s", value => {
    const f = ancestryHpFixture(); f.subraceRef.content_definitions.data.hit_points_bonus_per_character_level = value;
    expect(subraceDataSchema.safeParse(f.subraceRef.content_definitions.data).success).toBe(false);
    expect(resolveAncestryHitPointBonus(f.character, f.refs, true)).toEqual({ status: "unavailable" });
  });
  it.each(["character", "system", "content", "version", "root-source", "extra-context", "choice-source", "grant",
    "parent", "missing-parent", "duplicate", "orphan", "total", "level", "missing-role", "stale-role", "changed-class", "no-original"])(
    "refuses %s rather than inventing an ancestry entitlement", kind => {
      const f = ancestryHpFixture();
      if (kind === "character") f.subraceRef.character_id = hpId(199);
      if (kind === "system") f.subraceRef.content_definitions.system_id = hpId(199);
      if (kind === "content") f.subraceRef.content_id = hpId(199);
      if (kind === "version") f.subraceRef.content_version = 1;
      if (kind === "root-source") f.subraceRef.context.source = "trait";
      if (kind === "extra-context") f.raceRef.context.level = 1;
      if (kind === "choice-source") f.subraceRef.choice_source = "builder:racial-trait:dwarven-toughness";
      if (kind === "grant") f.subraceRef.feature_grant_id = hpId(199);
      if (kind === "parent") f.subraceRef.content_definitions.data.parent_race = "elf";
      if (kind === "missing-parent") f.refs.splice(f.refs.indexOf(f.raceRef), 1);
      if (kind === "duplicate") f.refs.push({ ...f.subraceRef, id: hpId(199) });
      if (kind === "orphan") f.character.choices.subrace = "another-subrace";
      if (kind === "total") f.character.level = 4;
      if (kind === "level") f.character.choices.classes![0].level = 21;
      if (kind === "missing-role") delete f.classRef.class_role;
      if (kind === "stale-role") f.classRef.class_role!.action_revision = "6";
      if (kind === "changed-class") f.classRef.content_definitions.data.hit_die = 8;
      if (kind === "no-original") f.classRef.class_role!.role = "secondary";
      expect(resolveAncestryHitPointBonus(f.character, f.refs, true)).toEqual({ status: "unavailable" });
    });
  it("honors readable historical homebrew pins without a current catalog or owner waiver", () => {
    const f = ancestryHpFixture();
    f.character.choices.subrace = "custom-resilience"; f.subraceRef.content_definitions.slug = "custom-resilience";
    f.subraceRef.content_definitions.source = "homebrew"; f.subraceRef.content_definitions.scope = "shared";
    f.subraceRef.content_definitions.owner_id = hpId(199);
    expect(resolveAncestryHitPointBonus(f.character, f.refs, true)).toEqual({ status: "available", bonus: 3 });
  });
  it("counts both classes once after reordering, adds a separate subclass term and rejects two originals", () => {
    const f = ancestryHpFixture(), secondary = structuredClone(f.classRef);
    secondary.id = hpId(120); secondary.content_id = hpId(121); secondary.content_definitions.id = hpId(121);
    secondary.content_definitions.slug = "sorcerer"; secondary.content_definitions.data.hit_die = 6;
    secondary.class_role = { ...secondary.class_role!, occurrence_id: hpId(122), controller_ref_id: secondary.id,
      content_id: secondary.content_id, role: "secondary", raw_data: structuredClone(secondary.content_definitions.data),
      evaluation_data: structuredClone(secondary.content_definitions.data) };
    f.character.level = 5; f.character.choices.classes!.unshift({ slug: "sorcerer", level: 2, occurrence_id: hpId(122) });
    f.refs.push(secondary);
    expect(resolveAncestryHitPointBonus(f.character, f.refs, true)).toEqual({ status: "available", bonus: 5 });
    expect(computeMaxHp(f.character.choices.classes!, { barbarian: f.classRef.content_definitions, sorcerer: secondary.content_definitions },
      16, {}, "free_choice", hpId(103), 2, 5)).toBe(56);
    secondary.class_role.role = "original";
    expect(resolveAncestryHitPointBonus(f.character, f.refs, true)).toEqual({ status: "unavailable" });
  });
});
