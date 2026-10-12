import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { parseContentDefinition, parseContentVersionSnapshot } from "@/lib/supabase/content-definitions-parser";
import { computeResources } from "@/lib/resources/helpers";
import { computeLongRestEffects, computeShortRestEffects } from "@/lib/rest/helpers";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
const hooks = vi.hoisted(() => ({ resources: vi.fn() }));
// Actual Features UI, with explicitly simulated resource persistence callbacks.
vi.mock("@/lib/character/character-context", () => ({ useResources: hooks.resources }));
import { FeaturesTab } from "@/components/sheet/tabs/features-tab";
const base = { id: "33333333-3333-4333-8333-333333333333", system_id: "22222222-2222-4222-8222-222222222222", name: "Original Lantern Memory",
  slug: "original-lantern-memory", content_type: "trait", source: "homebrew", scope: "personal", owner_id: "11111111-1111-4111-8111-111111111111", version: 1, effects: [] };
function parsedRef(data: Record<string, unknown>): ContentRefWithContent {
  const definition = parseContentDefinition({ ...base, data });
  const pin = parseContentVersionSnapshot({ content_id: base.id, version: 1, system_id_snapshot: base.system_id, content_type_snapshot: "trait",
    name_snapshot: base.name, slug_snapshot: base.slug, source_snapshot: base.source, scope_snapshot: base.scope, owner_id_snapshot: base.owner_id, data_snapshot: data, effects_snapshot: [] });
  if (!definition || !pin) throw Error("Canonical synthetic trait pin must parse.");
  expect(pin.data).toEqual(definition.data);
  return { id: "44444444-4444-4444-8444-444444444444", character_id: "55555555-5555-4555-8555-555555555555", content_id: base.id, content_version: 1,
    feature_grant_id: null, context: { source: "synthetic-test-only" }, choice_source: null, created_at: "2026-10-11T00:00:00Z", content_definitions: pin };
}
describe("canonical standalone trait consumer parity (synthetic pins, no attachment/persistence claim)", () => {
  it.each(["short rest", "long rest"])("actual parsed %s trait supplies scalar counter and real rest behavior", recovery => {
    const reference = parsedRef({ description: "A rights-safe original synthetic memory.", usages: 3, recovery });
    const resources = computeResources([reference], [{ slug: "fighter", level: 3 }]);
    expect(resources).toEqual([{ slug: base.slug, name: base.name, max: 3, recovery: recovery === "short rest" ? "short" : "long", sourceLabel: "Racial Trait", sourceFeatureSlug: base.slug }]);
    const state = { feature_uses: { [base.slug]: 2 } };
    expect(computeShortRestEffects(state, resources).statePatch.feature_uses).toEqual(recovery === "short rest" ? { [base.slug]: 0 } : undefined);
    expect(computeLongRestEffects(state, 10, resources).statePatch.feature_uses).toEqual({ [base.slug]: 0 });
  });
  it.each([{}, { usages: 0 }, { usages: 0, recovery: "short rest" }])("blank/zero primary metadata %j produces no invented counter", controls => {
    expect(computeResources([parsedRef({ description: "Original passive text.", ...controls })], [])).toEqual([]);
  });
  it("legacy arrays/extras/dawn keep actual supported consumer behavior with truthful normalization", () => {
    const reference = parsedRef({ description: "Original legacy text.", usages: Array.from({ length: 20 }, (_, index) => index + 1), recovery: "dawn",
      extraLimitedFeatures: [{ name: "Separate remembrance", usages: 2, recovery: "day" }] });
    expect(computeResources([reference], [{ slug: "fighter", level: 3 }])).toMatchObject([{ max: 3, recovery: "long" }, { max: 2, recovery: "long" }]);
  });
  it("existing immutable parsed pin and actual Features description survive a newer definition", () => {
    const reference = parsedRef({ description: "Saved original memory.", usages: 2, recovery: "long rest" });
    const before = structuredClone(reference);
    const newer = parseContentDefinition({ ...base, version: 2, data: { description: "Later edited metadata.", usages: 4, recovery: "short rest" } });
    expect(newer?.data.description).toBe("Later edited metadata.");
    const resources = computeResources([reference], [{ slug: "fighter", level: 3 }]);
    hooks.resources.mockReturnValue({ resources, uses: {}, setUsed: vi.fn() });
    render(<FeaturesTab character={{} as never} schema={{ content_types: [] } as never} contentRefs={[reference]} />);
    expect(screen.getByText("Saved original memory.")).toBeVisible(); expect(screen.queryByText("Later edited metadata.")).not.toBeInTheDocument();
    expect(resources[0].max).toBe(2); expect(reference).toEqual(before);
  });
});
