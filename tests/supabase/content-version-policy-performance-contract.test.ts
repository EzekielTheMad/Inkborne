import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const foundationSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260720171627_content_version_pinning_and_rls.sql",
  ),
  "utf8",
);

const hardeningSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260720173545_content_version_policy_performance.sql",
  ),
  "utf8",
);

describe("content version hardening migration contract", () => {
  it("preserves the formerly current version when upgrading linked rows", () => {
    expect(foundationSql).toMatch(
      /UPDATE public\.character_inventory AS item[\s\S]*SET content_version = definition\.version/,
    );
    expect(foundationSql).toMatch(
      /UPDATE public\.character_spells AS spell[\s\S]*SET content_version = definition\.version/,
    );
    expect(foundationSql).not.toMatch(
      /UPDATE public\.character_(?:inventory|spells)[\s\S]{0,80}SET content_version = 1/,
    );
  });

  it("indexes every foreign key reported by the advisor", () => {
    for (const indexName of [
      "idx_character_content_refs_content_version",
      "idx_content_definitions_owner_id",
      "idx_content_shares_campaign_id",
      "idx_content_shares_shared_by",
      "idx_content_type_shares_campaign_id",
      "idx_content_type_shares_shared_by",
      "idx_custom_content_types_owner_id",
    ]) {
      expect(hardeningSql).toContain(indexName);
    }
  });

  it("authorizes historical snapshots from their immutable envelope", () => {
    const helper = hardeningSql.match(
      /CREATE OR REPLACE FUNCTION private\.can_use_content_version[\s\S]*?\$\$;/,
    )?.[0];

    expect(helper).toBeDefined();
    expect(helper).toContain("version.scope_snapshot = 'platform'");
    expect(helper).toContain(
      "version.owner_id_snapshot = (SELECT auth.uid())",
    );
    expect(helper).toContain(
      "version.system_id_snapshot = character.system_id",
    );
    expect(helper).not.toContain("definition.scope");
    expect(helper).not.toContain("definition.owner_id");
  });

  it("keeps catalog visibility version-aware while preserving exact references", () => {
    const policy = hardeningSql.match(
      /CREATE POLICY "Visible catalog or referenced versions can be read"[\s\S]*?\n  \);/,
    )?.[0];

    expect(policy).toBeDefined();
    expect(policy).toContain("scope_snapshot = 'platform'");
    expect(policy).toContain("owner_id_snapshot = (SELECT auth.uid())");
    expect(policy).toContain(
      "ref.content_version = content_versions.version",
    );
    expect(policy).not.toContain(
      "FROM public.content_definitions AS definition",
    );
  });

  it("freezes feature manifests at controller selection and exposes them read-only", () => {
    expect(hardeningSql).toContain(
      "CREATE TABLE public.character_feature_grants",
    );
    expect(hardeningSql).toContain(
      "candidate.created_at <= controller.created_at",
    );
    expect(hardeningSql).toContain(
      "CREATE TRIGGER materialize_feature_grants",
    );
    expect(hardeningSql).toContain(
      "SELECT private.materialize_feature_grants_for_ref(ref.id)",
    );
    expect(hardeningSql).toContain(
      "GRANT SELECT ON public.character_feature_grants",
    );
    expect(hardeningSql).not.toMatch(
      /GRANT (?:INSERT|UPDATE|DELETE)[^;]*character_feature_grants/,
    );
  });

  it("makes derived feature activation idempotent and lifecycle-bound", () => {
    expect(hardeningSql).toContain(
      "ADD CONSTRAINT character_content_refs_feature_grant_id_key",
    );
    expect(hardeningSql).toMatch(
      /feature_grant_id uuid[\s\S]*REFERENCES public\.character_feature_grants\(id\)[\s\S]*ON DELETE CASCADE/,
    );
  });

  it("rejects copying content unavailable in the destination campaign", () => {
    const copyFunction = hardeningSql.match(
      /CREATE OR REPLACE FUNCTION public\.copy_character[\s\S]*?\$\$;/,
    )?.[0];

    expect(copyFunction).toBeDefined();
    expect(copyFunction).toContain(
      "private.can_use_content_version(\n      new_character_id",
    );
    expect(copyFunction).toContain(
      "Character contains content unavailable to the target campaign",
    );
    expect(copyFunction).toContain("ref.feature_grant_id IS NULL");
  });

  it("consolidates definition reads into one optimized policy", () => {
    expect(hardeningSql).toContain(
      'DROP POLICY IF EXISTS "Platform content visible to all"',
    );
    expect(hardeningSql).toContain(
      'DROP POLICY IF EXISTS "Personal content visible to owner"',
    );
    expect(hardeningSql).toContain(
      'DROP POLICY IF EXISTS "Shared content visible to owner and campaign members"',
    );
    expect(hardeningSql).toContain(
      'CREATE POLICY "Catalog content visible to authorized users"',
    );
    expect(hardeningSql).toContain(
      "owner_id = (SELECT auth.uid())",
    );
  });
});
