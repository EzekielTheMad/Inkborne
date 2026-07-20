import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  applyActiveSpellGrantOverlays,
  getActiveSpellGrants,
  syncAlwaysPreparedSpells,
} from "@/lib/supabase/spells-server";
import type { CharacterSpell } from "@/lib/types/spells";

const SPELL_ID = "11111111-1111-4111-8111-111111111111";

function makeClient(response: {
  data: unknown;
  error: { message: string } | null;
}) {
  const rpc = vi.fn().mockResolvedValue(response);
  return {
    client: { rpc } as unknown as Parameters<typeof syncAlwaysPreparedSpells>[0],
    rpc,
  };
}

describe("syncAlwaysPreparedSpells", () => {
  it("atomically reconciles from the pinned database manifest", async () => {
    const db = makeClient({
      data: [
        {
          inserted: 2,
          deleted: 1,
          active_grants: [
            {
              content_id: SPELL_ID,
              content_version: 1,
              class_slug: "cleric",
            },
          ],
        },
      ],
      error: null,
    });

    await expect(
      syncAlwaysPreparedSpells(db.client, { characterId: "char-1" }),
    ).resolves.toEqual({
      inserted: 2,
      deleted: 1,
      activeGrants: [
        {
          content_id: SPELL_ID,
          content_version: 1,
          class_slug: "cleric",
        },
      ],
    });

    expect(db.rpc).toHaveBeenCalledTimes(1);
    expect(db.rpc).toHaveBeenCalledWith("sync_character_spell_grants", {
      target_character_id: "char-1",
    });
  });

  it("surfaces a database failure without attempting client-side fallback", async () => {
    const db = makeClient({
      data: null,
      error: { message: "permission denied" },
    });

    await expect(
      syncAlwaysPreparedSpells(db.client, { characterId: "char-1" }),
    ).rejects.toThrow("[syncAlwaysPreparedSpells] failed: permission denied");

    expect(db.rpc).toHaveBeenCalledTimes(1);
  });

  it.each([
    null,
    [],
    [{ inserted: -1, deleted: 0, active_grants: [] }],
    [{ inserted: 1, deleted: 0 }],
    [
      { inserted: 1, deleted: 0, active_grants: [] },
      { inserted: 0, deleted: 0, active_grants: [] },
    ],
  ])("fails closed for a malformed RPC result: %j", async (data) => {
    const db = makeClient({ data, error: null });

    await expect(
      syncAlwaysPreparedSpells(db.client, { characterId: "char-1" }),
    ).rejects.toThrow("invalid spell-grant reconciliation result");
  });
});

describe("getActiveSpellGrants", () => {
  const activeGrants = [
    {
      content_id: SPELL_ID,
      content_version: 1,
      class_slug: "cleric",
    },
  ];

  it("uses the read-only viewer RPC", async () => {
    const db = makeClient({ data: activeGrants, error: null });

    await expect(
      getActiveSpellGrants(db.client, { characterId: "char-1" }),
    ).resolves.toEqual(activeGrants);
    expect(db.rpc).toHaveBeenCalledWith(
      "get_active_character_spell_grants",
      { target_character_id: "char-1" },
    );
  });

  it("fails closed for unauthorized or malformed viewer results", async () => {
    const unauthorized = makeClient({
      data: null,
      error: { message: "unavailable" },
    });
    await expect(
      getActiveSpellGrants(unauthorized.client, { characterId: "char-1" }),
    ).rejects.toThrow("[getActiveSpellGrants] failed: unavailable");

    const malformed = makeClient({ data: [{ content_id: SPELL_ID }], error: null });
    await expect(
      getActiveSpellGrants(malformed.client, { characterId: "char-1" }),
    ).rejects.toThrow("invalid active spell-grant result");
  });
});

describe("applyActiveSpellGrantOverlays", () => {
  const selectedSpell: CharacterSpell = {
    id: "selected-row",
    character_id: "character-1",
    content_id: SPELL_ID,
    content_version: 7,
    name: "Bless",
    class_slug: "cleric",
    is_known: true,
    is_prepared: false,
    always_prepared: false,
    in_spellbook: false,
    source: "selection",
    custom_data: { note: "player acquisition" },
    created_at: "2026-07-20T00:00:00.000Z",
  };

  it("overlays an active pinned grant without replacing selection provenance", () => {
    const [result] = applyActiveSpellGrantOverlays([selectedSpell], [
      {
        content_id: SPELL_ID,
        content_version: 1,
        class_slug: "cleric",
      },
    ]);

    expect(result).toEqual({
      ...selectedSpell,
      is_prepared: true,
      always_prepared: true,
    });
    expect(result.id).toBe("selected-row");
    expect(result.source).toBe("selection");
    expect(result.content_version).toBe(7);
    expect(result.custom_data).toEqual({ note: "player acquisition" });
  });

  it("restores the untouched selected state when the grant becomes dormant", () => {
    const [result] = applyActiveSpellGrantOverlays([selectedSpell], []);

    expect(result).toBe(selectedSpell);
    expect(result.is_prepared).toBe(false);
    expect(result.always_prepared).toBe(false);
    expect(result.source).toBe("selection");
  });

  it("does not overlay the same spell acquired for another class", () => {
    const [result] = applyActiveSpellGrantOverlays([selectedSpell], [
      {
        content_id: SPELL_ID,
        content_version: 1,
        class_slug: "paladin",
      },
    ]);

    expect(result).toBe(selectedSpell);
  });

  it("renders the same overlay for owner-sync and read-only DM manifests", () => {
    const ownerManifest = [
      {
        content_id: SPELL_ID,
        content_version: 1,
        class_slug: "cleric",
      },
    ];
    const dmManifest = structuredClone(ownerManifest);

    expect(
      applyActiveSpellGrantOverlays([selectedSpell], dmManifest),
    ).toEqual(applyActiveSpellGrantOverlays([selectedSpell], ownerManifest));
  });
});
