import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260721160500_mpmb_import_preview_validation.sql",
  ),
  "utf8",
).toLowerCase();

describe("MPMB preview validation migration contract", () => {
  it("stores an exact revision stamp with consistent audit metadata", () => {
    expect(sql).toContain("add column preview_validated_revision integer");
    expect(sql).toContain("add column preview_validated_at timestamptz");
    expect(sql).toContain("preview_validated_revision <= revision");
    expect(sql).toContain("content_imports_preview_stamp_complete");
  });

  it("allows only the service role to stamp a validated preview", () => {
    expect(sql).toMatch(
      /create function public\.record_mpmb_import_preview\([\s\S]*?security definer[\s\S]*?set search_path = ''/,
    );
    expect(sql).toMatch(
      /revoke all on function public\.record_mpmb_import_preview\(uuid, uuid, integer\)[\s\S]*?from public, anon, authenticated, service_role/,
    );
    expect(sql).toMatch(
      /grant execute on function public\.record_mpmb_import_preview\(uuid, uuid, integer\)[\s\S]*?to service_role/,
    );
    expect(sql).toContain("import_record.owner_id = validated_owner_id");
    expect(sql).toContain("import_record.status = 'review'");
    expect(sql).toContain("current_revision is distinct from expected_revision");
  });

  it("blocks a current review commit without a current preview before writes", () => {
    const wrapperStart = sql.indexOf("create or replace function public.commit_mpmb_import");
    const wrapper = sql.slice(wrapperStart);
    const gate = wrapper.indexOf("validated_revision is distinct from current_revision");
    const delegate = wrapper.indexOf("commit_mpmb_import_retryable_internal");

    expect(wrapperStart).toBeGreaterThanOrEqual(0);
    expect(gate).toBeGreaterThanOrEqual(0);
    expect(delegate).toBeGreaterThan(gate);
    expect(wrapper).toContain("current_status = 'review'");
    expect(wrapper).toContain("current_revision is not distinct from expected_revision");
    expect(wrapper).toContain("preview the current import calculations before committing");
  });

  it("keeps the public commit grant least-privileged", () => {
    expect(sql).toMatch(
      /revoke all on function public\.commit_mpmb_import\(uuid, integer\)[\s\S]*?from public, anon, authenticated, service_role/,
    );
    expect(sql).toMatch(
      /grant execute on function public\.commit_mpmb_import\(uuid, integer\)[\s\S]*?to authenticated/,
    );
  });
});
