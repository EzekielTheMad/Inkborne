import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720205807_campaign_homebrew_spell_sharing.sql",
  ),
  "utf8",
)
  .replaceAll("\r\n", "\n")
  .toLowerCase();

const policyRepair = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720223200_content_share_owner_policy_recursion_fix.sql",
  ),
  "utf8",
)
  .replaceAll("\r\n", "\n")
  .toLowerCase();

const conflictTargetRepair = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720224000_campaign_share_conflict_target_fix.sql",
  ),
  "utf8",
)
  .replaceAll("\r\n", "\n")
  .toLowerCase();

const shareFunction = migration.match(
  /create or replace function public\.set_content_campaign_share[\s\S]*?\n\$\$;/,
)?.[0];

const accessFunction = migration.match(
  /create or replace function public\.list_owned_content_campaign_access[\s\S]*?\n\$\$;/,
)?.[0];

const searchFunction = migration.match(
  /create or replace function public\.search_usable_spells_for_character[\s\S]*?\n\$\$;/,
)?.[0];

describe("campaign homebrew spell sharing migration contract", () => {
  it("locks an active definition and authorizes only its authenticated owner", () => {
    expect(shareFunction).toBeDefined();
    expect(shareFunction).toContain("actor_id uuid := (select auth.uid())");
    expect(shareFunction).toContain("authentication required");
    expect(shareFunction).toContain("from public.content_definitions as definition");
    expect(shareFunction).toContain("definition.owner_id = actor_id");
    expect(shareFunction).toContain("definition.source = 'homebrew'");
    expect(shareFunction).toContain("definition.is_retired = false");
    expect(shareFunction).toContain("for update");
  });

  it("rejects stale mutations before changing a share", () => {
    expect(shareFunction).toMatch(
      /target_content_id is null[\s\S]*?target_campaign_id is null[\s\S]*?enabled is null[\s\S]*?expected_version is null[\s\S]*?errcode = '22023'/,
    );
    expect(shareFunction).toContain(
      "locked_definition.version is distinct from expected_version",
    );
    expect(shareFunction).toContain("errcode = '40001'");

    const versionCheck = shareFunction?.indexOf(
      "locked_definition.version is distinct from expected_version",
    );
    const shareInsert = shareFunction?.indexOf(
      "insert into public.content_shares",
    );
    expect(versionCheck).toBeGreaterThan(-1);
    expect(shareInsert).toBeGreaterThan(versionCheck ?? 0);
  });

  it("requires membership and a matching game system when enabling", () => {
    expect(shareFunction).toMatch(
      /from public\.campaigns as campaign\n\s+join public\.campaign_members as member[\s\S]*?member\.user_id = actor_id/,
    );
    expect(shareFunction).toContain("for key share of campaign, member");
    expect(shareFunction).toContain(
      "campaign_system_id is distinct from locked_definition.system_id",
    );
    expect(shareFunction).toMatch(
      /if enabled then[\s\S]*?insert into public\.content_shares[\s\S]*?on conflict on constraint content_shares_content_id_campaign_id_key[\s\S]*?do nothing/,
    );
  });

  it("uses a non-ambiguous conflict target in the deployed RPC repair", () => {
    expect(conflictTargetRepair).toContain(
      "on conflict on constraint content_shares_content_id_campaign_id_key",
    );
    expect(conflictTargetRepair).not.toContain(
      "on conflict (content_id, campaign_id)",
    );
  });

  it("derives scope and version atomically from the remaining share count", () => {
    expect(shareFunction).toMatch(
      /else[\s\S]*?delete from public\.content_shares as share[\s\S]*?share\.campaign_id = target_campaign_id/,
    );
    expect(shareFunction).toMatch(
      /select count\(\*\)[\s\S]*?from public\.content_shares as share[\s\S]*?share\.content_id = locked_definition\.id/,
    );
    expect(shareFunction).toMatch(
      /when shared_campaign_count > 0 then 'shared'[\s\S]*?else 'personal'/,
    );
    expect(shareFunction).toMatch(
      /update public\.content_definitions as definition[\s\S]*?set scope = derived_scope[\s\S]*?returning definition\.id, definition\.version, definition\.scope[\s\S]*?into content_id, version, scope/,
    );
    expect(shareFunction).toMatch(
      /returns table \([\s\S]*?content_id uuid,[\s\S]*?version integer,[\s\S]*?scope text,[\s\S]*?shared_campaign_count bigint/,
    );
  });

  it("makes the share RPC the authenticated mutation boundary", () => {
    expect(shareFunction).toContain("security definer");
    expect(shareFunction).toContain("set search_path = ''");
    expect(migration).toMatch(
      /revoke all on function public\.set_content_campaign_share\(uuid, uuid, boolean, integer\)[\s\S]*?from public, anon, authenticated, service_role/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.set_content_campaign_share\(uuid, uuid, boolean, integer\)[\s\S]*?to authenticated/,
    );
    expect(migration).toMatch(
      /revoke insert, update, delete on public\.content_shares[\s\S]*?from public, anon, authenticated/,
    );
  });

  it("lets members and content owners read only their relevant share metadata", () => {
    expect(migration).toContain(
      'drop policy if exists "shares visible to campaign members"',
    );
    const policy = migration.match(
      /create policy "shares visible to campaign members and content owners"[\s\S]*?\n  \);/,
    )?.[0];

    expect(policy).toBeDefined();
    expect(policy).toContain("on public.content_shares for select");
    expect(policy).toContain("to authenticated");
    expect(policy).toMatch(
      /from public\.campaign_members as member[\s\S]*?member\.campaign_id = content_shares\.campaign_id[\s\S]*?member\.user_id = \(select auth\.uid\(\)\)/,
    );
    expect(policy).toMatch(
      /or content_shares\.shared_by = \(select auth\.uid\(\)\)/,
    );
    expect(policy).not.toContain("from public.content_definitions");
  });

  it("repairs deployed owner visibility without recreating an RLS cycle", () => {
    expect(policyRepair).toContain(
      'drop policy if exists "shares visible to campaign members and content owners"',
    );
    expect(policyRepair).toMatch(
      /create policy "shares visible to campaign members and content owners"[\s\S]*?or content_shares\.shared_by = \(select auth\.uid\(\)\)/,
    );
    expect(policyRepair).not.toContain("from public.content_definitions");
  });

  it("lists campaign access only for the authenticated active-homebrew owner", () => {
    expect(accessFunction).toBeDefined();
    expect(accessFunction).toContain("actor_id uuid := (select auth.uid())");
    expect(accessFunction).toContain("authentication required");
    expect(accessFunction).toMatch(
      /target_content_id is null[\s\S]*?errcode = '22023'/,
    );
    expect(accessFunction).toMatch(
      /from public\.content_definitions as definition[\s\S]*?definition\.id = target_content_id[\s\S]*?definition\.owner_id = actor_id[\s\S]*?definition\.source = 'homebrew'[\s\S]*?definition\.is_retired = false/,
    );
  });

  it("returns the same-system union of eligible memberships and removable shares", () => {
    expect(accessFunction).toMatch(
      /returns table \([\s\S]*?id uuid,[\s\S]*?name text,[\s\S]*?shared boolean,[\s\S]*?eligible boolean/,
    );
    expect(accessFunction).toContain(
      "campaign.system_id = content_system_id",
    );
    expect(accessFunction).toMatch(
      /from public\.content_shares as share[\s\S]*?share\.content_id = target_content_id[\s\S]*?share\.campaign_id = campaign\.id[\s\S]*?as shared/,
    );
    expect(accessFunction).toMatch(
      /from public\.campaign_members as member[\s\S]*?member\.campaign_id = campaign\.id[\s\S]*?member\.user_id = actor_id[\s\S]*?as eligible/,
    );
    expect(accessFunction).toMatch(
      /where campaign\.system_id = content_system_id[\s\S]*?exists \([\s\S]*?public\.campaign_members[\s\S]*?\)\n\s+or exists \([\s\S]*?public\.content_shares/,
    );
  });

  it("exposes campaign access metadata only through its authenticated RPC", () => {
    expect(accessFunction).toContain("security definer");
    expect(accessFunction).toContain("set search_path = ''");
    expect(migration).toMatch(
      /revoke all on function public\.list_owned_content_campaign_access\(uuid\)[\s\S]*?from public, anon, authenticated, service_role/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.list_owned_content_campaign_access\(uuid\)[\s\S]*?to authenticated/,
    );
  });

  it("requires ownership of the target character before discovery", () => {
    expect(searchFunction).toBeDefined();
    expect(searchFunction).toContain("actor_id uuid := (select auth.uid())");
    expect(searchFunction).toMatch(
      /from public\.characters as character[\s\S]*?character\.id = target_character_id[\s\S]*?character\.user_id = actor_id/,
    );
    expect(searchFunction).toContain(
      "character ownership is required to search usable spells",
    );
  });

  it("returns only current active same-system spell definitions usable by the character", () => {
    expect(searchFunction).toContain(
      "definition.system_id = character_system_id",
    );
    expect(searchFunction).toContain("definition.content_type = 'spell'");
    expect(searchFunction).toContain("definition.is_retired = false");
    expect(searchFunction).toContain(
      "private.can_use_content_version(\n      target_character_id,\n      definition.id,\n      definition.version",
    );
    expect(searchFunction).toMatch(
      /returns table \([\s\S]*?id uuid,[\s\S]*?name text,[\s\S]*?slug text,[\s\S]*?content_type text,[\s\S]*?data jsonb,[\s\S]*?effects jsonb,[\s\S]*?version integer,[\s\S]*?source text,[\s\S]*?system_id uuid,[\s\S]*?scope text,[\s\S]*?owner_id uuid/,
    );
  });

  it("applies all spell filters and caps caller-controlled result counts", () => {
    expect(searchFunction).toMatch(
      /char_length\(coalesce\(search_query, ''\)\) > 200[\s\S]*?errcode = '22023'/,
    );
    expect(searchFunction).toMatch(
      /class_slug is not null[\s\S]*?char_length\(class_slug\) > 100[\s\S]*?errcode = '22023'/,
    );
    expect(searchFunction).toMatch(
      /spell_school is not null[\s\S]*?char_length\(spell_school\) > 100[\s\S]*?errcode = '22023'/,
    );
    expect(searchFunction).toContain("strpos(");
    expect(searchFunction).toContain("(definition.data -> 'classes') ? class_slug");
    expect(searchFunction).toContain(
      "definition.data ->> 'level' = spell_level::text",
    );
    expect(searchFunction).toContain(
      "definition.data ->> 'school' = spell_school",
    );
    expect(searchFunction).toContain(
      "definition.data @> '{\"ritual\": true}'::jsonb",
    );
    expect(searchFunction).toContain(
      "definition.data @> '{\"concentration\": true}'::jsonb",
    );
    expect(searchFunction).toMatch(
      /limit least\([\s\S]*?greatest\(coalesce\(result_limit, 50\), 1\),[\s\S]*?50[\s\S]*?\)/,
    );
  });

  it("locks down the character-aware search RPC to authenticated callers", () => {
    expect(searchFunction).toContain("security definer");
    expect(searchFunction).toContain("set search_path = ''");
    expect(migration).toMatch(
      /revoke all on function public\.search_usable_spells_for_character\([\s\S]*?\) from public, anon, authenticated, service_role/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.search_usable_spells_for_character\([\s\S]*?\) to authenticated/,
    );
  });
});
