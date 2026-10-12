import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const normalize = (value: string) => value.replace(/
/g, "
");
const base = normalize(readFileSync("supabase/migrations/20260722044333_background_authoring_sharing.sql", "utf8"));
const sql = normalize(readFileSync("supabase/staged/item-campaign-sharing.sql", "utf8"));
describe("UNAPPLIED item sharing SQL source contract (no SQL engine)", () => {
  it("preserves exact original three-type bodies/grants after removing isolated item-only checks", () => {
    const core = sql.slice(sql.indexOf("-- Extend the existing"), sql.lastIndexOf("
COMMIT;"))
      .replace(/  -- BEGIN ITEM [^
]+
[sS]*?  -- END ITEM [^
]+
/g, "")
      .replaceAll("('spell', 'feat', 'background', 'item')", "('spell', 'feat', 'background')");
    expect(core.trim()).toBe(base.trim());
    expect(sql).toContain("BEGIN;"); expect(sql.trimEnd()).toMatch(/COMMIT;$/);
  });
  it("checks exact same-transaction RETURNING version/scope/snapshot before any success row", () => {
    const update = sql.indexOf("UPDATE public.content_definitions AS definition"), snapshot = sql.indexOf("SELECT snapshot_row.*"), result = sql.indexOf("RETURN NEXT;");
    expect(update).toBeLessThan(snapshot); expect(snapshot).toBeLessThan(result);
    expect(sql).toContain("snapshot_row.content_id = locked_definition.id AND snapshot_row.version = item_expected_version");
    for (const key of ["system_id", "content_type", "source", "owner_id", "slug", "name", "scope", "data", "effects"]) expect(sql).toContain(`item_snapshot.${key}_snapshot`);
    expect(sql).toContain("version IS DISTINCT FROM item_expected_version");
    expect(sql).toContain("scope IS DISTINCT FROM derived_scope");
    expect(sql).toContain("RAISE EXCEPTION 'Exact ordinary item written snapshot unavailable'");
    expect(sql).not.toContain("EXCEPTION WHEN"); expect(sql).not.toContain("UPDATE public.characters");
  });
  it("retains actual owner/member/import/CAS locks plus bounded item published-system and exhaustion guards", () => {
    for (const clause of ["FOR UPDATE;", "FOR KEY SHARE;", "FOR SHARE;", "locked_definition.version IS DISTINCT FROM expected_version",
      "Only the content owner can grant campaign access", "public.content_import_origins", "member.user_id = actor_id",
      "Only the content owner or campaign owner can revoke access", "campaign_system_id IS DISTINCT FROM locked_definition.system_id",
      "locked_definition.scope NOT IN ('personal','shared')", "locked_definition.version = 2147483647",
      "item_system.slug IS DISTINCT FROM 'dnd-5e-2014'", "item_system.status IS DISTINCT FROM 'published'"]) expect(sql).toContain(clause);
    expect(sql).not.toMatch(/GRANT (?:INSERT|UPDATE|DELETE)/);
    expect(sql).not.toContain("content_type IN ('spell', 'feat', 'background', 'item',");
  });
});