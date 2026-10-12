import { beforeEach, describe, expect, it, vi } from "vitest";
import { originalAsiFixture } from "../fixtures/r06-asi";
const state = vi.hoisted(() => ({ rows: [] as unknown[], grants: [] as unknown[], count: 0, grantsCount: 0, error: null as unknown, grantsError: null as unknown,
  user: { id: "a1111111-1111-4111-8111-000000000003" }, characterId: "a1111111-1111-4111-8111-000000000001", systemId: "a1111111-1111-4111-8111-000000000002", selects: [] as Array<{ table: string; fields: string; options: unknown }> }));
vi.mock("server-only", () => ({}));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), cache: <T,>(fn: T) => fn }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
  from: (table: string) => ({ select: (fields: string, options: unknown) => { state.selects.push({ table, fields, options }); return { eq: () => {
    const reply = table === "characters" ? { data: { id: state.characterId, system_id: state.systemId, game_systems: { slug: "dnd-5e-2014" } }, error: null }
      : table === "character_feature_grants" ? { data: state.grants, count: state.grantsCount, error: state.grantsError }
        : { data: state.rows, count: state.count, error: state.error };
    return { ...reply, single: async () => reply, then: (resolve: (value: typeof reply) => unknown) => Promise.resolve(reply).then(resolve) };
  } }; } }),
}) }));
import { getCharacterContentRefSnapshot, parseContentRefWithContent } from "@/lib/supabase/content-refs";
function rawRows() {
  const f = originalAsiFixture();
  return { f, rows: f.refs.map(ref => { const d = ref.content_definitions; return { ...ref, content_definitions: undefined,
    content_versions: { content_id: d.id, version: d.version, system_id_snapshot: d.system_id, content_type_snapshot: d.content_type, slug_snapshot: d.slug,
      name_snapshot: d.name, data_snapshot: d.data, effects_snapshot: d.effects, source_snapshot: d.source, scope_snapshot: d.scope, owner_id_snapshot: d.owner_id, created_at: ref.created_at } }; }) };
}
beforeEach(() => { const { f, rows } = rawRows(); state.rows = rows; state.grants = f.evidence.grants; state.count = rows.length; state.grantsCount = 1;
  state.error = null; state.grantsError = null; state.selects = []; });
describe("actual read projection/nullable pin admission with simulated PostgREST", () => {
  it("retains required nullable provenance and complete exact-count grant projection", async () => {
    const result = await getCharacterContentRefSnapshot(state.characterId, { fresh: true });
    expect(result.asiEvidence.status).toBe("complete"); expect(result.refs[0].feature_grant_id).toBeNull(); expect(result.refs[1].feature_grant_id).toBe(rawRows().f.grant.id);
    expect(state.selects.find(entry => entry.table === "character_content_refs")?.fields).toContain("feature_grant_id");
    expect(state.selects.find(entry => entry.table === "character_feature_grants")?.options).toEqual({ count: "exact" });
  });
  it("missing grant column is not silently nullable", () => {
    const row = { ...rawRows().rows[0] }; delete (row as Partial<typeof row>).feature_grant_id;
    expect(parseContentRefWithContent(row)).toBeNull();
  });
  it.each(["error", "missing", "truncated", "malformed", "refs-error", "refs-truncated"])("%s projection stays unavailable, never defaults to confirmed empty", async kind => {
    if (kind === "error") state.grantsError = { message: "Simulated permission denial" };
    if (kind === "missing") state.grants = null as unknown as unknown[];
    if (kind === "truncated") state.grantsCount = 2;
    if (kind === "malformed") state.grants = [{ id: "invalid" }];
    if (kind === "refs-error") state.error = { message: "Simulated read failure" };
    if (kind === "refs-truncated") state.count = 99;
    const result = await getCharacterContentRefSnapshot(state.characterId, { fresh: true });
    expect(result.asiEvidence.status).toBe("unavailable");
  });
  it("distinguishes explicit successful empty grants from a missing read", async () => {
    state.rows = []; state.count = 0; state.grants = []; state.grantsCount = 0;
    const result = await getCharacterContentRefSnapshot(state.characterId, { fresh: true });
    expect(result.asiEvidence).toMatchObject({ status: "complete", grants: [] });
  });
});
