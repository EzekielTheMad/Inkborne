import { describe, expect, it } from "vitest";
import { validateFrozenSpellAuthority } from "@/lib/character/hit-die-spell-authority";
import { canonicalHitDieJson } from "@/lib/character/durable-hit-die-canonical";
import { authorityId, controllerCreatedAt, frozenSpellGraphFixture, rebuildAuthorityGraph, spellAuthorityInput } from "../../fixtures/hit-die-authority";

describe("full frozen spell closure, no historical winner/Auth/producer/SQL proof", () => {
  it("retains a complete inactive manifest and accepts a complete empty manifest only with actual empty grants", () => {
    const graph = frozenSpellGraphFixture(), before = canonicalHitDieJson(graph);
    expect(validateFrozenSpellAuthority(spellAuthorityInput(graph))).toEqual({ status: "available", representativeIds: [authorityId(10)] });
    expect(canonicalHitDieJson(graph)).toBe(before);
    delete graph.snapshot.pins[0].resolved.data.spellcastingExtra;
    expect(validateFrozenSpellAuthority(spellAuthorityInput(graph)).status).toBe("unavailable");
    graph.snapshot.spell_grants = []; graph.snapshot.spells = []; rebuildAuthorityGraph(graph);
    expect(validateFrozenSpellAuthority(spellAuthorityInput(graph))).toEqual({ status: "available", representativeIds: [] });
  });
  it.each(["missing", "extra", "duplicate-key", "duplicate-id", "wrong-controller", "wrong-class", "wrong-unlock", "wrong-slug", "wrong-name", "wrong-system"])("refuses full manifest/tuple fault %s", fault => {
    const graph = frozenSpellGraphFixture(), grants = graph.snapshot.spell_grants;
    if (fault === "missing") grants.pop();
    if (fault === "extra") grants.push({ ...grants[0], id: authorityId(90), spell_slug: "not-in-controller" });
    if (fault === "duplicate-key") grants[1] = { ...grants[0], id: authorityId(90) };
    if (fault === "duplicate-id") grants[1].id = grants[0].id;
    if (fault === "wrong-controller") grants[0].controller_ref_id = authorityId(99);
    if (fault === "wrong-class") grants[0].class_slug = "wizard";
    if (fault === "wrong-unlock") grants[0].unlock_level = 2;
    if (fault === "wrong-slug") grants[0].spell_slug = "forged";
    if (fault === "wrong-name") grants[0].spell_name = "forged";
    if (fault === "wrong-system") graph.versions[1].system_id = authorityId(99);
    const before = canonicalHitDieJson(graph);
    expect(validateFrozenSpellAuthority(spellAuthorityInput(graph)).status).toBe("unavailable");
    expect(canonicalHitDieJson(graph)).toBe(before);
  });
  it("coalesces repeated slug to minimum unlock and supports scalar/array tiers without changing raw manifest", () => {
    const graph = frozenSpellGraphFixture(); graph.snapshot.pins[0].resolved.data.spellcastingExtra = [" shield ", ["shield"], ["misty-step", "shield"]];
    const before = canonicalHitDieJson(graph);
    expect(validateFrozenSpellAuthority(spellAuthorityInput(graph)).status).toBe("available");
    expect(canonicalHitDieJson(graph)).toBe(before);
    graph.snapshot.spell_grants[0].unlock_level = 3;
    expect(validateFrozenSpellAuthority(spellAuthorityInput(graph)).status).toBe("unavailable");
  });
  it.each(["\tshield\t", "\u00a0shield\u00a0"])("does not Unicode-trim a different immutable slug %j", slug => {
    const graph = frozenSpellGraphFixture(); graph.snapshot.pins[0].resolved.data.spellcastingExtra = [[slug], [], ["misty-step"]];
    expect(validateFrozenSpellAuthority(spellAuthorityInput(graph)).status).toBe("unavailable");
  });
  it.each([{manifest:null}, {manifest:"shield"}, {manifest:[" "]}, {manifest:[{ level: "01", spells: ["shield"] }]}, {manifest:[{ level: 1, spells: ["shield"] }]}, {manifest:Array.from({ length: 21 }, (_, i) => i === 20 ? ["shield"] : [])}])("keeps malformed/unsupported class manifest unavailable %j", ({manifest}) => {
    const graph = frozenSpellGraphFixture(); graph.snapshot.pins[0].resolved.data.spellcastingExtra = manifest;
    expect(validateFrozenSpellAuthority(spellAuthorityInput(graph)).status).toBe("unavailable");
  });
  it.each(["missing", "extra", "duplicate", "wrong-tuple", "wrong-order", "invalid-native-date", "precision3"])("refuses unproved immutable time closure %s", fault => {
    const graph = frozenSpellGraphFixture(), times = graph.version_times;
    if (fault === "missing") times.pop();
    if (fault === "extra") times.push({ ...times[0], content_id: authorityId(99) });
    if (fault === "duplicate") times[1] = { ...times[0] };
    if (fault === "wrong-tuple") times[1].content_version = 2;
    if (fault === "wrong-order") times.reverse();
    if (fault === "invalid-native-date") times[1].created_at = "2026-02-30T00:00:00.000000Z";
    if (fault === "precision3") times[1].created_at = "2026-01-01T00:00:00.000Z";
    expect(validateFrozenSpellAuthority(spellAuthorityInput(graph)).status).toBe("unavailable");
  });
  it.each(["2026-01-01T00:00:00.000000Z", controllerCreatedAt])("accepts native as-of boundary %s", instant => {
    const graph = frozenSpellGraphFixture(); graph.version_times[1].created_at = instant;
    expect(validateFrozenSpellAuthority(spellAuthorityInput(graph)).status).toBe("available");
  });
  it("rejects future by one microsecond and never treats later grant creation as the cutoff", () => {
    const graph = frozenSpellGraphFixture(); graph.version_times[1].created_at = "2026-01-01T00:00:00.000002Z";
    expect(graph.snapshot.spell_grants[0].created_at).toBe("2026-10-12T01:00:00.000000Z");
    expect(validateFrozenSpellAuthority(spellAuthorityInput(graph)).status).toBe("unavailable");
  });
  it.each(["homebrew-spell", "personal-spell", "imported-controller"])("refuses unsupported source/scope lineage %s", fault => {
    const graph = frozenSpellGraphFixture();
    if (fault === "homebrew-spell") graph.versions[1].source = "homebrew";
    if (fault === "personal-spell") graph.versions[1].scope = "personal";
    if (fault === "imported-controller") graph.snapshot.pins[0].resolved.source = "imported";
    expect(validateFrozenSpellAuthority(spellAuthorityInput(graph)).status).toBe("unavailable");
  });
  it("supports subclass explicit tier objects and chooses the shipped active UUID representative without raw reordering", () => {
    const graph = frozenSpellGraphFixture(), s = graph.snapshot, cls = s.pins[0].resolved;
    s.character.choices.classes[0].subclass = "original-study";
    const sub = { ...cls, id: authorityId(25), content_type: "subclass" as const, slug: "original-study", name: "Original study", data: { parent_class: cls.slug, levels: [{ level: 1, features: [] }], spellcastingExtra: [{ level: 1, spells: ["shield"] }] } };
    s.pins.push({ ...s.pins[0], id: authorityId(4), content_id: sub.id, resolved: sub });
    const grant = { ...s.spell_grants[0], id: authorityId(24), controller_ref_id: authorityId(4), controller_type: "subclass" as const, controller_slug: sub.slug };
    s.spell_grants.push(grant); graph.versions.push(sub); rebuildAuthorityGraph(graph);
    s.spells[0].spell_grant_id = grant.id;
    const before = canonicalHitDieJson(graph);
    expect(validateFrozenSpellAuthority(spellAuthorityInput(graph))).toEqual({ status: "available", representativeIds: [grant.id] });
    expect(canonicalHitDieJson(graph)).toBe(before);
    s.spells[0].spell_grant_id = authorityId(10);
    expect(validateFrozenSpellAuthority(spellAuthorityInput(graph)).status).toBe("unavailable");
  });
  it("preserves a selected different version/name/preparation state as acquisition precedence", () => {
    const graph = frozenSpellGraphFixture(), selected = { ...graph.versions[1], version: 2, name: "Original selected v2" };
    graph.versions.push(selected);
    graph.snapshot.spells[0] = { ...graph.snapshot.spells[0], source: "selection", spell_grant_id: null, content_version: 2, name: "Stored selection name", is_prepared: false, always_prepared: false, resolved: selected };
    rebuildAuthorityGraph(graph); const before = canonicalHitDieJson(graph);
    expect(validateFrozenSpellAuthority(spellAuthorityInput(graph))).toEqual({ status: "available", representativeIds: [authorityId(10)] });
    expect(canonicalHitDieJson(graph)).toBe(before);
  });
  it("requires an acquisition at the equality unlock boundary and retains dormant grants below it", () => {
    const graph = frozenSpellGraphFixture();
    graph.snapshot.character.level = 2; graph.snapshot.character.choices.classes[0].level = 2;
    expect(validateFrozenSpellAuthority(spellAuthorityInput(graph)).status).toBe("available");
    graph.snapshot.character.level = 3; graph.snapshot.character.choices.classes[0].level = 3;
    expect(validateFrozenSpellAuthority(spellAuthorityInput(graph)).status).toBe("unavailable");
    const grant = graph.snapshot.spell_grants[1];
    graph.snapshot.spells.push({ ...graph.snapshot.spells[0], id: authorityId(14), content_id: grant.spell_content_id, content_version: grant.spell_version, spell_grant_id: grant.id, name: grant.spell_name, resolved: graph.versions.find(v => v.id === grant.spell_content_id)! });
    expect(validateFrozenSpellAuthority(spellAuthorityInput(graph))).toEqual({ status: "available", representativeIds: [authorityId(10), authorityId(11)] });
  });
  it.each(["missing", "duplicate", "inactive-link", "forged-link", "unprepared", "not-always", "feat", "item", "unknown"])("refuses physical acquisition fault %s without reconciling", fault => {
    const graph = frozenSpellGraphFixture(), spells = graph.snapshot.spells;
    if (fault === "missing") graph.snapshot.spells = [];
    if (fault === "duplicate") spells.push({ ...spells[0], id: authorityId(99) });
    if (fault === "inactive-link") spells[0].spell_grant_id = authorityId(11);
    if (fault === "forged-link") spells[0].spell_grant_id = authorityId(99);
    if (fault === "unprepared") spells[0].is_prepared = false;
    if (fault === "not-always") spells[0].always_prepared = false;
    if (["feat", "item", "unknown"].includes(fault)) { spells[0].source = fault; spells[0].spell_grant_id = null; }
    const before = canonicalHitDieJson(graph);
    expect(validateFrozenSpellAuthority(spellAuthorityInput(graph)).status).toBe("unavailable");
    expect(canonicalHitDieJson(graph)).toBe(before);
  });
  it("accepts independent custom selection only with every source identity null; it never fills a missing representative", () => {
    const graph = frozenSpellGraphFixture(), custom = { ...graph.snapshot.spells[0], id: authorityId(99), source: "selection", content_id: null, content_version: null, spell_grant_id: null, resolved: null, name: "Original custom" };
    graph.snapshot.spells.push(custom);
    expect(validateFrozenSpellAuthority(spellAuthorityInput(graph)).status).toBe("available");
    graph.snapshot.spells.shift();
    expect(validateFrozenSpellAuthority(spellAuthorityInput(graph)).status).toBe("unavailable");
  });
});
