import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const normalize = (value: string) => value.replace(/\r\n/g, "\n");
const base = normalize(readFileSync("supabase/migrations/20260722044333_background_authoring_sharing.sql", "utf8"));
const sql = normalize(readFileSync("supabase/staged/item-campaign-sharing.sql", "utf8"));

function assertSnapshotContract(source: string) {
  const update = source.indexOf("UPDATE public.content_definitions AS definition");
  const snapshot = source.indexOf("SELECT snapshot_row.*");
  const result = source.indexOf("RETURN NEXT;");
  expect(update).toBeGreaterThanOrEqual(0);
  expect(snapshot).toBeGreaterThanOrEqual(0);
  expect(result).toBeGreaterThanOrEqual(0);
  expect(update).toBeLessThan(snapshot); expect(snapshot).toBeLessThan(result);
  expect(source).toContain("snapshot_row.content_id = locked_definition.id AND snapshot_row.version = item_expected_version");
  for (const key of ["system_id", "content_type", "source", "owner_id", "slug", "name", "scope", "data", "effects"]) expect(source).toContain("item_snapshot." + key + "_snapshot");
  expect(source).toContain("version IS DISTINCT FROM item_expected_version");
  expect(source).toContain("scope IS DISTINCT FROM derived_scope");
  expect(source).toContain("RAISE EXCEPTION 'Exact ordinary item written snapshot unavailable'");
  expect(source).not.toContain("EXCEPTION WHEN"); expect(source).not.toContain("UPDATE public.characters");
}

describe("UNAPPLIED item sharing SQL source contract (no SQL engine)", () => {
  it("preserves exact original three-type bodies/grants after removing isolated item-only checks", () => {
    const core = sql.slice(sql.indexOf("-- Extend the existing"), sql.lastIndexOf("\nCOMMIT;"))
      .replace(/  -- BEGIN ITEM [^\n]+\n[\s\S]*?  -- END ITEM [^\n]+\n/g, "")
      .replaceAll("('spell', 'feat', 'background', 'item')", "('spell', 'feat', 'background')");
    expect(core.trim()).toBe(base.trim());
    expect(sql).toContain("BEGIN;"); expect(sql.trimEnd()).toMatch(/COMMIT;$/);
  });
  it("checks exact same-transaction RETURNING version/scope/snapshot before any success row", () => {
    assertSnapshotContract(sql);
  });
  it.each([
    "snapshot_row.content_id = locked_definition.id AND snapshot_row.version = item_expected_version",
    "item_snapshot.effects_snapshot",
    "version IS DISTINCT FROM item_expected_version",
    "scope IS DISTINCT FROM derived_scope",
    "RAISE EXCEPTION 'Exact ordinary item written snapshot unavailable'",
  ])("static oracle detects removal of mandatory snapshot source %s", clause => {
    expect(sql).toContain(clause);
    expect(() => assertSnapshotContract(sql.replaceAll(clause, "REMOVED_REQUIRED_SOURCE"))).toThrow();
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
