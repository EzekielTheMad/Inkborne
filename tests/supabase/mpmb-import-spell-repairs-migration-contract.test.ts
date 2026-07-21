import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720235712_mpmb_import_spell_repairs.sql",
  ),
  "utf8",
)
  .replaceAll("\r\n", "\n")
  .toLowerCase();

const repairFunction = migration.match(
  /create or replace function public\.repair_mpmb_import_spell_item[\s\S]*?\n\$\$;/,
)?.[0];

describe("MPMB guided spell repair migration contract", () => {
  it("adds durable diagnostic and user-edit audit columns", () => {
    expect(migration).toMatch(
      /add column resolved_diagnostics jsonb not null default '\[\]'::jsonb[\s\S]*?jsonb_typeof\(resolved_diagnostics\) = 'array'/,
    );
    expect(migration).toMatch(
      /add column user_edited_fields text\[\] not null default '\{\}'::text\[\][\s\S]*?user_edited_fields <@ array\['material', 'dc'\]::text\[\]/,
    );
    expect(migration).toContain("add column user_edited_at timestamptz");
  });

  it("defines the authenticated security-definer RPC with an empty search path", () => {
    expect(repairFunction).toBeDefined();
    expect(migration).toMatch(
      /repair_mpmb_import_spell_item\(\s*target_import_id uuid,\s*target_item_id uuid,\s*expected_revision integer,\s*repair_patch jsonb\s*\)[\s\S]*?returns table \(revision integer, mapping_status text, selected boolean\)/,
    );
    expect(repairFunction).toContain("security definer");
    expect(repairFunction).toContain("set search_path = ''");
    expect(repairFunction).toContain("actor_id uuid := (select auth.uid())");
    expect(repairFunction).toMatch(
      /if actor_id is null then[\s\S]*?errcode = '42501'/,
    );
  });

  it("serializes owner, open-review, revision, and item checks with row locks", () => {
    expect(repairFunction).toMatch(
      /from public\.content_imports as import_record[\s\S]*?import_record\.owner_id = actor_id[\s\S]*?import_record\.status = 'review'[\s\S]*?for update/,
    );
    expect(repairFunction).toMatch(
      /current_revision is distinct from expected_revision[\s\S]*?errcode = '40001'/,
    );
    expect(repairFunction).toMatch(
      /from public\.content_import_items as item[\s\S]*?item\.id = target_item_id[\s\S]*?item\.import_id = target_import_id[\s\S]*?item\.content_type = 'spell'[\s\S]*?item\.mapping_status = 'needs_info'[\s\S]*?item\.candidate_data is not null[\s\S]*?jsonb_typeof\(item\.candidate_data\) = 'object'[\s\S]*?item\.committed_content_id is null[\s\S]*?for update/,
    );
  });

  it("accepts a nonempty object containing only material and dc keys", () => {
    expect(repairFunction).toContain(
      "jsonb_typeof(repair_patch) is distinct from 'object'",
    );
    expect(repairFunction).toMatch(
      /not exists \([\s\S]*?jsonb_object_keys\(repair_patch\)[\s\S]*?\)/,
    );
    expect(repairFunction).toMatch(
      /jsonb_object_keys\(repair_patch\) as patch_key\(key\)[\s\S]*?patch_key\.key not in \('material', 'dc'\)/,
    );
  });

  it("validates bounded nonblank material text", () => {
    expect(repairFunction).toMatch(
      /jsonb_typeof\(repair_patch -> 'material'\) is distinct from 'string'/,
    );
    expect(repairFunction).toContain(
      "repaired_material := pg_catalog.btrim(repair_patch ->> 'material')",
    );
    expect(repairFunction).toMatch(
      /repaired_material !~ '\[\^\[:space:\]\]'[\s\S]*?pg_catalog\.char_length\(repaired_material\) > 500/,
    );
    expect(repairFunction).toMatch(
      /jsonb_typeof\(staged_item\.candidate_data -> 'components'\)[\s\S]*?staged_item\.candidate_data -> 'components' @> '\["m"\]'::jsonb/,
    );
  });

  it("validates the exact DC shape and supported values", () => {
    expect(repairFunction).toMatch(
      /jsonb_typeof\(repair_patch -> 'dc'\) is distinct from 'object'/,
    );
    expect(repairFunction).toMatch(
      /jsonb_object_keys\(repair_patch -> 'dc'\) as dc_key\(key\)[\s\S]*?dc_key\.key not in \('type', 'success'\)/,
    );
    expect(repairFunction).toMatch(
      /jsonb_object_keys\(repair_patch -> 'dc'\)[\s\S]*?\) <> 2/,
    );
    for (const ability of [
      "strength",
      "dexterity",
      "constitution",
      "intelligence",
      "wisdom",
      "charisma",
    ]) {
      expect(repairFunction).toContain(`'${ability}'`);
    }
    expect(repairFunction).toContain(
      "repair_patch -> 'dc' ->> 'success' not in ('half', 'none', 'other')",
    );
  });

  it("ties each patch key to its still-unresolved supported diagnostic", () => {
    expect(repairFunction).toMatch(
      /repair_patch \? 'material'[\s\S]*?jsonb_array_elements\(staged_item\.diagnostics\)[\s\S]*?diagnostic\.issue ->> 'code' = 'spell\.material\.required'[\s\S]*?diagnostic\.issue ->> 'severity' = 'blocking'/,
    );
    expect(repairFunction).toMatch(
      /repair_patch \? 'dc'[\s\S]*?jsonb_array_elements\(staged_item\.diagnostics\)[\s\S]*?diagnostic\.issue ->> 'code' = 'spell\.save\.success_unknown'[\s\S]*?diagnostic\.issue ->> 'severity' = 'blocking'/,
    );
  });

  it("patches only candidate material/DC and moves resolved issues into audit", () => {
    expect(repairFunction).toContain("updated_candidate_data := staged_item.candidate_data");
    expect(repairFunction).toMatch(
      /jsonb_set\(\s*updated_candidate_data,\s*'\{material\}'::text\[\],\s*pg_catalog\.to_jsonb\(repaired_material\)/,
    );
    expect(repairFunction).toMatch(
      /jsonb_set\(\s*updated_candidate_data,\s*'\{dc\}'::text\[\],\s*repair_patch -> 'dc'/,
    );
    expect(repairFunction).toMatch(
      /resolved_diagnostics = item\.resolved_diagnostics \|\| repaired_diagnostics/,
    );
    expect(repairFunction).toContain("diagnostics = remaining_diagnostics");
    expect(repairFunction).toContain(
      "user_edited_fields = item.user_edited_fields || repaired_fields",
    );
    expect(repairFunction).toContain("user_edited_at = pg_catalog.now()");
  });

  it("derives status and selection from the remaining blocking diagnostics", () => {
    expect(repairFunction).toMatch(
      /jsonb_array_elements\(remaining_diagnostics\)[\s\S]*?diagnostic\.issue ->> 'severity' = 'blocking'[\s\S]*?then 'needs_info'[\s\S]*?else 'valid'/,
    );
    expect(repairFunction).toContain("mapping_status = next_mapping_status");
    expect(repairFunction).toContain("selected = next_mapping_status = 'valid'");
  });

  it("recomputes summary counts and blocking count before incrementing revision", () => {
    for (const status of ["valid", "needs_info", "unsupported"]) {
      expect(repairFunction).toContain(
        `summary_item.mapping_status = '${status}'`,
      );
    }
    expect(repairFunction).toMatch(
      /'blockingissues',[\s\S]*?jsonb_array_elements\(summary_item\.diagnostics\)[\s\S]*?diagnostic\.issue ->> 'severity' = 'blocking'/,
    );
    expect(repairFunction).toMatch(
      /mapping_summary = import_record\.mapping_summary \|\| pg_catalog\.jsonb_build_object[\s\S]*?revision = import_record\.revision \+ 1/,
    );
    expect(repairFunction).toContain(
      "returning import_record.revision into revision",
    );
  });

  it("keeps table writes unavailable and grants only authenticated RPC execution", () => {
    const signature =
      "repair_mpmb_import_spell_item\\(\\s*uuid, uuid, integer, jsonb\\s*\\)";
    expect(migration).toMatch(
      new RegExp(
        `revoke all on function public\\.${signature}[\\s\\S]*?from public, anon, authenticated, service_role`,
      ),
    );
    expect(migration).toMatch(
      new RegExp(
        `grant execute on function public\\.${signature}[\\s\\S]*?to authenticated`,
      ),
    );
    expect(migration).not.toMatch(/grant (?:insert|update|delete|all).*content_import_items/);
  });
});
