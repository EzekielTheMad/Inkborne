import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import path from "node:path";

vi.mock("server-only", () => ({}));
// Use the installed server build's real cache implementation, not a cache mock.
// Vitest is not an RSC renderer: only the renderer-owned dispatcher is simulated.
vi.mock("react", () => {
  const require = createRequire(import.meta.url);
  return require(path.join(path.dirname(require.resolve("react")), "cjs/react.react-server.development.js"));
});
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/components/character/character-page-client", () => ({ CharacterPageClient: () => null }));
vi.mock("@/lib/supabase/characters", () => ({ getCharacterWithSystem: vi.fn() }));
vi.mock("@/lib/supabase/feature-refs-server", () => ({ syncClassFeatureRefs: vi.fn() }));
vi.mock("@/lib/supabase/errors", () => ({ reportServerError: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/supabase/spells-server", () => ({ syncAlwaysPreparedSpells: async () => ({ inserted: 0, deleted: 0, activeGrants: [] }), applyActiveSpellGrantOverlays: (rows: unknown[]) => rows }));
vi.mock("@/lib/engine/evaluator", () => ({ evaluate: () => ({ stats: {} }) }));
import CharacterPage from "@/app/(app)/characters/[id]/page";
import { getCharacterWithSystem } from "@/lib/supabase/characters";
import { syncClassFeatureRefs } from "@/lib/supabase/feature-refs-server";
import * as React from "react";
import { createClient } from "@/lib/supabase/server";
import { getContentByType } from "@/lib/supabase/content-definitions";
import { getContentRefsByCharacter, getCharacterContentRefSnapshot } from "@/lib/supabase/content-refs";

const internals = (React as unknown as {
  __SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: {
    A: null | { getCacheForType: (factory: () => unknown) => unknown };
  };
}).__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;

function requestScope() {
  const roots = new Map<() => unknown, unknown>();
  internals.A = { getCacheForType(factory) {
    if (!roots.has(factory)) roots.set(factory, factory());
    return roots.get(factory);
  } };
}
const id = "11111111-1111-4111-8111-111111111111";
const character = "22222222-2222-4222-8222-222222222222";
const row = {
  id, name: "Wizard", slug: "wizard", content_type: "class", version: 1,
  source: "srd", system_id: id, scope: "personal", owner_id: character, effects: [],
  data: { hit_die: 6, spellcasting: null,
    multiclass: { prerequisites: [], proficiencies_gained: [] },
    saving_throws: ["intelligence", "wisdom"], starting_proficiencies: [],
    levels: [{ level: 1, features: [], spellcasting: null }], source_refs: [] },
};
const ref = {
  id, character_id: character, content_id: id, content_version: 1,
  context: {}, choice_source: null, created_at: "2026-10-03T00:00:00Z",
  content_versions: {
    content_id: id, version: 1, system_id_snapshot: id, content_type_snapshot: "class",
    slug_snapshot: row.slug, name_snapshot: row.name, data_snapshot: row.data,
    effects_snapshot: [], source_snapshot: "srd", scope_snapshot: "personal",
    owner_id_snapshot: character,
  },
};
function response(data: unknown[], error: unknown = null) {
  const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data, error }).then(resolve); } };
  const from = vi.fn(() => chain);
  vi.mocked(createClient).mockResolvedValue({ from, auth: { getUser: async () => ({ data: { user: { id: character } } }) } } as never);
  return { from, chain };
}

describe("server request-scoped reads", () => {
  beforeEach(() => { vi.mocked(createClient).mockReset(); requestScope(); });
  afterEach(() => { internals.A = null; vi.restoreAllMocks(); });

  it("shares concurrent layout/page refs despite distinct option objects", async () => {
    const { from } = response([ref]);
    const [layout, page] = await Promise.all([
      getContentRefsByCharacter(character, { requireCompleteSnapshots: true }),
      getContentRefsByCharacter(character, {}),
      getContentRefsByCharacter(character, { requireCompleteSnapshots: true }),
    ]);
    expect(from).toHaveBeenCalledTimes(1);
    expect(layout).toEqual(page);
    expect(layout[0].content_definitions.version).toBe(1);
    await getContentRefsByCharacter(id);
    expect(from).toHaveBeenCalledTimes(2);
  });

  it("deduplicates catalog requests by system and type", async () => {
    const { from } = response([row]);
    await Promise.all([getContentByType(id, "class"), getContentByType(id, "class")]);
    expect(from).toHaveBeenCalledTimes(1);
    await getContentByType(character, "class");
    await getContentByType(id, "feature");
    expect(from).toHaveBeenCalledTimes(3);
  });

  it("keeps strict snapshot validation after a permissive reader shared the query", async () => {
    const { from } = response([{ ...ref, content_version: 2 }]);
    expect(await getContentRefsByCharacter(character)).toHaveLength(1);
    await expect(getContentRefsByCharacter(character, { requireCompleteSnapshots: true }))
      .rejects.toThrow("Saved character snapshots could not be read");
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("does not share authorized data with a later request for another user", async () => {
    const owner = response([row]);
    expect(await getContentByType(id, "class")).toHaveLength(1);
    response([ref]);
    expect(await getContentRefsByCharacter(character)).toHaveLength(1);
    requestScope(); // Same keys, different request cookie/client authorization.
    const viewer = response([]);
    expect(await getContentByType(id, "class")).toEqual([]);
    expect(await getContentRefsByCharacter(character)).toEqual([]);
    expect(owner.from).toHaveBeenCalledTimes(1);
    expect(viewer.from).toHaveBeenCalledTimes(2);
  });

  it("reloads changed pinned versions after refresh instead of retaining old snapshots", async () => {
    response([ref]);
    expect((await getContentRefsByCharacter(character))[0].content_definitions.version).toBe(1);
    requestScope();
    const { from } = response([{ ...ref, content_version: 2,
      content_versions: { ...ref.content_versions, version: 2 } }]);
    expect((await getContentRefsByCharacter(character, { requireCompleteSnapshots: true }))
      [0].content_definitions.version).toBe(2);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("shares a failure within its request and recovers on a new request", async () => {
    const error = { code: "57014", message: "timeout" };
    const { from } = response([], error);
    const results = await Promise.allSettled([
      getContentByType(id, "class"), getContentByType(id, "class")]);
    expect(results).toEqual([{ status: "rejected", reason: error },
      { status: "rejected", reason: error }]);
    expect(from).toHaveBeenCalledTimes(1);
    requestScope();
    response([row]);
    expect(await getContentByType(id, "class")).toHaveLength(1);
  });

  it("bypasses the earlier render snapshot for an explicit post-write read", async () => {
    response([ref]);
    await getContentRefsByCharacter(character);
    const { from } = response([{ ...ref, content_version: 2,
      content_versions: { ...ref.content_versions, version: 2 } }]);
    expect((await getContentRefsByCharacter(character, { fresh: true, requireCompleteSnapshots: true }))
      [0].content_definitions.version).toBe(2);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("the actual sheet rereads new feature pins after reconciliation in a primed request", async () => {
    response([ref]);
    await getContentRefsByCharacter(character); // Layout/earlier component primes scope.
    vi.mocked(getCharacterWithSystem).mockResolvedValue({ id: character, user_id: character,
      campaign_id: null, level: 1, choices: { classes: [] }, base_stats: {}, state: {},
      game_systems: { schema_definition: { stats: [], derived_stats: [] } } } as never);
    response([]); // Sheet's other table reads are empty; refs remain memoized.
    vi.mocked(syncClassFeatureRefs).mockImplementation(async () => {
      response([{ ...ref, content_version: 2,
        content_versions: { ...ref.content_versions, version: 2 } }]);
      return { inserted: 1, deleted: 0 } as never;
    });
    const view = await CharacterPage({ params: Promise.resolve({ id: character }) });
    expect(view.props.contentRefs[0].content_definitions.version).toBe(2);
    expect(view.props.contentSnapshotsComplete).toBe(true);
    expect(syncClassFeatureRefs).toHaveBeenCalledOnce();
  });

  it("shares completeness metadata with ordinary/strict readers without another query", async () => {
    const { from } = response([ref]);
    const [snapshot, refs] = await Promise.all([getCharacterContentRefSnapshot(character), getContentRefsByCharacter(character)]);
    expect(snapshot).toEqual({ refs, complete: true });
    expect(from).toHaveBeenCalledOnce();
  });

  it("retains a readable degraded sheet but disables printing after reconciliation cannot be confirmed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    response([ref]);
    vi.mocked(getCharacterWithSystem).mockResolvedValue({ id: character, user_id: character, campaign_id: null, level: 1, choices: { classes: [] }, base_stats: {}, state: {}, game_systems: { schema_definition: { stats: [], derived_stats: [] } } } as never);
    vi.mocked(syncClassFeatureRefs).mockRejectedValue(new Error("fixture reconciliation failure"));
    const view = await CharacterPage({ params: Promise.resolve({ id: character }) });
    expect(view.props.contentSnapshotsComplete).toBe(false);
    expect(view.props.contentRefs[0].content_definitions.version).toBe(1);
  });

  it.each([null, { ...ref.content_versions, version: 2 }, { ...ref.content_versions, data_snapshot: { hit_die: "broken" } }])("the actual sheet preserves incomplete-read status through the client boundary", async contentVersion => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    response([ref, { ...ref, content_versions: contentVersion }]);
    vi.mocked(getCharacterWithSystem).mockResolvedValue({ id: character, user_id: character, campaign_id: null, level: 1, choices: { classes: [] }, base_stats: {}, state: {}, game_systems: { schema_definition: { stats: [], derived_stats: [] } } } as never);
    vi.mocked(syncClassFeatureRefs).mockResolvedValue({ inserted: 0, deleted: 0 } as never);
    const view = await CharacterPage({ params: Promise.resolve({ id: character }) });
    expect(view.props.contentSnapshotsComplete).toBe(false);
    expect(view.props.contentRefs[0].content_definitions.version).toBe(1);
  });

  it("the sheet refuses anonymous access before character or content reads", async () => {
    const from = vi.fn();
    vi.mocked(createClient).mockResolvedValue({ from, auth: { getUser: async () => ({ data: { user: null } }) } } as never);
    vi.mocked(getCharacterWithSystem).mockClear();
    await expect(CharacterPage({ params: Promise.resolve({ id: character }) })).rejects.toThrow("NEXT_REDIRECT");
    expect(getCharacterWithSystem).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("the sheet refuses an inaccessible unrelated user's character", async () => {
    const { from } = response([]);
    vi.mocked(getCharacterWithSystem).mockResolvedValue(null);
    await expect(CharacterPage({ params: Promise.resolve({ id: character }) })).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });

  it("does not memoize outside a server render context", async () => {
    internals.A = null;
    const { from } = response([]);
    await getContentRefsByCharacter(character);
    await getContentRefsByCharacter(character);
    expect(from).toHaveBeenCalledTimes(2);
  });
});

