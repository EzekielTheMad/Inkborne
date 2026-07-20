import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260720185127_feature_grant_integrity.sql",
  ),
  "utf8",
);

describe("feature grant integrity migration contract", () => {
  it("ties every grant to a controller ref for the same character", () => {
    expect(migration).toMatch(
      /UNIQUE \(id, character_id\)/,
    );
    expect(migration).toMatch(
      /FOREIGN KEY \(controller_ref_id, character_id\)[\s\S]*?REFERENCES public\.character_content_refs\(id, character_id\)[\s\S]*?ON DELETE CASCADE/,
    );
  });

  it("ties a derived ref to the grant character and exact feature snapshot", () => {
    expect(migration).toMatch(
      /UNIQUE \(id, character_id, feature_content_id, feature_version\)/,
    );
    expect(migration).toMatch(
      /FOREIGN KEY \(\s*feature_grant_id,\s*character_id,\s*content_id,\s*content_version\s*\)[\s\S]*?REFERENCES public\.character_feature_grants\(\s*id,\s*character_id,\s*feature_content_id,\s*feature_version\s*\)[\s\S]*?ON DELETE CASCADE/,
    );
  });

  it("fails closed if hostile pre-migration links violate either identity", () => {
    expect(migration).toContain(
      "grant_row.character_id IS DISTINCT FROM controller.character_id",
    );
    expect(migration).toContain(
      "derived_ref.character_id IS DISTINCT FROM grant_row.character_id",
    );
    expect(migration).toContain(
      "derived_ref.content_id IS DISTINCT FROM grant_row.feature_content_id",
    );
    expect(migration).toContain(
      "derived_ref.content_version IS DISTINCT FROM grant_row.feature_version",
    );
  });

  it("checks exact snapshot access from immutable character and campaign data", () => {
    const helper = migration.match(
      /CREATE OR REPLACE FUNCTION private\.character_can_access_content_version[\s\S]*?\$\$;/,
    )?.[0];

    expect(helper).toBeDefined();
    expect(helper).toContain(
      "version.system_id_snapshot = character.system_id",
    );
    expect(helper).toContain("version.scope_snapshot = 'platform'");
    expect(helper).toContain(
      "version.owner_id_snapshot = character.user_id",
    );
    expect(helper).toContain("version.scope_snapshot = 'shared'");
    expect(helper).toContain("share.content_id = version.content_id");
    expect(helper).toContain(
      "share.campaign_id = character.campaign_id",
    );
    expect(helper).toContain("member.user_id = character.user_id");
    expect(helper).not.toContain("auth.uid()");
  });

  it("keeps the auth-independent access helper private and hardened", () => {
    expect(migration).toMatch(
      /CREATE OR REPLACE FUNCTION private\.character_can_access_content_version[\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path = ''/,
    );
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION private\.character_can_access_content_version\([\s\S]*?\) FROM PUBLIC, anon, authenticated/,
    );
    expect(migration).not.toMatch(
      /GRANT EXECUTE ON FUNCTION private\.character_can_access_content_version/,
    );
  });

  it("filters every dependency candidate through target-character access", () => {
    const materializer = migration.match(
      /CREATE OR REPLACE FUNCTION private\.materialize_feature_grants_for_ref[\s\S]*?\$\$;/,
    )?.[0];

    expect(materializer).toBeDefined();
    expect(materializer).toMatch(
      /private\.character_can_access_content_version\(\s*controller\.character_id,\s*candidate\.content_id,\s*candidate\.version\s*\)/,
    );
    expect(materializer).toContain(
      "candidate.created_at <= controller.created_at",
    );
    expect(materializer).not.toContain("public.content_definitions");
  });

  it("rejects any inaccessible legacy grant before replacing the materializer", () => {
    expect(migration).toMatch(
      /FROM public\.character_feature_grants AS grant_row[\s\S]*?private\.character_can_access_content_version\([\s\S]*?\) IS NOT TRUE[\s\S]*?existing feature dependency is inaccessible/,
    );
  });
});
