import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260721163000_mpmb_import_selection_internal_repair.sql",
  ),
  "utf8",
)
  .replaceAll("\r\n", "\n")
  .toLowerCase();

const repairedFunction = migration.match(
  /create or replace function public\.set_mpmb_import_item_selected_retryable_internal[\s\S]*?\n\$\$;/,
)?.[0];

describe("MPMB import selection internal repair migration contract", () => {
  it("recreates the renamed implementation without its stale function qualifier", () => {
    expect(repairedFunction).toBeDefined();
    expect(repairedFunction).toContain("selected boolean");
    expect(repairedFunction).toContain("set selected = $3");
    expect(repairedFunction).not.toContain(
      "set_mpmb_import_item_selected.selected",
    );
  });

  it("preserves authentication, validation, ownership, and optimistic locking", () => {
    expect(repairedFunction).toContain(
      "actor_id uuid := (select auth.uid())",
    );
    expect(repairedFunction).toMatch(
      /if actor_id is null[\s\S]*?'authentication required'[\s\S]*?errcode = '42501'/,
    );
    expect(repairedFunction).toMatch(
      /target_import_id is null or target_item_id is null or selected is null[\s\S]*?expected_revision is null or expected_revision < 1[\s\S]*?'import selection input is invalid'[\s\S]*?errcode = '22023'/,
    );
    expect(repairedFunction).toMatch(
      /from public\.content_imports as import_record[\s\S]*?import_record\.owner_id = actor_id[\s\S]*?import_record\.status = 'review'[\s\S]*?for update/,
    );
    expect(repairedFunction).toMatch(
      /current_revision is distinct from expected_revision[\s\S]*?'import review changed in another session'[\s\S]*?errcode = '40001'/,
    );
  });

  it("preserves valid-item selection, revision increments, and result counts", () => {
    expect(repairedFunction).toMatch(
      /update public\.content_import_items as item[\s\S]*?set selected = \$3[\s\S]*?item\.id = target_item_id[\s\S]*?item\.import_id = target_import_id[\s\S]*?item\.mapping_status = 'valid'/,
    );
    expect(repairedFunction).toMatch(
      /if not found then[\s\S]*?'only valid items in this import can be selected'[\s\S]*?errcode = '22023'/,
    );
    expect(repairedFunction).toMatch(
      /update public\.content_imports as import_record[\s\S]*?revision = import_record\.revision \+ 1[\s\S]*?returning import_record\.revision into revision/,
    );
    expect(repairedFunction).toMatch(
      /select count\(\*\)[\s\S]*?into selected_count[\s\S]*?item\.import_id = target_import_id[\s\S]*?item\.selected[\s\S]*?return next/,
    );
  });

  it("keeps the implementation private and only the public wrapper authenticated", () => {
    expect(repairedFunction).toContain("security definer");
    expect(repairedFunction).toContain("set search_path = ''");
    expect(migration).toMatch(
      /revoke all on function public\.set_mpmb_import_item_selected_retryable_internal\([\s\S]*?uuid, uuid, boolean, integer[\s\S]*?\) from public, anon, authenticated, service_role/,
    );
    expect(migration).not.toMatch(
      /grant execute on function public\.set_mpmb_import_item_selected_retryable_internal/,
    );
    expect(migration).toMatch(
      /revoke all on function public\.set_mpmb_import_item_selected\([\s\S]*?uuid, uuid, boolean, integer[\s\S]*?\) from public, anon, authenticated, service_role/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.set_mpmb_import_item_selected\([\s\S]*?uuid, uuid, boolean, integer[\s\S]*?\) to authenticated/,
    );
  });
});
