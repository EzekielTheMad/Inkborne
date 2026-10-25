import { describe, expect, it, vi } from "vitest";
import { resolveCastingAbility } from "@/lib/spells/casting-ability";
import { resolveEarnedRacialSpell } from "@/lib/character/earned-racial-spells";
import { getSpellCastability, isRitualEligible } from "@/lib/spells/casting";
import { transformSpellEntry } from "@/scripts/transformers/spells";
import { parseContentVersionSnapshot } from "@/lib/supabase/content-definitions-parser";
import { earnedRacialFixture, infernalInputs, racialId } from "../../fixtures/earned-racial-spells";

function snapshot(definition: ReturnType<typeof earnedRacialFixture>["root"]["content_definitions"]) {
  return { content_id: definition.id, version: definition.version, system_id_snapshot: definition.system_id,
    content_type_snapshot: definition.content_type, slug_snapshot: definition.slug, name_snapshot: definition.name,
    data_snapshot: definition.data, effects_snapshot: definition.effects, source_snapshot: definition.source,
    scope_snapshot: definition.scope, owner_id_snapshot: definition.owner_id, created_at: definition.version_created_at };
}

describe("exact earned Infernal Legacy source", () => {
  it.each([[2, false, false], [3, true, false], [4, true, false], [5, true, true], [20, true, true]])(
    "uses total character level %s instead of a class budget", (level, rebuke, darkness) => {
      const f = earnedRacialFixture(level as number);
      for (const [index, available] of [[0, rebuke], [1, darkness]] as const) {
        expect(resolveCastingAbility(f.spells[index], f.input).status).toBe(available ? "available" : "unavailable");
      }
    });
  it("binds CHA and fixed cast2 independently of the stronger Wizard ability and preserves the inputs", () => {
    const f = earnedRacialFixture(), before = JSON.stringify(f);
    expect(resolveCastingAbility(f.spells[0], f.input)).toMatchObject({ status: "available",
      profile: { classSlug: "race:tiefling", ability: "charisma", abilityModifier: 0, spellAttackBonus: 3, spellDc: 11 },
      earnedRacial: { grantKey: "infernal-legacy:3:hellish-rebuke", characterLevel: 3, spellLevel: 1, castLevel: 2 } });
    expect(f.input.abilityScores.intelligence).toBe(16); expect(JSON.stringify(f)).toBe(before);
    const forged = { ...f.spells[0], content_definitions: { ...f.spells[0].content_definitions!, data: { level: 0 } }, custom_data: {} };
    expect(resolveCastingAbility(forged, f.input)).toMatchObject({ status: "available", spell: f.spells[0] });
  });
  it("uses the root cutoff, retaining microseconds and equivalent UTC offsets", () => {
    const f = earnedRacialFixture();
    f.root.content_definitions.version_created_at = "2026-10-25T01:00:00.000001+01:00";
    f.spells[0].content_definitions!.version_created_at = "2026-10-25T00:00:00.000001Z";
    // The child is newer than old trait v1, but is exactly at the new root cutoff.
    expect(resolveCastingAbility(f.spells[0], f.input).status).toBe("available");
    f.spells[0].content_definitions!.version_created_at = "2026-10-25T00:00:00.000002Z";
    expect(resolveCastingAbility(f.spells[0], f.input).status).toBe("unavailable");
    f.spells[0].content_definitions!.version_created_at = "2026-10-25T00:00:00.000000Z";
    f.trait.content_definitions.version_created_at = "2026-10-25T00:00:00.000002Z";
    expect(resolveCastingAbility(f.spells[0], f.input).status).toBe("unavailable");
  });
  it("retains exact immutable timestamps through the real parser before checking the root cutoff", () => {
    const f = earnedRacialFixture();
    for (const ref of [f.root, f.trait]) {
      const parsed = parseContentVersionSnapshot(snapshot(ref.content_definitions));
      expect(parsed).not.toBeNull(); Object.assign(ref.content_definitions, parsed);
    }
    const spell = f.spells[0], original = snapshot(spell.content_definitions!);
    Object.assign(spell.content_definitions!, parseContentVersionSnapshot(original));
    expect(f.root.content_definitions.version_created_at).toBe("2026-10-25T00:00:00.000001Z");
    expect(resolveCastingAbility(spell, f.input).status).toBe("available");
    Object.assign(spell.content_definitions!, parseContentVersionSnapshot({ ...original, created_at: "2026-10-25T00:00:00.000002Z" }));
    expect(resolveCastingAbility(spell, f.input).status).toBe("unavailable");
  });
  it.each(["spellcasting_ability", "spell"])("never normalizes unsupported conditional %s into a positive grant", stat => {
    const f = earnedRacialFixture(), raw = snapshot(f.trait.content_definitions);
    const invalid = { ...raw, effects_snapshot: raw.effects_snapshot.map(effect => effect.type === "grant" && effect.stat === stat
      ? { ...effect, condition: { field: "borrowed_state", op: "eq", value: true } } : effect) };
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try { expect(parseContentVersionSnapshot(invalid)).toBeNull(); } finally { error.mockRestore(); }
    // A raw loaded row must also refuse before generic schema normalization.
    f.trait.content_definitions.effects = invalid.effects_snapshot;
    expect(resolveCastingAbility(f.spells[0], f.input).status).toBe("unavailable");
  });
  it("accepts the same empty Infernal Legacy subrace membership when omitted", () => {
    const f = earnedRacialFixture(); delete f.trait.content_definitions.data.subraces;
    expect(resolveCastingAbility(f.spells[0], f.input).status).toBe("available");
  });
  it.each(["missing", "duplicate", "out-of-range"])("requires immutable accepted selected class levels: %s", fault => {
    const f = earnedRacialFixture(), pin = f.classes[0];
    const levels = structuredClone(pin.content_definitions.data.levels) as { level: number }[];
    pin.content_definitions.data.levels = fault === "missing" ? levels.filter(row => row.level !== 3)
      : fault === "duplicate" ? [...levels, levels[2]] : levels.map(row => row.level === 3 ? { ...row, level: 21 } : row);
    // Keep the exact native-role preimage paired, so this tests the manifest rule.
    pin.class_role!.raw_data = structuredClone(pin.content_definitions.data);
    expect(resolveCastingAbility(f.spells[0], f.input).status).toBe("unavailable");
  });
  it.each(["incomplete", "root-absent", "historical-root", "root-version", "root-owner", "root-character", "root-context", "wrong-selection", "subrace-choice", "empty-subrace-choice", "duplicate-root",
    "trait-absent", "duplicate-trait", "trait-controller", "trait-choice", "trait-owner", "trait-membership", "trait-ability", "trait-spell", "extra-trait-spell",
    "missing-role", "role-revision", "parent-revision", "class-occurrence", "class-raw", "two-originals", "level-sum", "source-pin", "source-root", "source-key", "source-extra",
    "spell-grant", "class-group", "spell-source", "spell-version", "spell-system", "spell-owner", "spell-name", "spell-level", "spellbook", "prepared", "root-time", "trait-time", "spell-time"])(
    "refuses %s without borrowing a source or class budget", fault => {
      const f = earnedRacialFixture(), spell = f.spells[0];
      if (fault === "incomplete") f.input.contentSnapshotsComplete = false;
      if (fault === "root-absent") f.input.contentRefs = f.refs.filter(ref => ref !== f.root);
      if (fault === "historical-root") delete f.root.content_definitions.data.earned_racial_spells;
      if (fault === "root-version") f.root.content_version++;
      if (fault === "root-owner") f.root.content_definitions.owner_id = racialId(99);
      if (fault === "root-character") f.root.character_id = racialId(99);
      if (fault === "root-context") f.root.context.extra = true;
      if (fault === "wrong-selection") f.character.choices.race = "human";
      if (fault === "subrace-choice") f.input.character.choices.subrace = "other";
      if (fault === "empty-subrace-choice") f.input.character.choices.subrace = "";
      if (fault === "duplicate-root") f.input.contentRefs.push({ ...f.root, id: racialId(99) });
      if (fault === "trait-absent") f.input.contentRefs = f.refs.filter(ref => ref !== f.trait);
      if (fault === "duplicate-trait") f.input.contentRefs.push({ ...f.trait, id: racialId(99) });
      if (fault === "trait-controller") f.trait.context.root_controller_ref_id = racialId(99);
      if (fault === "trait-choice") f.trait.choice_source = null;
      if (fault === "trait-owner") f.trait.feature_grant_id = racialId(99);
      if (fault === "trait-membership") f.trait.content_definitions.data.races = ["human"];
      if (fault === "trait-ability") f.trait.content_definitions.effects = f.trait.content_definitions.effects.filter(effect => !(effect.type === "grant" && effect.stat === "spellcasting_ability"));
      if (fault === "trait-spell") f.trait.content_definitions.effects = f.trait.content_definitions.effects.filter(effect => !(effect.type === "grant" && effect.stat === "spell"));
      if (fault === "extra-trait-spell") f.trait.content_definitions.effects.push({ type: "grant", stat: "spell", value: "hellish-rebuke" });
      if (fault === "missing-role") delete f.classes[0].class_role;
      if (fault === "role-revision") f.classes[0].class_role!.action_revision = "6";
      if (fault === "parent-revision") delete f.input.character.action_revision;
      if (fault === "class-occurrence") f.classes[0].class_role!.occurrence_id = racialId(99);
      if (fault === "class-raw") f.classes[0].content_definitions.data.hit_die = 12;
      if (fault === "two-originals") f.classes[1].class_role!.role = "original";
      if (fault === "level-sum") f.character.level = 6;
      if (fault === "source-pin") spell.custom_data!.builder_source_pin_id = racialId(99);
      if (fault === "source-root") spell.custom_data!.builder_root_ref_id = racialId(99);
      if (fault === "source-key") (spell.custom_data!.builder_earned_racial_spell as Record<string, unknown>).grant_key = "infernal-legacy:5:darkness";
      if (fault === "source-extra") spell.custom_data!.borrowed_class = "wizard";
      if (fault === "spell-grant") spell.spell_grant_id = racialId(99);
      if (fault === "class-group") spell.class_slug = "wizard";
      if (fault === "spell-source") spell.source = "feature";
      if (fault === "spell-version") spell.content_version = 2;
      if (fault === "spell-system") spell.content_definitions!.system_id = racialId(99);
      if (fault === "spell-owner") spell.content_definitions!.source = "homebrew";
      if (fault === "spell-name") spell.name = "Borrowed name";
      if (fault === "spell-level") spell.content_definitions!.data.level = 2;
      if (fault === "spellbook") spell.in_spellbook = true;
      if (fault === "prepared") spell.is_prepared = false;
      if (fault === "root-time") delete f.root.content_definitions.version_created_at;
      if (fault === "trait-time") f.trait.content_definitions.version_created_at = "unavailable";
      if (fault === "spell-time") delete spell.content_definitions!.version_created_at;
      expect(resolveEarnedRacialSpell(spell, f.input.character, f.input.contentRefs, f.input.contentSnapshotsComplete === true).status).toBe("unavailable");
    });
  it("leaves the legacy strict cantrip branch independent of new positive-cohort evidence", () => {
    const f = earnedRacialFixture(), row = f.spells[0], transformed = transformSpellEntry(infernalInputs.spells[0]);
    delete row.custom_data!.builder_earned_racial_spell;
    row.name = "Thaumaturgy"; row.content_definitions = { ...row.content_definitions!, slug: "thaumaturgy", name: row.name, data: transformed.data, effects: transformed.effects };
    delete f.root.content_definitions.data.earned_racial_spells; f.root.content_version = f.root.content_definitions.version = 1;
    delete f.input.character.level; delete f.input.character.action_revision; f.input.contentSnapshotsComplete = undefined;
    f.input.contentRefs = [f.root, f.trait];
    expect(resolveCastingAbility(row, f.input)).toMatchObject({ status: "available", profile: { ability: "charisma" } });
  });
  it("does not offer slots or rituals for earned rows, including malformed claims", () => {
    const f = earnedRacialFixture();
    for (const spell of f.spells) {
      spell.content_definitions!.data.ritual = true;
      expect(getSpellCastability(spell, {} as never)).toBe("none"); expect(isRitualEligible(spell, {} as never)).toBe(false);
    }
    f.spells[0].content_definitions!.data.level = 0;
    expect(getSpellCastability(f.spells[0], {} as never)).toBe("none");
  });
});
