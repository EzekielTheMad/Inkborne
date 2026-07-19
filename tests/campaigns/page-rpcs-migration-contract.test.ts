import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/00043_campaign_page_rpcs.sql"),
  "utf8",
).toLowerCase();

describe("campaign page RPC migration contract", () => {
  it("derives page authorship from the authenticated user", () => {
    expect(migration).toContain("actor_id uuid := auth.uid()");
    expect(migration).toContain("private.can_access_campaign(target_campaign_id)");
    expect(migration).toMatch(/actor_id,\s*actor_id,\s*page_title/);
  });

  it("only permits campaign or DM-only visibility", () => {
    expect(migration).toContain("page_visibility not in ('campaign', 'dm_only')");
  });

  it("does not let a player attach content beneath a hidden page they cannot view", () => {
    expect(migration).toContain("parent page not found or unavailable");
    expect(migration).toContain("parent.created_by = actor_id");
    expect(migration).toContain("parent.visibility = 'campaign'");
  });

  it("allows only the creator or campaign owner to edit", () => {
    expect(migration).toContain("private.is_campaign_owner(existing_page.campaign_id)");
    expect(migration).toContain("existing_page.created_by = actor_id");
  });

  it("rejects stale revisions instead of overwriting newer work", () => {
    expect(migration).toContain("and revision = expected_revision");
    expect(migration).toContain("campaign page changed since it was opened");
    expect(migration).toContain("errcode = '40001'");
  });

  it("keeps security-definer functions on an empty search path", () => {
    expect(migration.match(/security definer/g)).toHaveLength(2);
    expect(migration.match(/set search_path = ''/g)).toHaveLength(2);
  });
});
