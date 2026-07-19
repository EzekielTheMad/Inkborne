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
    expect(migration).not.toContain("visibility IN ('campaign', 'dm_only', 'public')");
  });
});
