import { describe, expect, it, vi } from "vitest";
import { resolveOwnedAncestryDefenses } from "@/lib/character/ancestry-defenses";
import { parseContentVersionSnapshot } from "@/lib/supabase/content-definitions-parser";
import type { Effect } from "@/lib/types/effects";
import { adId, ancestryDefenseFixture } from "../../fixtures/ancestry-defenses";

describe("owned ancestry fixed resistance projection", () => {
  it("projects the exact saved Gold fire declaration without mutating any source", () => {
    const f = ancestryDefenseFixture(), before = JSON.stringify(f);
    expect(resolveOwnedAncestryDefenses(f.character, f.evidence)).toEqual({ status: "available", dmgres: ["fire"] });
    expect(JSON.stringify(f)).toBe(before);
    f.selected.content_definitions.effects = [{ type: "grant", stat: "dmgres", value: "cold" }];
    expect(resolveOwnedAncestryDefenses(f.character, f.evidence)).toEqual({ status: "available", dmgres: ["cold"] });
  });
  it("a complete replacement removes the old source, while a missing selected pin stays unavailable", () => {
    const f = ancestryDefenseFixture();
    f.selected.content_definitions.slug = "draconic-ancestry-silver"; f.selected.choice_source = "builder:racial-trait:draconic-ancestry-silver";
    f.selected.content_definitions.effects = [{ type: "grant", stat: "dmgres", value: "cold" }];
    f.character.choices.resolved_choices!["draconic-ancestry-trait-choice"] = ["draconic-ancestry-silver"];
    expect(resolveOwnedAncestryDefenses(f.character, f.evidence)).toEqual({ status: "available", dmgres: ["cold"] });
    f.refs.pop();
    expect(resolveOwnedAncestryDefenses(f.character, f.evidence).status).toBe("unavailable");
    f.character.choices.resolved_choices!["draconic-ancestry-trait-choice"] = [];
    expect(resolveOwnedAncestryDefenses(f.character, f.evidence)).toEqual({ status: "available", dmgres: [] });
    delete f.character.choices.race; f.refs.splice(0);
    expect(resolveOwnedAncestryDefenses(f.character, f.evidence)).toEqual({ status: "available", dmgres: [] });
  });
  it("ignores unrelated generic grants instead of enabling a new engine-wide grant operation", () => {
    const f = ancestryDefenseFixture(); delete f.character.choices.race; f.refs.splice(0);
    for (const [index, type] of ["class", "feature", "spell", "trait"].entries()) {
      const ref = f.pin(20 + index, type, `unrelated-${type}`, {}, [{ type: "grant", stat: "dmgres", value: "fire" }]);
      ref.context = { source: "unrelated" }; ref.choice_source = null; f.refs.push(ref);
    }
    expect(resolveOwnedAncestryDefenses(f.character, f.evidence)).toEqual({ status: "available", dmgres: [] });
  });
  it("does not turn missing complete evidence into confirmed empty ancestry", () => {
    const f = ancestryDefenseFixture();
    expect(resolveOwnedAncestryDefenses(f.character)).toEqual({ status: "unavailable", reason: "incomplete_evidence" });
    expect(resolveOwnedAncestryDefenses(f.character, { status: "unavailable", reason: "incomplete_evidence" }).status).toBe("unavailable");
  });
  it.each(["character", "system", "version", "identity", "root-context", "root-choice", "root-grant", "child-context", "child-owner",
    "extra-context", "child-choice", "child-grant", "scope", "malformed-scope", "duplicate-pin", "conflicting-version", "orphan", "duplicate-choice",
    "bad-selection", "duplicate-selection", "null-selection", "unknown-resistance", "conditional-grant", "conditional-choice", "cycle"])(
    "refuses %s evidence without an empty-list fallback", kind => {
      const f = ancestryDefenseFixture();
      if (kind === "character") f.selected.character_id = adId(99);
      if (kind === "system") f.selected.content_definitions.system_id = adId(99);
      if (kind === "version") f.selected.content_version = 2;
      if (kind === "identity") f.selected.content_id = adId(99);
      if (kind === "root-context") f.root.context.source = "other";
      if (kind === "root-choice") f.root.choice_source = "other";
      if (kind === "root-grant") f.root.feature_grant_id = adId(99);
      if (kind === "child-context") f.selected.context.source = "other";
      if (kind === "child-owner") f.selected.context.root_controller_ref_id = adId(99);
      if (kind === "extra-context") f.selected.context.level = 1;
      if (kind === "child-choice") f.selected.choice_source = "other";
      if (kind === "child-grant") f.selected.feature_grant_id = adId(99);
      if (kind === "scope") f.selected.content_definitions.data.races = ["elf"];
      if (kind === "malformed-scope") f.selected.content_definitions.data.races = null;
      if (kind === "duplicate-pin") f.refs.push({ ...f.selected, id: adId(99) });
      if (kind === "conflicting-version") f.refs.push({ ...f.selected, id: adId(99), content_version: 2,
        content_definitions: { ...f.selected.content_definitions, version: 2 } });
      if (kind === "orphan") f.refs.push(f.pin(99, "trait", "unused", {}, []));
      if (kind === "duplicate-choice") f.selected.content_definitions.effects.push(structuredClone(f.controller.content_definitions.effects[0]));
      if (kind === "bad-selection") f.character.choices.resolved_choices!["draconic-ancestry-trait-choice"] = ["unlisted"];
      if (kind === "duplicate-selection") f.character.choices.resolved_choices!["draconic-ancestry-trait-choice"] = ["draconic-ancestry-gold", "draconic-ancestry-gold"];
      if (kind === "null-selection") Object.assign(f.character.choices.resolved_choices!, { "draconic-ancestry-trait-choice": null });
      if (kind === "unknown-resistance") f.selected.content_definitions.effects = [{ type: "grant", stat: "dmgres", value: "all" }];
      if (kind === "conditional-grant") f.selected.content_definitions.effects[0] = { ...f.selected.content_definitions.effects[0], condition: { field: "active", op: "eq", value: true } } as Effect;
      if (kind === "conditional-choice") f.controller.content_definitions.effects[0] = { ...f.controller.content_definitions.effects[0], condition: true } as unknown as Effect;
      if (kind === "cycle") { f.controller.content_definitions.effects = [{ type: "choice", choose: 1, from: ["draconic-ancestry"], grant_type: "trait", choice_id: "loop" }];
        f.character.choices.resolved_choices!.loop = ["draconic-ancestry"]; }
      expect(resolveOwnedAncestryDefenses(f.character, f.evidence).status).toBe("unavailable");
    });
  it("deduplicates legitimate convergent edges, including a shared pin reached from its actual root", () => {
    const f = ancestryDefenseFixture(); f.root.content_definitions.data.traits = ["draconic-ancestry", "draconic-ancestry-gold", "draconic-ancestry-gold"];
    f.character.choices.subrace = "scaled";
    f.refs.push(f.pin(30, "subrace", "scaled", { parent_race: "dragonborn", traits: ["draconic-ancestry-gold"] }, []));
    expect(resolveOwnedAncestryDefenses(f.character, f.evidence)).toEqual({ status: "available", dmgres: ["fire"] });
    f.selected.context.root_controller_ref_id = adId(30);
    f.refs.at(-1)!.content_definitions.data.traits = [];
    expect(resolveOwnedAncestryDefenses(f.character, f.evidence).status).toBe("unavailable");
  });
  it("preserves generic/empty ancestry scopes and historical shared source continuity", () => {
    const f = ancestryDefenseFixture(); delete f.selected.content_definitions.data.races; f.selected.content_definitions.data.subraces = [];
    f.selected.content_definitions.source = "homebrew"; f.selected.content_definitions.scope = "shared"; f.selected.content_definitions.owner_id = adId(99);
    expect(resolveOwnedAncestryDefenses(f.character, f.evidence)).toEqual({ status: "available", dmgres: ["fire"] });
  });
  it.each([128, 129])("bounds closure traversal at %s explicit edges", count => {
    const f = ancestryDefenseFixture(); f.refs.splice(1); f.root.content_definitions.data.traits = ["node-0"];
    for (let index = 0; index < count; index++) {
      const next = `node-${index + 1}`, choice = `choice-${index}`;
      f.refs.push(f.pin(1000 + index, "trait", `node-${index}`, { description: "Bounded dependency", races: ["dragonborn"], subraces: [] },
        index === count - 1 ? [{ type: "grant", stat: "dmgres", value: "fire" }]
          : [{ type: "choice", choose: 1, from: [next], grant_type: "trait", choice_id: choice }]));
      if (index !== count - 1) f.character.choices.resolved_choices![choice] = [next];
    }
    expect(resolveOwnedAncestryDefenses(f.character, f.evidence).status).toBe(count === 128 ? "available" : "unavailable");
  });
});

describe("actual immutable parser preserves unsupported raw ancestry semantics as unavailable", () => {
  it.each(["grant", "choice"])("refuses raw conditional %s before key stripping", kind => {
    const f = ancestryDefenseFixture(), ref = kind === "grant" ? f.selected : f.controller, d = ref.content_definitions;
    const raw = { content_id: d.id, version: d.version, system_id_snapshot: d.system_id, content_type_snapshot: d.content_type,
      slug_snapshot: d.slug, name_snapshot: d.name, data_snapshot: d.data, effects_snapshot: d.effects,
      source_snapshot: d.source, scope_snapshot: d.scope, owner_id_snapshot: d.owner_id };
    expect(parseContentVersionSnapshot(raw)).not.toBeNull();
    const conditional = { ...raw, effects_snapshot: [{ ...d.effects[0], condition: { field: "active", op: "eq", value: true } }] };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try { expect(parseContentVersionSnapshot(conditional)).toBeNull(); } finally { log.mockRestore(); }
    expect(d.effects).toEqual(raw.effects_snapshot);
  });
  it("preserves unrelated existing grant parsing instead of globally tightening effects", () => {
    const f = ancestryDefenseFixture(), d = f.selected.content_definitions;
    const raw = { content_id: d.id, version: d.version, system_id_snapshot: d.system_id, content_type_snapshot: "trait",
      slug_snapshot: d.slug, name_snapshot: d.name, data_snapshot: d.data,
      effects_snapshot: [{ type: "grant", stat: "language", value: "draconic", unrelated: "legacy metadata" }],
      source_snapshot: d.source, scope_snapshot: d.scope, owner_id_snapshot: d.owner_id };
    expect(parseContentVersionSnapshot(raw)?.effects).toEqual([{ type: "grant", stat: "language", value: "draconic" }]);
    expect(parseContentVersionSnapshot({ ...raw, content_type_snapshot: "feature", data_snapshot: {
      class: "fighter", level: 1, feature_type: "passive", description: "Unrelated feature" },
    effects_snapshot: [{ type: "grant", stat: "dmgres", value: "fire", condition: true }] })).not.toBeNull();
  });
});
