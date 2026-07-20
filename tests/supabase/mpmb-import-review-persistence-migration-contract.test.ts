import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720233030_mpmb_import_review_persistence.sql",
  ),
  "utf8",
)
  .replaceAll("\r\n", "\n")
  .toLowerCase();

const stageFunction = migration.match(
  /create or replace function public\.stage_mpmb_import[\s\S]*?\n\$\$;/,
)?.[0];
const selectionFunction = migration.match(
  /create or replace function public\.set_mpmb_import_item_selected[\s\S]*?\n\$\$;/,
)?.[0];
const commitFunction = migration.match(
  /create or replace function public\.commit_mpmb_import[\s\S]*?\n\$\$;/,
)?.[0];
const sharingGuard = migration.match(
  /create or replace function private\.enforce_imported_content_sharing_rights[\s\S]*?\n\$\$;/,
)?.[0];

describe("MPMB import review persistence migration contract", () => {
  it("creates an owner-only review, item, and provenance model with RLS", () => {
    for (const table of [
      "content_imports",
      "content_import_items",
      "content_import_origins",
    ]) {
      expect(migration).toContain(`create table public.${table}`);
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migration).toMatch(
        new RegExp(
          `revoke all on public\\.${table}[\\s\\S]*?from public, anon, authenticated, service_role`,
        ),
      );
      expect(migration).toContain(`grant select on public.${table} to authenticated`);
    }
    expect(migration).toContain("owner_id = (select auth.uid())");
  });

  it("stores bounded provenance and review data but never raw source", () => {
    for (const column of [
      "original_filename",
      "source_sha256",
      "source_bytes",
      "parser_version",
      "mapper_version",
      "required_sheet_version",
      "source_metadata",
      "file_diagnostics",
      "mapping_summary",
      "rights_attestation_version",
    ]) {
      expect(migration).toContain(column);
    }
    expect(migration).not.toMatch(/raw_(?:source|javascript|file|bytes)/);
    expect(migration).not.toMatch(/source_(?:text|content|javascript)/);
    expect(migration).toContain("source_bytes between 1 and 2097152");
    expect(migration).toContain("pg_catalog.pg_column_size(mapped_items) > 8388608");
  });

  it("requires the exact private-use attestation and a published 2014 system", () => {
    expect(stageFunction).toBeDefined();
    expect(stageFunction).toContain("actor_id uuid := (select auth.uid())");
    expect(stageFunction).toContain("system.slug = 'dnd-5e-2014'");
    expect(stageFunction).toContain("system.status = 'published'");
    expect(stageFunction).toContain(
      "rights_attestation_version is distinct from 'private_use_v1'",
    );
  });

  it("stages only bounded, structurally valid mapped items and selects valid items", () => {
    expect(stageFunction).toContain("jsonb_array_length(mapped_items) > 1000");
    expect(stageFunction).toContain(
      "value.item ->> 'status' not in ('valid', 'needs_info', 'unsupported')",
    );
    expect(stageFunction).toContain(
      "value.item -> 'candidate' ->> 'content_type'",
    );
    expect(stageFunction).toContain(
      "jsonb_typeof(value.item -> 'candidate' -> 'data')",
    );
    expect(stageFunction).toContain(
      "jsonb_typeof(value.item -> 'candidate' -> 'effects')",
    );
    expect(stageFunction).toMatch(
      /insert into public\.content_import_items[\s\S]*?entry\.item ->> 'status' = 'valid'/,
    );
  });

  it("deduplicates accidental re-uploads by owner, system, format, and hash", () => {
    expect(migration).toContain(
      "unique (owner_id, system_id, source_format, source_sha256)",
    );
    expect(stageFunction).toMatch(
      /where import_record\.owner_id = actor_id[\s\S]*?import_record\.source_sha256 = stage_mpmb_import\.source_sha256[\s\S]*?for update/,
    );
    expect(stageFunction).toContain("when unique_violation then");
    expect(stageFunction).toMatch(
      /if staged_import_status = 'cancelled' then[\s\S]*?status = 'review'[\s\S]*?item\.mapping_status = 'valid'/,
    );
  });

  it("uses optimistic revisions and forbids selecting non-valid items", () => {
    expect(selectionFunction).toBeDefined();
    expect(selectionFunction).toContain("for update");
    expect(selectionFunction).toContain(
      "current_revision is distinct from expected_revision",
    );
    expect(selectionFunction).toContain("errcode = '40001'");
    expect(selectionFunction).toContain("item.mapping_status = 'valid'");
    expect(selectionFunction).toContain("revision = import_record.revision + 1");
  });

  it("commits selected valid items atomically as actor-owned private homebrew", () => {
    expect(commitFunction).toBeDefined();
    expect(commitFunction).toContain("for update");
    expect(commitFunction).toContain("item.mapping_status = 'valid'");
    expect(commitFunction).toContain("and item.selected");
    expect(commitFunction).toMatch(
      /insert into public\.content_definitions[\s\S]*?'homebrew',[\s\S]*?'personal',[\s\S]*?actor_id/,
    );
    expect(commitFunction).toMatch(
      /insert into public\.content_import_origins[\s\S]*?'private_only'/,
    );
    expect(commitFunction).toMatch(
      /status = 'completed',[\s\S]*?completed_at = pg_catalog\.now\(\)/,
    );
  });

  it("makes completed commit retries idempotently return existing definitions", () => {
    expect(commitFunction).toMatch(
      /if import_record\.status = 'completed' then[\s\S]*?join public\.content_definitions[\s\S]*?return;/,
    );
  });

  it("blocks every imported-content share write until a rights grant exists", () => {
    expect(sharingGuard).toBeDefined();
    expect(sharingGuard).toContain("security definer");
    expect(sharingGuard).toContain("set search_path = ''");
    expect(sharingGuard).toMatch(
      /from public\.content_import_origins as origin[\s\S]*?origin\.content_id = new\.content_id[\s\S]*?origin\.sharing_rights_status <> 'granted'/,
    );
    expect(migration).toMatch(
      /create trigger enforce_imported_content_sharing_rights[\s\S]*?before insert or update of content_id on public\.content_shares/,
    );
  });

  it("exposes mutations only through narrowly granted authenticated RPCs", () => {
    for (const signature of [
      "stage_mpmb_import\\(\\s*uuid, text, text, integer, text, text, text, jsonb, jsonb, jsonb, jsonb, text\\s*\\)",
      "set_mpmb_import_item_selected\\(uuid, uuid, boolean, integer\\)",
      "commit_mpmb_import\\(uuid, integer\\)",
      "cancel_mpmb_import\\(uuid\\)",
    ]) {
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
    }
  });
});
