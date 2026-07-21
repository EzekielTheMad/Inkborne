import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720230000_existing_spell_pin_update_policy.sql",
  ),
  "utf8",
)
  .replaceAll("\r\n", "\n")
  .toLowerCase();

const helper = migration.match(
  /create or replace function private\.can_update_existing_character_spell_pin[\s\S]*?\n\$\$;/,
)?.[0];

describe("existing spell pin update policy", () => {
  it("requires ownership and preserves the exact stored pin identity", () => {
    expect(helper).toBeDefined();
    expect(helper).toContain("security definer");
    expect(helper).toContain("set search_path = ''");
    expect(helper).toMatch(
      /from public\.character_spells as existing[\s\S]*?join public\.characters as character[\s\S]*?existing\.id = target_spell_id/,
    );
    expect(helper).toContain("existing.character_id = target_character_id");
    expect(helper).toContain(
      "existing.content_id is not distinct from target_content_id",
    );
    expect(helper).toContain(
      "existing.content_version is not distinct from target_content_version",
    );
    expect(helper).toContain("character.user_id = (select auth.uid())");
  });

  it("keeps current eligibility on inserts but permits state updates to an old pin", () => {
    expect(migration).not.toContain('drop policy if exists "owners can insert spells"');
    expect(migration).toContain('drop policy if exists "owners can update spells"');
    expect(migration).toMatch(
      /create policy "owners can update existing spell pins"[\s\S]*?for update[\s\S]*?using \(private\.is_character_owner\(character_id\)\)[\s\S]*?with check \([\s\S]*?private\.can_update_existing_character_spell_pin\([\s\S]*?id,[\s\S]*?character_id,[\s\S]*?content_id,[\s\S]*?content_version/,
    );
  });

  it("grants only the exact private helper required by the RLS evaluator", () => {
    expect(migration).toMatch(
      /revoke all on function private\.can_update_existing_character_spell_pin\([\s\S]*?\) from public, anon, authenticated, service_role/,
    );
    expect(migration).toMatch(
      /grant execute on function private\.can_update_existing_character_spell_pin\([\s\S]*?\) to authenticated/,
    );
  });
});
