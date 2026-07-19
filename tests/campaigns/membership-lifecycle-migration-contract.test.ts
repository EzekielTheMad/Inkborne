import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/00044_campaign_membership_lifecycle.sql"),
  "utf8",
).toLowerCase();

describe("campaign membership lifecycle migration contract", () => {
  it("prevents a campaign owner from leaving or removing themselves", () => {
    expect(migration).toContain("campaign owners cannot leave their own campaign");
    expect(migration).toContain("campaign owners cannot remove themselves");
  });

  it("restricts member removal to the campaign owner", () => {
    expect(migration).toContain("private.is_campaign_owner(target_campaign_id)");
    expect(migration).toContain("only the campaign owner can remove members");
  });

  it("detaches affected characters before deleting membership", () => {
    expect(migration.match(/update public\.characters/g)).toHaveLength(2);
    expect(migration.match(/set campaign_id = null/g)).toHaveLength(2);
    expect(migration.match(/delete from public\.campaign_members/g)).toHaveLength(2);
    expect(migration.indexOf("update public.characters")).toBeLessThan(
      migration.indexOf("delete from public.campaign_members"),
    );
  });

  it("uses narrow authenticated security-definer functions", () => {
    expect(migration.match(/security definer/g)).toHaveLength(2);
    expect(migration.match(/set search_path = ''/g)).toHaveLength(2);
    expect(migration).toContain("grant execute on function public.leave_campaign");
    expect(migration).toContain("grant execute on function public.remove_campaign_member");
  });
});
