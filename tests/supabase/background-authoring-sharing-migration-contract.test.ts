import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260722044333_background_authoring_sharing.sql",
  ),
  "utf8",
)
  .replaceAll("\r\n", "\n")
  .toLowerCase();

const shareFunction = migration.match(
  /create or replace function public\.set_content_campaign_share[\s\S]*?\n\$\$;/,
)?.[0];
const campaignListFunction = migration.match(
  /create or replace function public\.list_campaign_shared_content_for_owner[\s\S]*?\n\$\$;/,
)?.[0];

describe("background authoring and sharing migration contract", () => {
  it("widens the existing narrow sharing boundary only to backgrounds", () => {
    expect(shareFunction).toBeDefined();
    expect(shareFunction).toContain(
      "definition.content_type in ('spell', 'feat', 'background')",
    );
    expect(shareFunction).toContain("definition.source = 'homebrew'");
    expect(shareFunction).toContain("definition.is_retired = false");
    expect(shareFunction).toMatch(
      /from public\.content_import_origins as origin[\s\S]*?origin\.content_id = locked_definition\.id/,
    );
  });

  it("preserves owner grants, exact-campaign DM revocation, and optimistic versions", () => {
    expect(shareFunction).toMatch(
      /if enabled then[\s\S]*?locked_definition\.owner_id is distinct from actor_id/,
    );
    expect(shareFunction).toMatch(
      /else[\s\S]*?locked_definition\.owner_id is distinct from actor_id[\s\S]*?campaign_owner_id is distinct from actor_id/,
    );
    expect(shareFunction).toContain(
      "locked_definition.version is distinct from expected_version",
    );
    expect(shareFunction).toContain("errcode = '40001'");
    expect(shareFunction).toMatch(
      /when shared_campaign_count > 0 then 'shared'[\s\S]*?else 'personal'/,
    );
  });

  it("keeps security-definer functions narrowly granted and search paths fixed", () => {
    expect(shareFunction).toContain("security definer");
    expect(shareFunction).toContain("set search_path = ''");
    expect(migration).toMatch(
      /revoke all on function public\.set_content_campaign_share\(uuid, uuid, boolean, integer\)[\s\S]*?from public, anon, authenticated, service_role/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.set_content_campaign_share\(uuid, uuid, boolean, integer\)[\s\S]*?to authenticated/,
    );
  });

  it("lets campaign owners list shared backgrounds without edit authority", () => {
    expect(campaignListFunction).toBeDefined();
    expect(campaignListFunction).toContain(
      "definition.content_type in ('spell', 'feat', 'background')",
    );
    expect(campaignListFunction).toMatch(
      /from public\.campaigns as campaign[\s\S]*?campaign\.owner_id = actor_id/,
    );
    expect(campaignListFunction).not.toContain("update public.content_definitions");
    expect(campaignListFunction).not.toContain("insert into public.content_shares");
  });
});
