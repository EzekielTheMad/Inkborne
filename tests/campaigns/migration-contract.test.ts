import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "00041_campaign_authorization_foundation.sql",
  ),
  "utf8",
);

describe("campaign authorization migration contract", () => {
  it("keeps recursive RLS helpers in a non-exposed schema", () => {
    expect(migration).toContain("CREATE SCHEMA IF NOT EXISTS private");
    expect(migration).toContain("private.is_campaign_owner");
    expect(migration).toContain("private.is_campaign_member");
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain(
      "GRANT USAGE ON SCHEMA private TO authenticated;",
    );
    expect(migration).not.toContain(
      "GRANT USAGE ON SCHEMA private TO authenticated, service_role;",
    );
  });

  it("hardens existing public functions before adding campaign APIs", () => {
    expect(migration).toContain(
      "ALTER FUNCTION public.handle_new_user() SET search_path = '';",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;",
    );
    expect(migration).toContain(
      "ALTER FUNCTION public.patch_character_state(uuid, jsonb) SET search_path = '';",
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.patch_character_state(uuid, jsonb) FROM PUBLIC, anon;",
    );
  });

  it("bootstraps owner membership and removes arbitrary player self-insert", () => {
    expect(migration).toContain("add_campaign_owner_membership");
    expect(migration).toContain("join_campaign_by_invite_code");
    expect(migration).toMatch(
      /CREATE POLICY "Campaign owner can add players"[\s\S]*?AND role = 'player'/,
    );
    expect(migration).not.toMatch(
      /CREATE POLICY "Campaign owner can add players"[\s\S]*?OR user_id = \(SELECT auth\.uid\(\)\)/,
    );
  });

  it("keeps DM character access read-only", () => {
    expect(migration).toContain("private.can_view_character(character_id)");
    expect(migration).toMatch(
      /CREATE POLICY "Owner can update characters"[\s\S]*?USING \(user_id = \(SELECT auth\.uid\(\)\)\)/,
    );
  });

  it("defines only campaign and DM-only page audiences", () => {
    expect(migration).toContain("CREATE TABLE public.campaign_pages");
    expect(migration).toContain("CHECK (visibility IN ('campaign', 'dm_only'))");
    expect(migration).toContain(
      "REVOKE ALL ON public.campaign_pages FROM PUBLIC, anon;",
    );
    expect(migration).not.toContain("visibility IN ('campaign', 'dm_only', 'public')");
  });

  it("indexes campaign foreign keys used by policies and joins", () => {
    expect(migration).toContain("idx_campaigns_system_id");
    expect(migration).toContain("idx_characters_user_id");
    expect(migration).toContain("idx_characters_system_id");
    expect(migration).toContain("idx_character_content_refs_content_id");
    expect(migration).toContain("idx_character_rolls_user_id");
  });
});
