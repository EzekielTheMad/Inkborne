import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/components/character/character-page-client", () => ({ CharacterPageClient: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/characters", () => ({ getCharacterWithSystem: vi.fn() }));
vi.mock("@/lib/supabase/content-refs", () => ({ getCharacterContentRefSnapshot: vi.fn() }));
vi.mock("@/lib/supabase/feature-refs-server", () => ({ syncClassFeatureRefs: vi.fn() }));
vi.mock("@/lib/supabase/spells-server", async () => ({ ...await vi.importActual<typeof import("@/lib/supabase/spells-server")>("@/lib/supabase/spells-server"), syncAlwaysPreparedSpells: vi.fn(), getActiveSpellGrants: vi.fn() }));
vi.mock("@/lib/supabase/errors", () => ({ reportServerError: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("Fixture login redirect"); }, notFound: () => { throw new Error("Fixture inaccessible character"); } }));
import CharacterPage from "@/app/(app)/characters/[id]/page";
import { createClient } from "@/lib/supabase/server";
import { getCharacterWithSystem } from "@/lib/supabase/characters";
import { getCharacterContentRefSnapshot } from "@/lib/supabase/content-refs";
import { syncClassFeatureRefs } from "@/lib/supabase/feature-refs-server";
import { syncAlwaysPreparedSpells, getActiveSpellGrants } from "@/lib/supabase/spells-server";
import { resolveEffectiveCastingSources } from "@/lib/spells/effective-sources";
import { originalId, originalSubclassFixture, subclassOwnerId } from "../fixtures/subclass-casting";

function setup(role: "owner" | "dm" | "anonymous" | "unrelated") {
  const input = originalSubclassFixture(), actor = role === "owner" ? subclassOwnerId : originalId(90);
  const definition = input.spells[0].content_definitions!;
  const rawSpells = [{ ...input.spells[0], content_versions: { content_id: definition.id, version: definition.version, system_id_snapshot: definition.system_id,
    content_type_snapshot: definition.content_type, slug_snapshot: definition.slug, name_snapshot: definition.name, data_snapshot: definition.data, effects_snapshot: definition.effects,
    source_snapshot: definition.source, scope_snapshot: definition.scope, owner_id_snapshot: definition.owner_id } }];
  const from = vi.fn((table: string) => {
    const rows = table === "character_spells" ? rawSpells : [];
    return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { owner_id: actor }, error: null }), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then(resolve: (result: unknown) => unknown) { return Promise.resolve({ data: rows, error: null }).then(resolve); } };
  });
  vi.mocked(createClient).mockResolvedValue({ from, auth: { getUser: async () => ({ data: { user: role === "anonymous" ? null : { id: actor } } }) } } as never);
  const schema = { ability_scores: [{ slug: "intelligence", name: "Intelligence", abbr: "INT" }, { slug: "charisma", name: "Charisma", abbr: "CHA" }], derived_stats: [{ slug: "proficiency_bonus", name: "Proficiency bonus", base: 2 }], skills: [], proficiency_levels: [], resources: [], content_types: [], currencies: [], creation_steps: [], sheet_sections: [] };
  vi.mocked(getCharacterWithSystem).mockResolvedValue(role === "unrelated" ? null : { ...input.character, user_id: subclassOwnerId, campaign_id: role === "dm" ? originalId(91) : null,
    level: 3, name: "Original Warden", base_stats: { intelligence: 14, charisma: 10, constitution: 10 }, state: { current_hp: 12 }, narrative: {}, narrative_rich: {}, game_systems: { id: input.character.system_id, name: "Original local system", schema_definition: schema } } as never);
  vi.mocked(getCharacterContentRefSnapshot).mockResolvedValue({ refs: input.contentRefs, complete: true, asiEvidence: { status: "unavailable", reason: "incomplete_evidence" } });
  const grants = [{ content_id: definition.id, content_version: 1, class_slug: "warden" }];
  vi.mocked(syncClassFeatureRefs).mockResolvedValue({ inserted: 0, deleted: 0 });
  vi.mocked(syncAlwaysPreparedSpells).mockResolvedValue({ inserted: 0, deleted: 0, activeGrants: grants });
  vi.mocked(getActiveSpellGrants).mockResolvedValue(grants);
  return { input, from };
}
beforeEach(() => { vi.clearAllMocks(); });
describe("actual sheet page preserves selected subclass source and existing authority branches", () => {
  it.each(["owner", "dm"] as const)("passes exact subclass pins and acquisition precedence for %s", async role => {
    const { input } = setup(role);
    const page = await CharacterPage({ params: Promise.resolve({ id: input.character.id }) });
    const source = resolveEffectiveCastingSources(page.props.character.choices.classes, page.props.contentRefs, page.props.character);
    expect(source).toMatchObject({ status: "available", sources: [{ kind: "subclass", classSlug: "warden" }], slots: { maxSlots: { "1": 3 } } });
    expect(page.props.classData.warden.data.spellcasting).toBeNull(); // HP/hit dice retain parent.
    expect(page.props.initialSpells[0]).toMatchObject({ content_version: 2, class_slug: "warden", source: "selection", always_prepared: true });
    expect(page.props.initialSpells[0].content_definitions.version).toBe(2);
    if (role === "owner") { expect(syncClassFeatureRefs).toHaveBeenCalledTimes(1); expect(syncAlwaysPreparedSpells).toHaveBeenCalledTimes(1); expect(getActiveSpellGrants).not.toHaveBeenCalled(); }
    else { expect(page.props.isOwner).toBe(false); expect(syncClassFeatureRefs).not.toHaveBeenCalled(); expect(syncAlwaysPreparedSpells).not.toHaveBeenCalled(); expect(getActiveSpellGrants).toHaveBeenCalledTimes(1); }
  });
  it.each(["anonymous", "unrelated"] as const)("retains %s access rejection before refs or reconciliation", async role => {
    const { input, from } = setup(role);
    await expect(CharacterPage({ params: Promise.resolve({ id: input.character.id }) })).rejects.toThrow(role === "anonymous" ? /login redirect/ : /inaccessible/);
    expect(getCharacterContentRefSnapshot).not.toHaveBeenCalled(); expect(syncClassFeatureRefs).not.toHaveBeenCalled(); expect(syncAlwaysPreparedSpells).not.toHaveBeenCalled(); expect(from).not.toHaveBeenCalled();
  });
});
