import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260721232837_mpmb_schema_known_guided_repairs.sql",
  ),
  "utf8",
)
  .replaceAll("\r\n", "\n")
  .toLowerCase();

const stageFunction = migration.match(
  /create or replace function public\.stage_mpmb_import[\s\S]*?\n\$\$;/,
)?.[0];
const spellInternal = migration.match(
  /create or replace function public\.repair_mpmb_import_spell_item_retryable_internal[\s\S]*?\n\$\$;/,
)?.[0];
const featInternal = migration.match(
  /create function public\.repair_mpmb_import_feat_item_retryable_internal[\s\S]*?\n\$\$;/,
)?.[0];
const featWrapper = migration.match(
  /create function public\.repair_mpmb_import_feat_item\([\s\S]*?\n\$\$;/,
)?.[0];

describe("MPMB schema-known guided repairs migration contract", () => {
  it("deduplicates the same source within one mapper release only", () => {
    expect(migration).toContain(
      "drop constraint content_imports_owner_id_system_id_source_format_source_sha_key",
    );
    expect(migration).toContain(
      "unique (owner_id, system_id, source_format, source_sha256, mapper_version)",
    );
    expect(stageFunction).toBeDefined();
    expect(stageFunction).toMatch(
      /source_sha256 = stage_mpmb_import\.source_sha256\s+and import_record\.mapper_version = stage_mpmb_import\.mapper_version\s+for update/,
    );
    expect(stageFunction).toContain("when unique_violation then");
    expect(stageFunction?.match(/mapper_version = stage_mpmb_import\.mapper_version/g)).toHaveLength(
      2,
    );
  });

  it("expands the finite audit-field constraint without accepting arbitrary paths", () => {
    for (const field of [
      "material",
      "dc",
      "concentration",
      "ritual",
      "prerequisites",
      "action",
      "recovery",
      "spellcastingability",
    ]) {
      expect(migration).toContain(`'${field}'`);
    }
    expect(migration).toMatch(
      /user_edited_fields <@ array\[[\s\S]*?'spellcastingability'[\s\S]*?\]::text\[\]/,
    );
  });

  it("extends the private spell implementation while retaining its public wrapper", () => {
    expect(spellInternal).toBeDefined();
    expect(spellInternal).toContain("security definer");
    expect(spellInternal).toContain("set search_path = ''");
    expect(spellInternal).toMatch(
      /patch_key\.key not in \('material', 'dc', 'concentration', 'ritual'\)/,
    );
    expect(spellInternal).toContain(
      "jsonb_typeof(repair_patch -> 'concentration') is distinct from 'boolean'",
    );
    expect(spellInternal).toContain(
      "jsonb_typeof(repair_patch -> 'ritual') is distinct from 'boolean'",
    );
    expect(spellInternal).toContain("'spell.concentration.invalid'");
    expect(spellInternal).toContain("'spell.ritual.invalid'");
    expect(migration).not.toMatch(
      /create or replace function public\.repair_mpmb_import_spell_item\(/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.repair_mpmb_import_spell_item\(\s*uuid, uuid, integer, jsonb\s*\) to authenticated/,
    );
  });

  it("defines an authenticated feat wrapper over a private retryable implementation", () => {
    expect(featInternal).toBeDefined();
    expect(featWrapper).toBeDefined();
    expect(featInternal).toContain("security definer");
    expect(featInternal).toContain("set search_path = ''");
    expect(featWrapper).toContain(
      "from public.repair_mpmb_import_feat_item_retryable_internal(",
    );
    expect(featWrapper).toMatch(
      /when serialization_failure then\s+raise exception '%'\, sqlerrm using errcode = 'p0001'/,
    );
    expect(migration).toMatch(
      /revoke all on function public\.repair_mpmb_import_feat_item_retryable_internal\(\s*uuid, uuid, integer, jsonb\s*\) from public, anon, authenticated, service_role/,
    );
    expect(migration).toMatch(
      /revoke all on function public\.repair_mpmb_import_feat_item\(\s*uuid, uuid, integer, jsonb\s*\) from public, anon, authenticated, service_role;\s+grant execute on function public\.repair_mpmb_import_feat_item\(\s*uuid, uuid, integer, jsonb\s*\) to authenticated/,
    );
  });

  it("strictly validates every supported feat value", () => {
    expect(featInternal).toMatch(
      /patch_key\.key not in \(\s*'prerequisites', 'action', 'recovery', 'spellcastingability'\s*\)/,
    );
    expect(featInternal).toContain(
      "jsonb_array_length(repair_patch -> 'prerequisites') > 1",
    );
    for (const ability of [
      "strength",
      "dexterity",
      "constitution",
      "intelligence",
      "wisdom",
      "charisma",
    ]) {
      expect(featInternal).toContain(`'${ability}'`);
    }
    expect(featInternal).toContain("prerequisite.value ->> 'op' = 'gte'");
    expect(featInternal).toMatch(
      /prerequisite\.value ->> 'value'\)::numeric between 1 and 30/,
    );
    for (const value of [
      "action",
      "bonus action",
      "reaction",
      "free",
      "short rest",
      "long rest",
      "dawn",
      "day",
    ]) {
      expect(featInternal).toContain(`'${value}'`);
    }
    expect(featInternal).toContain(
      "updated_candidate_data := updated_candidate_data - 'spellcastingability'",
    );
  });

  it("binds repairs to blocking diagnostics on one owned, locked review item", () => {
    for (const fn of [spellInternal, featInternal]) {
      expect(fn).toMatch(
        /import_record\.owner_id = actor_id[\s\S]*?import_record\.status = 'review'[\s\S]*?for update/,
      );
      expect(fn).toMatch(
        /current_revision is distinct from expected_revision[\s\S]*?errcode = '40001'/,
      );
      expect(fn).toMatch(
        /item\.mapping_status = 'needs_info'[\s\S]*?jsonb_typeof\(item\.candidate_data\) = 'object'[\s\S]*?jsonb_typeof\(item\.candidate_effects\) = 'array'[\s\S]*?item\.committed_content_id is null[\s\S]*?for update/,
      );
      expect(fn).toContain("diagnostic.issue ->> 'severity' = 'blocking'");
    }
    for (const code of [
      "feat.prerequisite.ambiguous",
      "feat.prerequisite.compound",
      "feat.prerequisite.unsupported",
      "feat.prerequisite.invalid",
      "feat.prereqeval.not_automated",
      "feat.action.invalid",
      "feat.recovery.invalid",
      "feat.spellcastingability.invalid",
    ]) {
      expect(featInternal).toContain(`'${code}'`);
    }
    expect(featInternal).toMatch(
      /repair_patch \? 'prerequisites'[\s\S]*?diagnostic\.issue ->> 'code' = 'feat\.prereqeval\.not_automated'/,
    );
    expect(featInternal).toMatch(
      /where diagnostic\.issue ->> 'code' = any \(repaired_codes\)[\s\S]*?severity' = 'blocking'[\s\S]*?or \([\s\S]*?repair_patch \? 'prerequisites'[\s\S]*?feat\.prereqeval\.not_automated/,
    );
  });

  it("moves diagnostics, derives validity, refreshes summary, and invalidates preview", () => {
    for (const fn of [spellInternal, featInternal]) {
      expect(fn).toContain(
        "resolved_diagnostics = item.resolved_diagnostics || repaired_diagnostics",
      );
      expect(fn).toContain("diagnostics = remaining_diagnostics");
      expect(fn).toContain("mapping_status = next_mapping_status");
      expect(fn).toContain("selected = next_mapping_status = 'valid'");
      for (const status of ["valid", "needs_info", "unsupported"]) {
        expect(fn).toContain(`summary_item.mapping_status = '${status}'`);
      }
      expect(fn).toContain("revision = import_record.revision + 1");
      expect(fn).toContain("preview_validated_revision = null");
      expect(fn).toContain("preview_validated_at = null");
      expect(fn).not.toContain("candidate_effects =");
    }
  });
});
