import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
  "supabase/migrations/20260720171627_content_version_pinning_and_rls.sql",
  ),
  "utf8",
).toLowerCase();

describe("content version pinning and RLS migration contract", () => {
  it("stores a self-contained immutable parser envelope", () => {
    for (const column of [
      "name_snapshot",
      "slug_snapshot",
      "content_type_snapshot",
      "system_id_snapshot",
      "source_snapshot",
      "scope_snapshot",
      "owner_id_snapshot",
      "data_snapshot",
      "effects_snapshot",
    ]) {
      expect(migration).toContain(column);
    }

    expect(migration).toContain("content version snapshots are immutable");
    expect(migration).toMatch(
      /create trigger reject_content_version_update[\s\S]*?before update on public\.content_versions/i,
    );
  });

  it("backfills version 1 for every current definition", () => {
    expect(migration).toMatch(
      /insert into public\.content_versions[\s\S]*?select[\s\S]*?definition\.id,[\s\S]*?1,[\s\S]*?from public\.content_definitions as definition[\s\S]*?on conflict \(content_id, version\) do nothing/,
    );
  });

  it("makes definition identity immutable and snapshots versioned changes", () => {
    expect(migration).toContain(
      "create or replace function private.prepare_content_definition_version()",
    );
    expect(migration).toContain(
      "create or replace function private.snapshot_content_definition_version()",
    );
    expect(migration).toMatch(
      /new\.system_id[\s\S]*?new\.content_type[\s\S]*?new\.slug[\s\S]*?new\.source[\s\S]*?new\.owner_id/,
    );
    expect(migration).toContain("new.version := old.version + 1");
    expect(migration).toMatch(
      /before insert or update on public\.content_definitions/,
    );
    expect(migration).toMatch(
      /after insert or update on public\.content_definitions/,
    );
    expect(migration).toMatch(/set search_path = ''/);
    expect(migration).toMatch(
      /revoke all on function private\.prepare_content_definition_version\(\) from public, anon, authenticated/,
    );
    expect(migration).toMatch(
      /revoke all on function private\.snapshot_content_definition_version\(\) from public, anon, authenticated/,
    );
  });

  it("enforces official versus owned-homebrew identity and null-safe uniqueness", () => {
    expect(migration).toContain("unique nulls not distinct");
    expect(migration).toMatch(
      /source = 'srd'[\s\S]*?scope = 'platform'[\s\S]*?owner_id is null/,
    );
    expect(migration).toMatch(
      /source = 'homebrew'[\s\S]*?scope in \('personal', 'shared'\)[\s\S]*?owner_id is not null/,
    );
  });

  it("uses exact-version restrictive foreign keys for all canonical links", () => {
    expect(migration).toContain("alter column content_version drop default");
    for (const table of [
      "character_content_refs",
      "character_inventory",
      "character_spells",
    ]) {
      expect(migration).toMatch(
        new RegExp(
          `alter table public\\.${table}[\\s\\S]*?foreign key \\(content_id, content_version\\)[\\s\\S]*?references public\\.content_versions\\(content_id, version\\)[\\s\\S]*?on delete restrict`,
          "i",
        ),
      );
    }

    expect(migration.match(/\(content_id is null\) = \(content_version is null\)/g)).toHaveLength(
      2,
    );
  });

  it("allows only character owners to attach visible same-system exact versions", () => {
    expect(migration).toContain(
      "create or replace function private.can_use_content_version(",
    );
    expect(migration).toContain(
      "definition.system_id = character.system_id",
    );
    expect(migration).toContain("character.user_id = (select auth.uid())");
    expect(migration).toContain("version.version = target_content_version");
    expect(migration).toContain("definition.scope = 'platform'");
    expect(migration).toContain("from public.content_shares as share");
    expect(migration).toContain("join public.campaign_members as member");
    expect(migration).toContain(
      "share.campaign_id = character.campaign_id",
    );
  });

  it("lets authorized sheet viewers read only versions referenced exactly", () => {
    expect(migration).toContain(
      'create policy "visible catalog or referenced versions can be read"',
    );
    for (const alias of ["ref", "item", "spell"]) {
      expect(migration).toContain(
        `${alias}.content_id = content_versions.content_id`,
      );
      expect(migration).toContain(
        `${alias}.content_version = content_versions.version`,
      );
      expect(migration).toContain(
        `private.can_view_character(${alias}.character_id)`,
      );
    }
  });

  it("prevents authenticated catalog source or scope escalation", () => {
    expect(migration).toMatch(
      /create policy "owners can insert homebrew content"[\s\S]*?owner_id = \(select auth\.uid\(\)\)[\s\S]*?source = 'homebrew'[\s\S]*?scope in \('personal', 'shared'\)/,
    );
    expect(migration).toMatch(
      /create policy "owners can update homebrew content"[\s\S]*?using[\s\S]*?with check[\s\S]*?source = 'homebrew'[\s\S]*?scope in \('personal', 'shared'\)/,
    );
    expect(migration).toMatch(
      /grant select\s+on public\.content_versions to authenticated/,
    );
  });

  it("removes every older permissive spell and inventory mutation policy", () => {
    for (const table of ["inventory", "spells"]) {
      for (const operation of ["insert", "update", "delete"]) {
        expect(migration).toContain(
          `drop policy if exists "owner can ${operation} ${table}"`,
        );
      }
    }
  });

  it("copies exact pins for refs, inventory, and spells", () => {
    expect(migration).toContain(
      "create or replace function public.copy_character(",
    );
    expect(migration).toMatch(
      /insert into public\.character_content_refs \([\s\S]*?content_version[\s\S]*?ref\.content_version/,
    );
    expect(migration).toMatch(
      /insert into public\.character_inventory \([\s\S]*?content_version[\s\S]*?item\.content_version/,
    );
    expect(migration).toMatch(
      /insert into public\.character_spells \([\s\S]*?content_version[\s\S]*?spell\.content_version/,
    );
  });
});
