import { beforeEach, describe, expect, it, vi } from "vitest";
import { originalAsiFixture } from "@/tests/fixtures/r06-asi";
import { companionEnvelope, companionSnapshot, companionId, companionRejectedEffects, originalCompanion } from "@/tests/fixtures/companions";
import { effectSchema } from "@/lib/schemas/effects";
import { companionDataSchema } from "@/lib/schemas/content-types/companion";

const state = vi.hoisted(() => ({ rows: [] as unknown[], grants: [] as unknown[], character: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), cache: <T,>(fn: T) => fn }));
vi.mock("@/components/character/character-page-client", () => ({ CharacterPageClient: () => null }));
vi.mock("@/lib/supabase/characters", () => ({ getCharacterWithSystem: async () => state.character }));
vi.mock("@/lib/supabase/feature-refs-server", () => ({ syncClassFeatureRefs: async () => ({ inserted: 0, deleted: 0 }) }));
vi.mock("@/lib/supabase/spells-server", async () => ({
  ...await vi.importActual<typeof import("@/lib/supabase/spells-server")>("@/lib/supabase/spells-server"),
  syncAlwaysPreparedSpells: async () => ({ inserted: 0, deleted: 0, activeGrants: [] }),
}));
vi.mock("@/lib/supabase/errors", () => ({ reportServerError: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: () => { throw Error("Fixture login"); }, notFound: () => { throw Error("Fixture missing character"); } }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => {
  const f = originalAsiFixture();
  return { auth: { getUser: async () => ({ data: { user: { id: f.character.user_id } }, error: null }) },
    from: (table: string) => {
      const data = table === "character_content_refs" ? state.rows : table === "character_feature_grants" ? state.grants
        : table === "characters" ? { id: f.character.id, system_id: f.character.system_id, game_systems: { slug: "dnd-5e-2014" } } : [];
      const reply = { data, error: null, count: Array.isArray(data) ? data.length : null };
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
        single: async () => reply, maybeSingle: async () => ({ data: null, error: null }),
        then: (resolve: (value: typeof reply) => unknown) => Promise.resolve(reply).then(resolve) };
    },
  };
} }));

import CharacterPage from "@/app/(app)/characters/[id]/page";
import { getCharacterContentRefSnapshot, parseContentRefWithContent } from "@/lib/supabase/content-refs";

function rawCompanionRef(effects: unknown = [], role: "mount" | "beast_form" | "summon" = "mount") {
  const f = originalAsiFixture(), row = { ...companionEnvelope(originalCompanion(role)), system_id: f.character.system_id, owner_id: f.character.user_id };
  return { id: companionId(20), character_id: f.character.id, content_id: row.id, content_version: 1, feature_grant_id: null,
    context: {}, choice_source: null, created_at: f.character.created_at, content_versions: { ...companionSnapshot(row), effects_snapshot: effects } };
}
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const f = originalAsiFixture(); state.character = f.character; state.grants = f.evidence.grants;
  state.rows = f.refs.map(ref => {
    const d = ref.content_definitions;
    return { ...ref, content_definitions: undefined, content_versions: { content_id: d.id, version: d.version,
      system_id_snapshot: d.system_id, content_type_snapshot: d.content_type, slug_snapshot: d.slug, name_snapshot: d.name,
      data_snapshot: d.data, effects_snapshot: d.effects, source_snapshot: d.source, scope_snapshot: d.scope, owner_id_snapshot: d.owner_id } };
  });
});

describe("actual companion ref reader and CharacterPage, simulated transport only", () => {
  it.each(["mount", "beast_form", "summon"] as const)("keeps %s declared STR30/skill20 separate from character STR14 and collections", async role => {
    const ref=rawCompanionRef([],role), before=JSON.stringify(ref);state.rows.push(ref);
    const snapshot=await getCharacterContentRefSnapshot(ref.character_id,{fresh:true});
    const page=await CharacterPage({params:Promise.resolve({id:ref.character_id})});
    expect(snapshot.complete).toBe(true);expect(page.props.contentSnapshotsComplete).toBe(true);
    expect(page.props.structuredSources.asi.status).toBe("available");expect(page.props.evalResult.stats.strength).toBe(14);
    expect(page.props.allEffects).toEqual(originalAsiFixture().refs.flatMap(entry=>entry.content_definitions.effects));
    expect(page.props.evalResult.grants.some((grant:{stat:string})=>grant.stat==="athletics")).toBe(false);
    expect(companionDataSchema.parse(page.props.contentRefs.at(-1).content_definitions.data).stat_block.ability_scores.strength).toBe(30);
    expect(JSON.stringify(ref)).toBe(before);
  });
  it.each(companionRejectedEffects)("executes real evaluation then refuses independently valid envelope effect %j without repair", async effect=>{
    expect(effectSchema.safeParse(effect).success).toBe(true);
    const ref=rawCompanionRef([effect]), before=JSON.stringify(ref);state.rows.push(ref);
    const snapshot=await getCharacterContentRefSnapshot(ref.character_id,{fresh:true});
    const page=await CharacterPage({params:Promise.resolve({id:ref.character_id})});
    console.info("[original companion consumer characterization]",JSON.stringify({effectType:effect.type,refComplete:snapshot.complete,
      characterComplete:page.props.contentSnapshotsComplete,strength:page.props.evalResult.stats.strength,grants:page.props.evalResult.grants,
      companionAccepted:page.props.contentRefs.some((entry:{content_id:string})=>entry.content_id===ref.content_id),
      companionEffectsCollected:page.props.allEffects.some((entry:unknown)=>JSON.stringify(entry)===JSON.stringify(effect))}));
    expect(parseContentRefWithContent(ref)).toBeNull();expect(snapshot.complete).toBe(false);expect(snapshot.asiEvidence.status).toBe("unavailable");
    expect(page.props.contentSnapshotsComplete).toBe(false);expect(page.props.structuredSources.asi.status).toBe("unavailable");
    expect(page.props.contentRefs.some((entry:{content_id:string})=>entry.content_id===ref.content_id)).toBe(false);
    expect(page.props.allEffects).toEqual(originalAsiFixture().refs.flatMap(entry=>entry.content_definitions.effects));
    expect(page.props.evalResult.stats.strength).toBe(12);expect(page.props.evalResult.grants.some((grant:{stat:string})=>grant.stat==="athletics")).toBe(false);
    expect(page.props.allEffects.some((entry:{type:string})=>entry.type==="choice")).toBe(false);expect(JSON.stringify(ref)).toBe(before);
  });
  it.each(["missing-effects","null-effects","over-PG-version"])("degrades an unsupported raw ref %s instead of confirmed empty",async fault=>{
    const ref=rawCompanionRef();
    if(fault==="missing-effects") delete (ref.content_versions as Partial<typeof ref.content_versions>).effects_snapshot;
    if(fault==="null-effects") ref.content_versions.effects_snapshot=null;
    if(fault==="over-PG-version"){ref.content_version=2147483648;ref.content_versions.version=2147483648;}
    const before=JSON.stringify(ref);state.rows.push(ref);
    const snapshot=await getCharacterContentRefSnapshot(ref.character_id,{fresh:true});
    const page=await CharacterPage({params:Promise.resolve({id:ref.character_id})});
    expect(snapshot.complete).toBe(false);expect(page.props.contentSnapshotsComplete).toBe(false);expect(page.props.evalResult.stats.strength).toBe(12);
    expect(page.props.contentRefs.some((entry:{content_id:string})=>entry.content_id===ref.content_id)).toBe(false);expect(JSON.stringify(ref)).toBe(before);
  });
  it("retains ordinary non-companion stat/proficiency effects in the real collector and evaluator",async()=>{
    const first=state.rows[0] as {content_versions:{effects_snapshot:unknown[]}};
    first.content_versions.effects_snapshot=[companionRejectedEffects[0],companionRejectedEffects[1]];
    const page=await CharacterPage({params:Promise.resolve({id:originalAsiFixture().character.id})});
    expect(page.props.contentSnapshotsComplete).toBe(true);expect(page.props.evalResult.stats.strength).toBe(16);
    expect(page.props.evalResult.grants).toContainEqual(companionRejectedEffects[1]);
  });
});
