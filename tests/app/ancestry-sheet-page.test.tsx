import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/components/character/character-page-client", () => ({ CharacterPageClient: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/characters", () => ({ getCharacterWithSystem: vi.fn() }));
vi.mock("@/lib/supabase/content-refs", () => ({ getCharacterContentRefSnapshot: vi.fn() }));
vi.mock("@/lib/supabase/feature-refs-server", () => ({ syncClassFeatureRefs: vi.fn() }));
vi.mock("@/lib/supabase/spells-server", async () => ({ ...await vi.importActual<typeof import("@/lib/supabase/spells-server")>("@/lib/supabase/spells-server"),
  syncAlwaysPreparedSpells: vi.fn(), getActiveSpellGrants: vi.fn() }));
vi.mock("@/lib/supabase/errors", () => ({ reportServerError: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: () => { throw Error("Fixture login redirect"); }, notFound: () => { throw Error("Fixture inaccessible character"); } }));
import CharacterPage from "@/app/(app)/characters/[id]/page";
import { createClient } from "@/lib/supabase/server";
import { getCharacterWithSystem } from "@/lib/supabase/characters";
import { getCharacterContentRefSnapshot } from "@/lib/supabase/content-refs";
import { getActiveSpellGrants } from "@/lib/supabase/spells-server";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import { ancestryHpFixture } from "../fixtures/ancestry-hit-points";
import { hpId } from "../fixtures/subclass-hit-points";

function setup() {
  const f = ancestryHpFixture(), refs = f.refs as ContentRefWithContent[];
  const from = vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then(resolve: (result: unknown) => unknown) { return Promise.resolve({ data: [], error: null }).then(resolve); } }));
  vi.mocked(createClient).mockResolvedValue({ from, auth: { getUser: async () => ({ data: { user: { id: hpId(199) } } }) } } as never);
  const schema = { ability_scores: ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"]
    .map(slug => ({ slug, name: slug, abbr: slug.slice(0, 3) })), proficiency_levels: [], derived_stats: [], skills: [], resources: [],
    content_types: [], currencies: [], creation_steps: [], sheet_sections: [] };
  vi.mocked(getCharacterWithSystem).mockResolvedValue({ ...f.character, user_id: hpId(199), campaign_id: null, name: "Hill control",
    state: { current_hp: 44 }, narrative: {}, narrative_rich: {}, game_systems: { id: f.character.system_id, name: "Local system", schema_definition: schema } } as never);
  vi.mocked(getCharacterContentRefSnapshot).mockResolvedValue({ refs, complete: true,
    asiEvidence: { status: "complete", character_id: f.character.id, system_id: f.character.system_id, refs, grants: [] },
    classRoles: { status: "available", action_revision: "7", original_occurrence_id: hpId(103) } });
  vi.mocked(getActiveSpellGrants).mockResolvedValue([]);
  return f;
}
beforeEach(() => vi.clearAllMocks());
describe("actual sheet ancestry HP inputs with simulated read boundary", () => {
  it("shows HP38 while preserving existing over-max current HP as the separate R09 limitation", async () => {
    const f = setup(), before = JSON.stringify(f);
    const page = await CharacterPage({ params: Promise.resolve({ id: f.character.id }) });
    expect(page.props.maxHp).toBe(38);
    expect(page.props.evalResult.stats.constitution).toBe(16);
    expect(page.props.initialState.current_hp).toBe(44);
    expect(JSON.stringify(f)).toBe(before);
  });
  it("retains the old immutable root's HP35", async () => {
    const f = setup(); delete f.subraceRef.content_definitions.data.hit_points_bonus_per_character_level;
    f.subraceRef.content_version = 1; f.subraceRef.content_definitions.version = 1;
    const before = JSON.stringify(f);
    expect((await CharacterPage({ params: Promise.resolve({ id: f.character.id }) })).props.maxHp).toBe(35);
    expect(JSON.stringify(f)).toBe(before);
  });
  it("refuses a failed complete read rather than presenting filtered metadata as zero", async () => {
    const f = setup(); vi.mocked(getCharacterContentRefSnapshot).mockResolvedValue({ refs: [], complete: false,
      asiEvidence: { status: "unavailable", reason: "incomplete_evidence" }, classRoles: { status: "unavailable" } });
    await expect(CharacterPage({ params: Promise.resolve({ id: f.character.id }) })).rejects.toThrow("Saved hit-point mechanics are unavailable");
  });
});
