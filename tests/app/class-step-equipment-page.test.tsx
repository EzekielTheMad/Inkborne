import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn(), content: vi.fn(), snapshot: vi.fn(), step: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/supabase/content-definitions", () => ({ getContentByType: mocks.content }));
vi.mock("@/lib/supabase/content-refs", () => ({ getCharacterContentRefSnapshot: mocks.snapshot }));
vi.mock("@/lib/spells/effective-sources", () => ({ resolveEffectiveCastingSources: () => ({ status: "available", sources: [] }) }));
vi.mock("@/app/(app)/characters/[id]/builder/step-actions", () => ({ saveBuilderStep: vi.fn(), previewSubclassContentUpdate: vi.fn() }));
vi.mock("@/app/(app)/characters/[id]/builder/class/class-step-client", () => ({ ClassStepClient: (props: unknown) => { mocks.step(props); return <p>Class fixture</p>; } }));
vi.mock("next/navigation", () => ({ notFound: () => { throw Error("not-found"); }, redirect: (url: string) => { throw Error(url); } }));
import ClassStepPage from "@/app/(app)/characters/[id]/builder/class/page";
import { hpId } from "../fixtures/subclass-hit-points";

function row() {
  return { id: hpId(100), character_id: hpId(1), content_id: hpId(101), content_version: 1, content_type: "armor", equipped: true,
    custom_data: null, content_versions: { content_id: hpId(101), version: 1, system_id_snapshot: hpId(2), content_type_snapshot: "armor",
      slug_snapshot: "leather-armor", name_snapshot: "Leather Armor", data_snapshot: { armor_category: "Light", armor_class: { base: 11, dex_bonus: true } },
      effects_snapshot: [], source_snapshot: "srd", scope_snapshot: "platform", owner_id_snapshot: null } };
}
function setup(data: unknown[] = [], count = data.length, error: unknown = null) {
  const equipped = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, count, error }).then(resolve) };
  const spells = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) };
  const parent = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({
    data: { id: hpId(1), user_id: hpId(3), system_id: hpId(2), action_revision: "3", level: 3,
      choices: { classes: [{ slug: "sorcerer", level: 3 }] }, state: { equipped_armor: "none" },
      game_systems: { schema_definition: undefined } }, error: null,
  }) };
  mocks.client.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: hpId(3) } } }) },
    from: vi.fn((table: string) => table === "characters" ? parent : table === "character_inventory" ? equipped : spells) });
  return equipped;
}
beforeEach(() => {
  vi.resetAllMocks(); mocks.content.mockResolvedValue([]);
  mocks.snapshot.mockResolvedValue({ refs: [], classRoles: { status: "unavailable" }, asiEvidence: { status: "unavailable" } });
});

describe("class route exact equipped-inventory preview (query doubles only)", () => {
  it("reads only this character's equipped snapshots and passes actual armor over stale parent state", async () => {
    const equipped = setup([row()]); render(await ClassStepPage({ params: Promise.resolve({ id: hpId(1) }) }));
    expect(equipped.eq.mock.calls).toEqual([["character_id", hpId(1)], ["equipped", true]]);
    expect(equipped.select.mock.calls[0][0]).toContain("content_versions!character_inventory_content_version_fkey");
    expect(equipped.select.mock.calls[0][1]).toEqual({ count: "exact" });
    expect(mocks.step.mock.calls[0][0]).toMatchObject({ equipmentPreview: {
      state: { equipped_armor: "light", shield_equipped: false }, effects: [{ stat: "armor_class", expr: "11 + mod(dexterity)" }],
    } });
  });
  it("proves no equipped rows explicitly instead of reading mutable current catalog armor", async () => {
    setup(); render(await ClassStepPage({ params: Promise.resolve({ id: hpId(1) }) }));
    expect(mocks.step.mock.calls[0][0]).toMatchObject({ equipmentPreview: { effects: [], state: { equipped_armor: "none", shield_equipped: false } } });
    expect(mocks.content.mock.calls.some(call => call[1] === "armor")).toBe(false);
  });
  it.each(["query", "count", "missing-version", "malformed-version"])("refuses %s equipped evidence without an unarmored preview", async mode => {
    const item = row();
    if (mode === "missing-version") Object.assign(item, { content_versions: null });
    if (mode === "malformed-version") Object.assign(item.content_versions.data_snapshot.armor_class, { base: "private-bad-value" });
    setup([item], mode === "count" ? 2 : 1, mode === "query" ? { message: "private-query-detail" } : null);
    await expect(ClassStepPage({ params: Promise.resolve({ id: hpId(1) }) })).rejects.toThrow("Saved equipped items are unavailable");
    expect(mocks.step).not.toHaveBeenCalled();
  });
});
