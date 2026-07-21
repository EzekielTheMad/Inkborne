import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260720185149_feature_spell_grants.sql",
);
const migration = fs.readFileSync(migrationPath, "utf8");

describe("feature spell grant migration contract", () => {
  it("stores an immutable exact-version manifest owned by the controller ref", () => {
    expect(migration).toContain("CREATE TABLE public.character_spell_grants");
    expect(migration).toContain("controller_ref_id uuid NOT NULL");
    expect(migration).toContain("spell_content_id uuid NOT NULL");
    expect(migration).toContain("spell_version integer NOT NULL");
    expect(migration).toMatch(
      /FOREIGN KEY \(spell_content_id, spell_version\)[\s\S]*?REFERENCES public\.content_versions\(content_id, version\)[\s\S]*?ON DELETE RESTRICT/,
    );
    expect(migration).toContain("UNIQUE (controller_ref_id, spell_slug)");
  });

  it("resolves dependencies from snapshots as-of the controller snapshot", () => {
    expect(migration).toContain("controller.data_snapshot->'spellcastingExtra'");
    expect(migration).toContain("candidate.created_at <= controller.created_at");
    expect(migration).toContain("candidate.content_type_snapshot = 'spell'");
    expect(migration).toContain(
      "private.character_can_access_content_version(",
    );
    expect(migration).not.toMatch(
      /materialize_spell_grants_for_ref[\s\S]*?FROM public\.content_definitions/i,
    );
  });

  it("materializes on controller selection and baselines only pinned refs", () => {
    expect(migration).toMatch(
      /CREATE TRIGGER materialize_spell_grants[\s\S]*?ON public\.character_content_refs/,
    );
    expect(migration).toMatch(
      /SELECT private\.materialize_spell_grants_for_ref\(ref\.id\)[\s\S]*?JOIN public\.content_versions AS version/,
    );
  });

  it("keeps dormant grants while activation only changes derived spell rows", () => {
    const syncFunction = migration.match(
      /CREATE OR REPLACE FUNCTION public\.sync_character_spell_grants[\s\S]*?\$\$;/,
    )?.[0];
    expect(syncFunction).toBeDefined();
    expect(syncFunction).toContain("DELETE FROM public.character_spells");
    expect(syncFunction).toContain("INSERT INTO public.character_spells");
    expect(syncFunction).not.toContain("DELETE FROM public.character_spell_grants");
    expect(syncFunction).toContain(
      "private.active_character_spell_grant_representatives(",
    );
  });

  it("preserves selected acquisitions when an active grant overlaps", () => {
    const syncFunction = migration.match(
      /CREATE OR REPLACE FUNCTION public\.sync_character_spell_grants[\s\S]*?\$\$;/,
    )?.[0];
    expect(syncFunction).toBeDefined();
    expect(syncFunction).toContain("spell.source = 'feature'");
    expect(syncFunction).not.toContain("UPDATE public.character_spells");
    expect(syncFunction).toContain(
      "existing.content_id = grant_row.spell_content_id",
    );
    expect(syncFunction).toContain(
      "existing.class_slug = grant_row.class_slug",
    );
    expect(syncFunction).toContain("ON CONFLICT DO NOTHING");
    expect(syncFunction).toContain("active_grants_payload");
  });

  it("gives authorized read-only viewers the same representative manifest", () => {
    const readFunction = migration.match(
      /CREATE OR REPLACE FUNCTION public\.get_active_character_spell_grants[\s\S]*?\$\$;/,
    )?.[0];
    expect(readFunction).toBeDefined();
    expect(readFunction).toContain(
      "private.can_view_character(target_character_id)",
    );
    expect(readFunction).toContain(
      "private.active_character_spell_grant_representatives(",
    );
    expect(readFunction).not.toContain("INSERT INTO");
    expect(readFunction).not.toContain("UPDATE public");
    expect(readFunction).not.toContain("DELETE FROM");
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.get_active_character_spell_grants\(uuid\)[\s\S]*?FROM PUBLIC, anon/,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_active_character_spell_grants\(uuid\)[\s\S]*?TO authenticated/,
    );
  });

  it("links copied feature rows only to exact active pinned grants", () => {
    const guardFunction = migration.match(
      /CREATE OR REPLACE FUNCTION private\.enforce_character_spell_grant[\s\S]*?\$\$;/,
    )?.[0];
    expect(guardFunction).toBeDefined();
    expect(guardFunction).toContain(
      "candidate.spell_content_id = NEW.content_id",
    );
    expect(guardFunction).toContain(
      "candidate.spell_version = NEW.content_version",
    );
    expect(guardFunction).toContain(
      "private.is_character_spell_grant_active(candidate.id)",
    );
  });

  it("uses explicit least-privilege grants and RLS for the exposed table", () => {
    expect(migration).toContain(
      "ALTER TABLE public.character_spell_grants ENABLE ROW LEVEL SECURITY",
    );
    expect(migration).toMatch(
      /CREATE POLICY "Authorized users can view character spell grants"[\s\S]*?private\.can_view_character\(character_id\)/,
    );
    expect(migration).toMatch(
      /REVOKE ALL ON public\.character_spell_grants[\s\S]*?FROM PUBLIC, anon, authenticated/,
    );
    expect(migration).toMatch(
      /GRANT SELECT ON public\.character_spell_grants[\s\S]*?TO authenticated/,
    );
  });
});
