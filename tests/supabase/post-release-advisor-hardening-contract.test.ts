import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260720185556_post_release_advisor_hardening.sql",
  ),
  "utf8",
);

describe("post-release database advisor hardening", () => {
  it("covers every new composite foreign key used by the release", () => {
    for (const index of [
      "idx_character_content_refs_feature_grant_identity",
      "idx_character_feature_grants_controller_character",
      "idx_character_spell_grants_controller_character",
      "idx_character_spells_spell_grant_identity",
      "idx_srd_import_batches_system_id",
      "idx_srd_import_staging_batch_system",
    ]) {
      expect(migration).toContain(`CREATE INDEX IF NOT EXISTS ${index}`);
    }
  });

  it("uses statement-cached auth identities in every recreated policy", () => {
    const policies = migration.match(/CREATE POLICY[\s\S]*?;/g) ?? [];
    expect(policies.length).toBeGreaterThanOrEqual(15);
    for (const policy of policies) {
      expect(policy).not.toMatch(/(?<!SELECT )auth\.uid\(\)/);
      if (policy.includes("uid()")) {
        expect(policy).toContain("(SELECT auth.uid())");
      }
    }
  });

  it("combines custom type visibility into one permissive select policy", () => {
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Personal custom types visible to owner"',
    );
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Shared custom types visible to owner and campaign members"',
    );
    expect(migration).toContain(
      'CREATE POLICY "Authorized users can view custom content types"',
    );
  });
});
