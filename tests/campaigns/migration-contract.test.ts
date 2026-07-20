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

const leastPrivilegeMigration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "00045_campaign_api_least_privilege.sql",
  ),
  "utf8",
);

const policyPerformanceMigration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "00046_campaign_policy_performance.sql",
  ),
  "utf8",
);

const portraitStorageMigration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "00047_portrait_bucket_listing_hardening.sql",
  ),
  "utf8",
);

const portraitPolicyQualificationMigration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "00048_portrait_bucket_policy_qualification.sql",
  ),
  "utf8",
);

const campaignReturningMigration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "00049_campaign_insert_returning_visibility.sql",
  ),
  "utf8",
);

const inviteRotationMigration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "00050_invite_rotation_pgcrypto_qualification.sql",
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

  it("removes legacy anonymous RPC and excess page privileges", () => {
    expect(leastPrivilegeMigration).toContain(
      "REVOKE ALL ON public.campaign_pages FROM PUBLIC, anon, authenticated;",
    );
    expect(leastPrivilegeMigration).toContain(
      "ON public.campaign_pages TO authenticated;",
    );

    for (const signature of [
      "public.join_campaign_by_invite_code(text)",
      "public.rotate_campaign_invite_code(uuid)",
      "public.copy_character(uuid, uuid, text)",
      "public.create_campaign_page(uuid, text, text, uuid)",
      "public.update_campaign_page(uuid, bigint, text, jsonb, text)",
      "public.leave_campaign(uuid)",
      "public.remove_campaign_member(uuid, uuid)",
    ]) {
      expect(leastPrivilegeMigration).toContain(
        `REVOKE ALL ON FUNCTION ${signature}`,
      );
    }
  });

  it("makes least privilege the default for future public APIs", () => {
    expect(leastPrivilegeMigration).toContain(
      "REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;",
    );
    expect(leastPrivilegeMigration).toContain(
      "REVOKE ALL ON TABLES FROM anon, authenticated;",
    );
    expect(leastPrivilegeMigration).toContain(
      "REVOKE ALL ON SEQUENCES FROM anon, authenticated;",
    );
  });

  it("indexes every campaign page foreign key", () => {
    expect(policyPerformanceMigration).toContain(
      "idx_campaign_pages_parent_id",
    );
    expect(policyPerformanceMigration).toContain(
      "idx_campaign_pages_updated_by",
    );
  });

  it("keeps owner mutations separate from shared inventory and spell reads", () => {
    expect(policyPerformanceMigration).toContain(
      'DROP POLICY IF EXISTS "Owner can manage inventory"',
    );
    expect(policyPerformanceMigration).toContain(
      'CREATE POLICY "Owner can insert inventory"',
    );
    expect(policyPerformanceMigration).toContain(
      'CREATE POLICY "Owner can update inventory"',
    );
    expect(policyPerformanceMigration).toContain(
      'CREATE POLICY "Owner can delete inventory"',
    );
    expect(policyPerformanceMigration).toContain(
      'DROP POLICY IF EXISTS "Owner can manage spells"',
    );
    expect(policyPerformanceMigration).toContain(
      'CREATE POLICY "Owner can insert spells"',
    );
    expect(policyPerformanceMigration).toContain(
      'CREATE POLICY "Owner can update spells"',
    );
    expect(policyPerformanceMigration).toContain(
      'CREATE POLICY "Owner can delete spells"',
    );
    expect(policyPerformanceMigration).toContain(
      "character.user_id = (SELECT auth.uid())",
    );
  });

  it("keeps public portrait URLs without public object listing", () => {
    expect(portraitStorageMigration).toContain(
      'DROP POLICY IF EXISTS "Public read access for character portraits"',
    );
    expect(portraitStorageMigration).toContain(
      'CREATE POLICY "Owners can list character images"',
    );
    expect(portraitStorageMigration).toContain("TO authenticated");
    expect(portraitStorageMigration).toContain(
      "character.user_id = (SELECT auth.uid())",
    );
    expect(portraitStorageMigration).not.toContain("TO public");
  });

  it("qualifies the outer storage object path in portrait policies", () => {
    expect(portraitPolicyQualificationMigration).toContain(
      "storage.foldername(storage.objects.name)",
    );
    expect(portraitPolicyQualificationMigration).toContain(
      "owned_character.user_id = (SELECT auth.uid())",
    );
  });

  it("makes newly inserted campaigns visible to RETURNING", () => {
    expect(campaignReturningMigration).toContain(
      'DROP POLICY IF EXISTS "Campaign visible to authorized users"',
    );
    expect(campaignReturningMigration).toContain(
      "owner_id = (SELECT auth.uid())",
    );
    expect(campaignReturningMigration).toContain(
      "OR private.is_campaign_member(id)",
    );
    expect(campaignReturningMigration).not.toContain(
      "private.can_access_campaign(id)",
    );
  });

  it("resolves pgcrypto under the invite RPC's fixed search path", () => {
    expect(inviteRotationMigration).toContain(
      "extensions.gen_random_bytes(12)",
    );
    expect(inviteRotationMigration).toContain("pg_catalog.encode(");
    expect(inviteRotationMigration).toContain("SET search_path = ''");
    expect(inviteRotationMigration).toContain(
      "FROM PUBLIC, anon;",
    );
  });
});
