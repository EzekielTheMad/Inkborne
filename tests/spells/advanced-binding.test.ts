import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAdvancedBinding, type AdvancedRawRef } from "@/lib/spells/advanced-binding";
import { parseArcanumFeatureSnapshot } from "@/lib/spells/advanced-descriptor";
import { parseContentVersionSnapshot } from "@/lib/supabase/content-definitions-parser";
import { computeResources } from "@/lib/resources/helpers";
import { arcanumFixture } from "../fixtures/arcanum-binding";
import { originalId, originalParent, originalSnapshot } from "../fixtures/subclass-casting";

beforeEach(() => { vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });
describe("advisory exact Arcanum binding", () => {
  it.each([6, 7, 8, 9] as const)("resolves declared tier%s at its class unlock without borrowing the Pact learning ceiling", tier => {
    const { input, featureSlug, spell } = arcanumFixture(tier), before = structuredClone(input);
    expect(resolveAdvancedBinding(input)).toMatchObject({ status: "ready", castLevel: tier, classSlug: "original-pact", spell: { id: spell.content_id, version: 2 }, profile: { ability: "charisma", spellAttackBonus: 6, spellDc: 14 }, payment: { resourceSlug: featureSlug, maxUses: 1, recovery: "long", usesToSpend: 1 } });
    expect(input).toEqual(before); expect(resolveAdvancedBinding(input)).not.toHaveProperty("statePatch");
  });
  it("reads the descriptor only from the same raw feature version; production parsing remains unchanged", () => {
    const { feature } = arcanumFixture();
    expect(parseContentVersionSnapshot(feature)?.data).not.toHaveProperty("advanced_casting");
    expect(parseArcanumFeatureSnapshot(feature).status).toBe("available");
    expect(parseArcanumFeatureSnapshot({ ...parseContentVersionSnapshot(feature), advanced_casting: feature.data_snapshot.advanced_casting }).status).toBe("unavailable");
    const missing = { ...feature, data_snapshot: { ...feature.data_snapshot } }; delete missing.data_snapshot.advanced_casting;
    expect(parseArcanumFeatureSnapshot({ ...missing, advanced_casting: feature.data_snapshot.advanced_casting }).status).toBe("unavailable");
  });
  it.each(["kind", "listClass", "spellLevel", "selectionCount", "castLevel"])("does not default missing descriptor %s", key => {
    const { input, feature } = arcanumFixture(); delete (feature.data_snapshot.advanced_casting as Record<string, unknown>)[key];
    expect(resolveAdvancedBinding(input).status).toBe("unavailable");
  });
  it.each(["unknown-key", "wrong-count", "wrong-level", "wrong-cast", "bonus", "flag", "missing-uses", "wrong-recovery"])("rejects descriptor/resource conflict %s", problem => {
    const { input, feature } = arcanumFixture(); const d = feature.data_snapshot.advanced_casting as Record<string, unknown>;
    if (problem === "unknown-key") d.active = true;
    if (problem === "wrong-count") d.selectionCount = 2;
    if (problem === "wrong-level") d.spellLevel = 5;
    if (problem === "wrong-cast") d.castLevel = 7;
    if (problem === "bonus") feature.data_snapshot.spellcastingBonus = [{ name: "Original bonus", oncelr: true }];
    if (problem === "flag") feature.data_snapshot.atwill = true;
    if (problem === "missing-uses") delete feature.data_snapshot.usages;
    if (problem === "wrong-recovery") feature.data_snapshot.recovery = "short rest";
    expect(resolveAdvancedBinding(input).status).toBe("unavailable");
  });
  it.each(["grant-character", "controller-ref", "grant-feature-id", "grant-version", "grant-slug", "derived-grant", "derived-feature-id", "derived-version", "feature-system", "feature-parent", "feature-subclass", "unlock", "feature-gain", "controller-version", "controller-slug", "missing-row", "duplicate-row", "duplicate-ref", "duplicate-grant", "inactive-boolean"])("rejects contradictory modeled tuple %s", problem => {
    const { input, refs, grant, feature, parent } = arcanumFixture();
    if (problem === "grant-character") grant.characterId = originalId(90);
    if (problem === "controller-ref") grant.controllerRefId = originalId(90);
    if (problem === "grant-feature-id") grant.featureContentId = originalId(90);
    if (problem === "grant-version") grant.featureVersion = 2;
    if (problem === "grant-slug") grant.featureSlug = "other-feature";
    if (problem === "derived-grant") refs[1].featureGrantId = originalId(90);
    if (problem === "derived-feature-id") refs[1].contentId = originalId(90);
    if (problem === "derived-version") refs[1].contentVersion = 2;
    if (problem === "feature-system") feature.system_id_snapshot = originalId(90);
    if (problem === "feature-parent") feature.data_snapshot.class = "other-parent";
    if (problem === "feature-subclass") feature.data_snapshot.subclass = "unselected-subclass";
    if (problem === "unlock") grant.unlockLevel = 10;
    if (problem === "feature-gain") feature.data_snapshot.level = 10;
    if (problem === "controller-version") refs[0].contentVersion = 2;
    if (problem === "controller-slug") parent.slug_snapshot = "unselected-parent";
    if (problem === "missing-row") (parent.data_snapshot.levels as Array<{ level: number; features: string[] }>).find(row => row.level === 11)!.features = [];
    if (problem === "duplicate-row") (parent.data_snapshot.levels as unknown[]).push((parent.data_snapshot.levels as unknown[])[10]);
    if (problem === "duplicate-ref") input.refs = [...refs, refs[1]];
    if (problem === "duplicate-grant") input.grants = [grant, grant];
    if (problem === "inactive-boolean") input.grants = [{ active: true, grantId: grant.grantId }];
    expect(resolveAdvancedBinding(input).status).toBe("unavailable");
  });
  it("does not unlock from total multiclass level or invented earlier rows", () => {
    const { input, refs } = arcanumFixture(6, 10); const data = originalParent("original-other", null, null, 201).content_definitions.data;
    (input.character.classes as Array<{ slug: string; level: number }>).push({ slug: "original-other", level: 7 });
    const snapshot = originalSnapshot("original-other", "class", data, 201);
    input.refs = [...refs, { refId: originalId(1201), characterId: input.character.id, contentId: snapshot.content_id, contentVersion: 1, snapshot }];
    expect(resolveAdvancedBinding(input).status).toBe("unavailable");
  });
  it.each([undefined, {}, { unrelated: 1 }])("treats only absent valid map/key as unused (%j)", usage => {
    const { input } = arcanumFixture(); input.state = usage === undefined ? {} : { feature_uses: usage };
    expect(resolveAdvancedBinding(input).status).toBe("ready");
    delete input.selection; expect(resolveAdvancedBinding(input).status).toBe("unselected");
  });
  it.each([null, [], "bad", false, { other: NaN }, { other: -1 }])("never defaults a malformed present usage map %j", usage => {
    const { input } = arcanumFixture(); input.state = { feature_uses: usage }; delete input.selection;
    expect(resolveAdvancedBinding(input).status).toBe("unavailable");
  });
  it.each([undefined, null, "0", NaN, Infinity, -1, 0.5, 1, 2])("refuses present malformed/exhausted own usage %j even without a binding", usage => {
    const { input, featureSlug } = arcanumFixture(); input.state = { feature_uses: { [featureSlug]: usage } }; delete input.selection;
    expect(resolveAdvancedBinding(input).status).toBe("unavailable");
  });
  it.each(["descriptor", "grant", "math", "completeness"])("does not call missing selection unselected before %s evidence is valid", problem => {
    const { input, feature } = arcanumFixture(); delete input.selection;
    if (problem === "descriptor") delete feature.data_snapshot.advanced_casting;
    if (problem === "grant") input.grants = [];
    if (problem === "math") input.abilities = [];
    if (problem === "completeness") input.refsComplete = false;
    expect(resolveAdvancedBinding(input).status).toBe("unavailable");
  });
  it("detects resource collisions that generic slug deduplication hides", () => {
    const { input, refs, feature, featureSlug } = arcanumFixture(); const other = originalSnapshot(featureSlug, "feat", { description: "An original colliding resource.", usages: 1, recovery: "long rest", source_refs: [] }, 90);
    input.refs = [...refs, { refId: originalId(91), characterId: input.character.id, contentId: other.content_id, contentVersion: 1, snapshot: other }];
    const definitions = [feature, other].map(snapshot => ({ content_definitions: parseContentVersionSnapshot(snapshot)! }));
    expect(computeResources(definitions as never, [{ slug: "original-pact", level: 11 }]).filter(resource => resource.slug === featureSlug)).toHaveLength(1);
    expect(resolveAdvancedBinding(input).status).toBe("unavailable");
    delete input.selection; expect(resolveAdvancedBinding(input).status).toBe("unavailable");
  });
  it("detects primary versus extraLimitedFeatures collisions before deduplication", () => {
    const { input, refs, feature, grant, parent } = arcanumFixture();
    const slug = "original-revelation.prism";
    feature.slug_snapshot = slug; grant.featureSlug = slug;
    (parent.data_snapshot.levels as Array<{ level: number; features: string[] }>).find(row => row.level === 11)!.features = [slug];
    const extra = originalSnapshot("original-revelation", "trait", { description: "An original colliding extra resource.", extraLimitedFeatures: [{ name: "Prism", usages: 1, recovery: "long rest" }] }, 90);
    input.refs = [...refs, { refId: originalId(91), characterId: input.character.id, contentId: extra.content_id, contentVersion: 1, snapshot: extra }];
    expect(resolveAdvancedBinding(input).status).toBe("unavailable");
  });
  it("refuses malformed present contributor counts instead of certifying unique payment", () => {
    const { input, refs } = arcanumFixture();
    const extra = originalSnapshot("original-other-counter", "trait", { description: "Original malformed counter.", usages: -1, recovery: "long rest" }, 90);
    input.refs = [...refs, { refId: originalId(91), characterId: input.character.id, contentId: extra.content_id, contentVersion: 1, snapshot: extra }];
    expect(resolveAdvancedBinding(input).status).toBe("unavailable");
  });
  it("validates the exact selected subclass controller without adding a second casting source", () => {
    const { input, refs, feature, grant, selection } = arcanumFixture();
    const sub = originalSnapshot("original-discipline", "subclass", { parent_class: "original-pact", levels: [{ level: 11, features: [grant.featureSlug] }] }, 210);
    (input.character.classes as Array<{ slug: string; level: number; subclass?: string }>)[0].subclass = "original-discipline";
    feature.data_snapshot.subclass = "original-discipline";
    grant.controllerRefId = originalId(1210); selection.controllerRefId = grant.controllerRefId; selection.controllerContentId = sub.content_id;
    input.refs = [...refs, { refId: grant.controllerRefId, characterId: input.character.id, contentId: sub.content_id, contentVersion: 1, snapshot: sub }];
    expect(resolveAdvancedBinding(input)).toMatchObject({ status: "ready", profile: { ability: "charisma", spellAttackBonus: 6 } });
    (input.character.classes as Array<{ subclass?: string }>)[0].subclass = "other-subclass";
    expect(resolveAdvancedBinding(input).status).toBe("unavailable");
  });
  it("rejects supplied active flags even alongside a otherwise well-formed tuple", () => {
    const { input, grant } = arcanumFixture(); input.grants = [{ ...grant, active: true }];
    expect(resolveAdvancedBinding(input).status).toBe("unavailable");
  });
  it.each(["characterId", "systemId", "classSlug", "controllerRefId", "controllerContentId", "controllerVersion", "grantId", "featureContentId", "featureVersion", "spellContentId", "spellVersion"])("rejects a stale selected binding %s", key => {
    const { input, selection } = arcanumFixture(); const s = selection as unknown as Record<string, unknown>;
    s[key] = typeof s[key] === "number" ? 99 : key === "classSlug" ? "other-parent" : originalId(99);
    expect(resolveAdvancedBinding(input).status).toBe("unavailable");
  });
  it.each(["level", "list", "missing", "duplicate", "wrong-type", "null-binding"])("requires an exact eligible chosen spell (%s)", problem => {
    const { input, refs, spell } = arcanumFixture();
    if (problem === "level") spell.data_snapshot.level = 7;
    if (problem === "list") spell.data_snapshot.classes = ["other-list"];
    if (problem === "missing") input.refs = refs.slice(0, 2);
    if (problem === "duplicate") input.refs = [...refs, { ...refs[2], refId: originalId(99) }];
    if (problem === "wrong-type") refs[2].snapshot = originalSnapshot("other-feature", "feature", { class: "original-pact", level: 11, description: "Original unrelated feature.", source_refs: [] }, 406, 2);
    if (problem === "null-binding") input.selection = null;
    expect(resolveAdvancedBinding(input).status).toBe("unavailable");
  });
  it("allows separately readable historical shared pins from another author without repinning", () => {
    const { input, feature, spell } = arcanumFixture();
    for (const snapshot of [feature, spell]) { snapshot.owner_id_snapshot = originalId(99); snapshot.scope_snapshot = "shared"; }
    expect(resolveAdvancedBinding(input)).toMatchObject({ status: "ready", spell: { version: 2, owner_id: originalId(99) } });
  });
  it("does not reinterpret a current selection grant overlay as advanced payment evidence", () => {
    const { input } = arcanumFixture(); input.grants = [{ content_id: originalId(406), content_version: 2, class_slug: "original-pact" }];
    expect(resolveAdvancedBinding(input).status).toBe("unavailable");
  });
  it("does not trust inherited usage properties or incomplete resource lists", () => {
    const { input, featureSlug } = arcanumFixture(); input.state = { feature_uses: Object.create({ [featureSlug]: 0 }) };
    expect(resolveAdvancedBinding(input).status).toBe("unavailable"); input.state = {}; input.refsComplete = false;
    expect(resolveAdvancedBinding(input).status).toBe("unavailable");
  });
  it("rejects a present nonenumerable malformed usage and never invokes a usage accessor", () => {
    const { input, featureSlug } = arcanumFixture();
    const map = Object.defineProperty({}, featureSlug, { value: undefined, enumerable: false });
    input.state = { feature_uses: map }; expect(resolveAdvancedBinding(input).status).toBe("unavailable");
    const getter = vi.fn(() => { throw new Error("Usage getter must not run"); });
    input.state = Object.defineProperty({}, "feature_uses", { get: getter });
    expect(resolveAdvancedBinding(input).status).toBe("unavailable"); expect(getter).not.toHaveBeenCalled();
  });
  it("keeps each unlocked tier's modeled resource independent", () => {
    const a = arcanumFixture(6, 17), b = arcanumFixture(7, 17);
    const rows = a.parent.data_snapshot.levels as Array<{ level: number; features: string[] }>;
    rows.find(row => row.level === 13)!.features = [b.featureSlug];
    const refs: AdvancedRawRef[] = [...a.refs, ...b.refs.slice(1)]; const grants = [a.grant, b.grant];
    for (const fixture of [a, b]) { fixture.input.refs = refs; fixture.input.grants = grants; fixture.input.state = { feature_uses: { [a.featureSlug]: 1 } }; }
    expect(resolveAdvancedBinding(a.input).status).toBe("unavailable"); expect(resolveAdvancedBinding(b.input)).toMatchObject({ status: "ready", castLevel: 7 });
  });
});
