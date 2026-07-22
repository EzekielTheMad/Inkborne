import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260722221534_atomic_background_selection.sql",
  ),
  "utf8",
)
  .replaceAll("\r\n", "\n")
  .toLowerCase();

const selectionFunction = migration.match(
  /create or replace function public\.set_character_background[\s\S]*?\n\$\$;/,
)?.[0];
const refGuard = migration.match(
  /create or replace function private\.enforce_background_ref_boundary[\s\S]*?\n\$\$;/,
)?.[0];
const choiceGuard = migration.match(
  /create or replace function private\.enforce_background_choice_map_boundary[\s\S]*?\n\$\$;/,
)?.[0];
const copyFunction = migration.match(
  /create or replace function public\.copy_character[\s\S]*?\n\$\$;/,
)?.[0];

describe("atomic background selection migration contract", () => {
  it("normalizes one canonical exact background ref per character", () => {
    expect(migration).toContain("'choice:background'");
    expect(migration).toContain("version.content_type_snapshot = 'background'");
    expect(migration).toContain("partition by ref.character_id");
    expect(migration).toContain("version.slug_snapshot = character.choices->>'background'");
    expect(migration).toContain("candidate.candidate_count = 1");
  });

  it("locks an owned character and validates a current accessible exact snapshot", () => {
    expect(selectionFunction).toBeDefined();
    expect(selectionFunction).toContain("security definer");
    expect(selectionFunction).toContain("set search_path = ''");
    expect(selectionFunction).toMatch(
      /character\.id = target_character_id[\s\S]*?character\.user_id = actor_id[\s\S]*?for update/,
    );
    expect(selectionFunction).toContain(
      "selected_background.version is distinct from target_content_version",
    );
    expect(selectionFunction).toContain("version.system_id_snapshot = locked_character.system_id");
    expect(selectionFunction).toContain("version.content_type_snapshot = 'background'");
    expect(selectionFunction).toContain("private.can_use_content_version(");
    expect(selectionFunction).toContain("selected_version.slug_snapshot");
  });

  it("changes choices and the exact pin in one guarded transaction", () => {
    expect(selectionFunction).toContain(
      "set_config('inkborne.background_choice_rpc', 'on', true)",
    );
    expect(selectionFunction).toMatch(
      /delete from public\.character_content_refs[\s\S]*?update public\.characters[\s\S]*?insert into public\.character_content_refs/,
    );
    expect(selectionFunction).toContain("'source', 'background'");
    expect(selectionFunction).toContain("'choice:background'");
    expect(selectionFunction).toContain("coalesce(previous_rpc_setting, 'off')");
  });

  it("preserves class equipment drafts and refuses unsafe confirmed replacement", () => {
    expect(selectionFunction).toContain("starting_equipment->>'confirmed' = 'true'");
    expect(selectionFunction).toContain(
      "background changes are unavailable after starting equipment is confirmed",
    );
    expect(selectionFunction).toContain("entry.key not like 'background:%'");
    expect(selectionFunction).toContain("'{selections}'");
    expect(selectionFunction).toContain("'{picks}'");
    expect(selectionFunction).toContain("'personality_traits'");
    expect(selectionFunction).toContain("next_resolved_choices - affected_choice_ids");
  });

  it("closes direct ref, delete-policy, and choices bypasses", () => {
    expect(refGuard).toBeDefined();
    expect(refGuard).toContain("old.choice_source = 'choice:background'");
    expect(refGuard).toContain("new_uses_background_source");
    expect(refGuard).toContain("background ref metadata is noncanonical");
    expect(migration).toMatch(
      /create trigger enforce_background_ref_boundary\nbefore insert or update or delete/,
    );
    expect(choiceGuard).toBeDefined();
    expect(choiceGuard).toContain("tg_op = 'insert'");
    expect(choiceGuard).toContain("new.choices ? 'background'");
    expect(choiceGuard).toContain("tg_op = 'update'");
    expect(migration).toMatch(
      /create trigger enforce_background_choice_map_boundary\nbefore insert or update of choices/,
    );
    expect(migration).toContain(
      "choice_source is distinct from 'choice:background'",
    );
  });

  it("keeps character copying canonical under both guarded choice systems", () => {
    expect(copyFunction).toBeDefined();
    expect(copyFunction).toMatch(
      /character\.id = source_character_id[\s\S]*?for update/,
    );
    expect(copyFunction).toContain("noncanonical background that cannot be copied");
    expect(copyFunction).toContain(
      "set_config('inkborne.background_choice_rpc', 'on', true)",
    );
    expect(copyFunction?.indexOf("set_config('inkborne.background_choice_rpc', 'on', true)"))
      .toBeLessThan(copyFunction?.indexOf("insert into public.characters") ?? -1);
    expect(copyFunction).toContain("coalesce(previous_background_rpc_setting, 'off')");
    expect(copyFunction).toContain("inkborne.asi_choice_rpc");
  });

  it("grants only the public RPCs required by authenticated clients", () => {
    expect(migration).toMatch(
      /revoke all on function public\.set_character_background\(uuid, uuid, integer\)[\s\S]*?from public, anon, authenticated, service_role/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.set_character_background\(uuid, uuid, integer\)[\s\S]*?to authenticated/,
    );
    expect(migration).toMatch(
      /revoke all on function private\.enforce_background_ref_boundary\(\)[\s\S]*?from public, anon, authenticated, service_role/,
    );
  });
});
