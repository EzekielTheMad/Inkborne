import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260722225247_fix_background_ref_null_boundary.sql",
  ),
  "utf8",
);

describe("background ref null-boundary migration", () => {
  it("treats an optional NULL choice source as a non-background source", () => {
    expect(migration).toContain(
      "COALESCE(OLD.choice_source = 'choice:background', false)",
    );
    expect(migration).toMatch(
      /new_uses_background_source := COALESCE\(\s*NEW\.choice_source = 'choice:background',\s*false\s*\)/,
    );
  });

  it("keeps exact snapshot detection and the RPC-only background guard", () => {
    expect(migration).toContain(
      "version.content_type_snapshot = 'background'",
    );
    expect(migration).toContain(
      "Background refs must be managed by set_character_background",
    );
    expect(migration).toContain(
      "current_setting('inkborne.background_choice_rpc', true)",
    );
    expect(migration).toContain(
      "RAISE EXCEPTION 'Background ref metadata is noncanonical'",
    );
    expect(migration).toContain(
      "pg_catalog.jsonb_build_object('source', 'background')",
    );
    expect(migration).toContain("NEW.feature_grant_id IS NOT NULL");
  });

  it("allows character deletion cascades without weakening normal deletes", () => {
    expect(migration).toMatch(
      /IF TG_OP = 'DELETE'\s+AND NOT EXISTS \(\s+SELECT 1\s+FROM public\.characters AS character\s+WHERE character\.id = OLD\.character_id\s+\)\s+THEN\s+RETURN OLD;/,
    );
    expect(migration).toContain("IF (old_is_background OR new_is_background)");
  });

  it("retains a fixed search path and no public trigger execution", () => {
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION private\.enforce_background_ref_boundary\(\)\s+FROM PUBLIC, anon, authenticated, service_role;/,
    );
  });
});
