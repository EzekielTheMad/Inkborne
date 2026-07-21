import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260721041927_mpmb_import_conflict_resolution.sql",
  ),
  "utf8",
)
  .replaceAll("\r\n", "\n")
  .toLowerCase();

const indexHardeningMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260721044200_mpmb_import_conflict_index_hardening.sql",
  ),
  "utf8",
)
  .replaceAll("\r\n", "\n")
  .toLowerCase();

const listFunction = migration.match(
  /create or replace function public\.list_mpmb_import_item_conflicts[\s\S]*?\n\$\$;/,
)?.[0];
const resolveFunction = migration.match(
  /create or replace function public\.resolve_mpmb_import_item_conflict[\s\S]*?\n\$\$;/,
)?.[0];
const commitFunction = migration.match(
  /create or replace function public\.commit_mpmb_import[\s\S]*?\n\$\$;/,
)?.[0];

describe("MPMB import conflict resolution migration contract", () => {
  it("covers the new exact-version foreign keys with composite indexes", () => {
    expect(indexHardeningMigration).toMatch(
      /create index content_import_items_replacement_version_idx[\s\S]*?on public\.content_import_items\(replacement_content_id, replacement_expected_version\)/,
    );
    expect(indexHardeningMigration).toMatch(
      /create index content_import_origins_replaced_from_version_idx[\s\S]*?on public\.content_import_origins\(content_id, replaced_from_version\)/,
    );
  });

  it("stores only a coherent server-owned resolution and exact replacement version", () => {
    for (const column of [
      "conflict_resolution text",
      "replacement_content_id uuid",
      "replacement_expected_version integer",
      "conflict_resolved_at timestamptz",
    ]) {
      expect(migration).toContain(`add column ${column}`);
    }

    expect(migration).toContain(
      "conflict_resolution in ('keep_both', 'replace')",
    );
    expect(migration).toMatch(
      /conflict_resolution = 'keep_both'[\s\S]*?replacement_content_id is null[\s\S]*?replacement_expected_version is null/,
    );
    expect(migration).toMatch(
      /foreign key \(replacement_content_id, replacement_expected_version\)[\s\S]*?references public\.content_versions\(content_id, version\)[\s\S]*?on delete set null/,
    );
    expect(migration).toContain(
      "create index content_import_items_replacement_content_idx",
    );
    expect(migration).toContain(
      "create unique index content_import_items_one_replacement_target_per_import_idx",
    );
  });

  it("turns provenance into immutable per-item exact-version event history", () => {
    expect(migration).toContain(
      "add column id uuid not null default gen_random_uuid()",
    );
    expect(migration).toContain("drop constraint content_import_origins_pkey");
    expect(migration).toContain(
      "add constraint content_import_origins_pkey primary key (id)",
    );
    expect(migration).toMatch(
      /update public\.content_import_origins\s+set content_version = 1/,
    );
    expect(migration).toContain("disposition in ('created', 'replaced')");
    expect(migration).toMatch(
      /disposition = 'replaced'[\s\S]*?replaced_from_version is not null[\s\S]*?content_version = replaced_from_version \+ 1/,
    );
    expect(migration).toMatch(
      /foreign key \(content_id, content_version\)[\s\S]*?references public\.content_versions\(content_id, version\)/,
    );
    expect(migration).toMatch(
      /foreign key \(content_id, replaced_from_version\)[\s\S]*?references public\.content_versions\(content_id, version\)/,
    );
    expect(migration).toContain(
      "create index content_import_origins_content_id_idx",
    );
    expect(migration).not.toContain(
      "drop constraint content_import_origins_import_item_id_key",
    );
  });

  it("indexes the actor-owned active normalized-name conflict identity", () => {
    expect(migration).toMatch(
      /create index content_definitions_owned_active_normalized_name_idx[\s\S]*?owner_id,[\s\S]*?system_id,[\s\S]*?content_type,[\s\S]*?lower\(pg_catalog\.btrim\(name\)\)[\s\S]*?where source = 'homebrew'[\s\S]*?is_retired = false/,
    );
  });

  it("lists all sanitized candidates for one owned open import without rules payloads", () => {
    expect(listFunction).toBeDefined();
    expect(listFunction).toMatch(
      /list_mpmb_import_item_conflicts\(\s*target_import_id uuid\s*\)[\s\S]*?returns table \(\s*import_item_id uuid,[\s\S]*?content_id uuid,[\s\S]*?name text,[\s\S]*?slug text,[\s\S]*?version integer,[\s\S]*?scope text,[\s\S]*?shared_campaign_count bigint,[\s\S]*?previously_imported boolean,[\s\S]*?replaceable boolean/,
    );
    expect(listFunction).toContain("security definer");
    expect(listFunction).toContain("set search_path = ''");
    expect(listFunction).toMatch(
      /import_record\.owner_id = actor_id[\s\S]*?import_record\.status = 'review'/,
    );
    expect(listFunction).toMatch(
      /definition\.system_id = import_record\.system_id[\s\S]*?definition\.content_type = item\.content_type[\s\S]*?lower\(pg_catalog\.btrim\(definition\.name\)\)[\s\S]*?lower\(pg_catalog\.btrim\(item\.candidate_name\)\)/,
    );
    expect(listFunction).toContain("definition.owner_id = actor_id");
    expect(listFunction).toContain("definition.source = 'homebrew'");
    expect(listFunction).toContain("definition.is_retired = false");
    expect(listFunction).toContain("item.committed_content_id is null");
    expect(listFunction).toContain("origin.owner_id = actor_id");
    expect(listFunction).not.toContain("definition.data");
    expect(listFunction).not.toContain("definition.effects");
  });

  it("resolves under import, item, and exact-target locks with optimistic revisions", () => {
    expect(resolveFunction).toBeDefined();
    expect(resolveFunction).toContain("security definer");
    expect(resolveFunction).toContain("set search_path = ''");
    expect(resolveFunction).toContain("actor_id uuid := (select auth.uid())");
    expect(resolveFunction).toMatch(
      /from public\.content_imports as import_record[\s\S]*?owner_id = actor_id[\s\S]*?status = 'review'[\s\S]*?for update/,
    );
    expect(resolveFunction).toMatch(
      /current_revision is distinct from expected_revision[\s\S]*?errcode = '40001'/,
    );
    expect(resolveFunction).toMatch(
      /from public\.content_import_items as item[\s\S]*?item\.id = target_item_id[\s\S]*?item\.mapping_status = 'valid'[\s\S]*?item\.committed_content_id is null[\s\S]*?for update/,
    );
    expect(resolveFunction).toMatch(
      /from public\.content_definitions as definition[\s\S]*?definition\.id = target_content_id[\s\S]*?definition\.owner_id = actor_id[\s\S]*?definition\.source = 'homebrew'[\s\S]*?definition\.is_retired = false[\s\S]*?for update/,
    );
  });

  it("validates keep-both from server state and denies stale or shared replacements", () => {
    expect(resolveFunction).toMatch(
      /resolution_strategy = 'keep_both'[\s\S]*?target_content_id is not null or target_content_version is not null/,
    );
    expect(resolveFunction).toMatch(
      /if resolution_strategy = 'keep_both' then[\s\S]*?if not exists \([\s\S]*?definition\.owner_id = actor_id[\s\S]*?lower\(pg_catalog\.btrim\(staged_item\.candidate_name\)\)/,
    );
    expect(resolveFunction).toMatch(
      /locked_target\.version is distinct from target_content_version[\s\S]*?'replacement target changed in another session'[\s\S]*?errcode = '40001'/,
    );
    expect(resolveFunction).toMatch(
      /locked_target\.scope <> 'personal'[\s\S]*?from public\.content_shares as share[\s\S]*?share\.content_id = locked_target\.id[\s\S]*?'shared content must be unshared before replacement'[\s\S]*?errcode = '42501'/,
    );
    expect(resolveFunction).toMatch(
      /from public\.content_import_items as other_item[\s\S]*?other_item\.id <> staged_item\.id[\s\S]*?other_item\.replacement_content_id = locked_target\.id[\s\S]*?replacement target can be selected only once per import/,
    );
    expect(resolveFunction).toMatch(
      /conflict_resolution = 'replace'[\s\S]*?replacement_content_id = locked_target\.id[\s\S]*?replacement_expected_version = locked_target\.version/,
    );
    expect(resolveFunction).toContain("revision = import_record.revision + 1");
  });

  it("locks all selected items and replacement definitions in stable order before preflight", () => {
    expect(commitFunction).toBeDefined();
    expect(commitFunction).toMatch(
      /perform item\.id[\s\S]*?order by item\.ordinal[\s\S]*?for update of item/,
    );
    expect(commitFunction).toMatch(
      /perform definition\.id[\s\S]*?select distinct item\.replacement_content_id[\s\S]*?order by definition\.id[\s\S]*?for update of definition/,
    );

    const itemLock = commitFunction?.indexOf("perform item.id") ?? -1;
    const targetLock = commitFunction?.indexOf("perform definition.id") ?? -1;
    const firstPreflight = commitFunction?.indexOf("preflight the full commit set") ?? -1;
    const firstDefinitionWrite = commitFunction?.indexOf(
      "update public.content_definitions as definition",
    ) ?? -1;
    expect(itemLock).toBeGreaterThan(-1);
    expect(targetLock).toBeGreaterThan(itemLock);
    expect(firstPreflight).toBeGreaterThan(targetLock);
    expect(firstDefinitionWrite).toBeGreaterThan(firstPreflight);
  });

  it("recomputes live conflicts and preflights the whole selection before writes", () => {
    expect(commitFunction).toMatch(
      /select pg_catalog\.count\(\*\)[\s\S]*?definition\.owner_id = actor_id[\s\S]*?definition\.system_id = import_record\.system_id[\s\S]*?definition\.content_type = staged_item\.content_type[\s\S]*?definition\.source = 'homebrew'[\s\S]*?definition\.is_retired = false/,
    );
    expect(commitFunction).toMatch(
      /live_conflict_count > 0[\s\S]*?staged_item\.conflict_resolution is null[\s\S]*?resolve all selected content conflicts before committing/,
    );
    expect(commitFunction).toMatch(
      /replacement_target\.version[\s\S]*?staged_item\.replacement_expected_version[\s\S]*?replacement target changed in another session/,
    );
    expect(commitFunction).toMatch(
      /replacement_target\.scope <> 'personal'[\s\S]*?public\.content_shares[\s\S]*?shared content must be unshared before replacement/,
    );
  });

  it("normalizes a stale saved choice when its live conflict disappears", () => {
    expect(commitFunction).toMatch(
      /if live_conflict_count > 0\s+and staged_item\.conflict_resolution = 'replace'/,
    );
    expect(commitFunction).toMatch(
      /update public\.content_import_items as item\s+set\s+conflict_resolution = null,\s+replacement_content_id = null,\s+replacement_expected_version = null,\s+conflict_resolved_at = null[\s\S]*?item\.selected[\s\S]*?item\.conflict_resolution is not null[\s\S]*?and not exists \([\s\S]*?definition\.owner_id = actor_id[\s\S]*?definition\.source = 'homebrew'[\s\S]*?definition\.is_retired = false[\s\S]*?lower\(pg_catalog\.btrim\(item\.candidate_name\)\)/,
    );

    const staleNormalization = commitFunction?.indexOf(
      "update public.content_import_items as item\n  set\n    conflict_resolution = null",
    ) ?? -1;
    const definitionWrite = commitFunction?.indexOf(
      "update public.content_definitions as definition",
    ) ?? -1;
    expect(staleNormalization).toBeGreaterThan(-1);
    expect(definitionWrite).toBeGreaterThan(staleNormalization);
  });

  it("keeps both as a collision-resistant private insert and replaces rules as one unit", () => {
    expect(commitFunction).toMatch(
      /insert into public\.content_definitions[\s\S]*?left\(staged_item\.candidate_slug, 110\)[\s\S]*?replace\(staged_item\.id::text, '-', ''\)[\s\S]*?'homebrew',[\s\S]*?'personal',[\s\S]*?actor_id/,
    );
    expect(commitFunction).toMatch(
      /update public\.content_definitions as definition[\s\S]*?set\s+name = staged_item\.candidate_name,\s+data = staged_item\.candidate_data,\s+effects = staged_item\.candidate_effects,\s+scope = 'personal'[\s\S]*?definition\.id = staged_item\.replacement_content_id[\s\S]*?definition\.version = staged_item\.replacement_expected_version/,
    );
    expect(commitFunction).toMatch(
      /written_version is distinct from replaced_from_version \+ 1[\s\S]*?errcode = '40001'/,
    );
  });

  it("writes exact created/replaced provenance and leaves failures transactional", () => {
    expect(commitFunction).toMatch(
      /insert into public\.content_import_origins \([\s\S]*?content_version,[\s\S]*?disposition,[\s\S]*?replaced_from_version,[\s\S]*?import_item_id/,
    );
    expect(commitFunction).toMatch(
      /written_content_id,\s+written_version,\s+commit_disposition,\s+replaced_from_version/,
    );
    expect(commitFunction).toContain("'private_only'");
    expect(commitFunction).toMatch(
      /status = 'completed',[\s\S]*?completed_at = pg_catalog\.now\(\)/,
    );
    expect(commitFunction).not.toMatch(/exception\s+when/);
    expect(commitFunction).not.toMatch(/dblink|autonomous|commit;/);
  });

  it("returns the recorded provenance version on every completed retry", () => {
    const completedRetry = commitFunction?.match(
      /if import_record\.status = 'completed' then[\s\S]*?\n  end if;/,
    )?.[0];
    expect(completedRetry).toBeDefined();
    expect(completedRetry).toMatch(
      /if import_record\.status = 'completed' then[\s\S]*?select item\.id, origin\.content_id, origin\.content_version[\s\S]*?origin\.import_item_id = item\.id[\s\S]*?order by item\.ordinal[\s\S]*?return;/,
    );
    expect(completedRetry).not.toContain("definition.version");
  });

  it("keeps direct writes unavailable and exposes only authenticated RPC execution", () => {
    for (const table of ["content_import_items", "content_import_origins"]) {
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

    for (const signature of [
      "list_mpmb_import_item_conflicts\\(uuid\\)",
      "resolve_mpmb_import_item_conflict\\(\\s*uuid, uuid, integer, text, uuid, integer\\s*\\)",
      "commit_mpmb_import\\(uuid, integer\\)",
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

    expect(migration).not.toMatch(
      /grant (?:insert|update|delete|all).*content_import_items/,
    );
    expect(migration).not.toMatch(
      /grant (?:insert|update|delete|all).*content_import_origins/,
    );
  });
});
