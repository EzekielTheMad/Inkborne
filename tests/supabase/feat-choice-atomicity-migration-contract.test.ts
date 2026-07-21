import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260721223507_harden_feat_choice_atomicity.sql",
  ),
  "utf8",
)
  .replaceAll("\r\n", "\n")
  .toLowerCase();

const refBoundary = migration.match(
  /create or replace function private\.enforce_asi_choice_ref_boundary[\s\S]*?\n\$\$;/,
)?.[0];
const mapBoundary = migration.match(
  /create or replace function private\.enforce_asi_choice_map_boundary[\s\S]*?\n\$\$;/,
)?.[0];
const discovery = migration.match(
  /create function public\.search_usable_feats_for_character[\s\S]*?\n\$\$;/,
)?.[0];
const prerequisite = migration.match(
  /create or replace function private\.feat_prerequisite_status[\s\S]*?\n\$\$;/,
)?.[0];
const copyCharacter = migration.match(
  /create or replace function public\.copy_character[\s\S]*?\n\$\$;/,
)?.[0];

describe("feat choice atomicity follow-up migration contract", () => {
  it("guards inserts and every update involving a reserved source or feat pin", () => {
    expect(refBoundary).toBeDefined();
    expect(refBoundary).toContain("if tg_op = 'update' then");
    expect(refBoundary).toContain("old.choice_source like 'choice:asi:%'");
    expect(refBoundary).toContain("new.choice_source like 'choice:asi:%'");
    expect(refBoundary).toMatch(
      /version\.content_id = old\.content_id[\s\S]*?version\.content_version|version\.version = old\.content_version/,
    );
    expect(refBoundary).toMatch(
      /version\.content_id = new\.content_id[\s\S]*?version\.content_version|version\.version = new\.content_version/,
    );
    expect(refBoundary).toContain("version.content_type_snapshot = 'feat'");
    expect(refBoundary).toContain("current_setting('inkborne.asi_choice_rpc', true)");
    expect(migration).toContain(
      "before insert or update on public.character_content_refs",
    );
    expect(migration).not.toContain(
      "before insert or update of choice_source on public.character_content_refs",
    );
  });

  it("blocks direct ASI map replacement while leaving unchanged maps available to pruning", () => {
    expect(mapBoundary).toBeDefined();
    expect(mapBoundary).toContain(
      "requested_asi_choices is distinct from old_asi_choices",
    );
    expect(mapBoundary).toContain("current_setting('inkborne.asi_choice_rpc', true)");
    expect(migration).toContain(
      "create trigger enforce_asi_choice_map_boundary\nbefore update of choices on public.characters",
    );
    expect(mapBoundary).not.toContain("new.choices :=");
  });

  it("makes discovery prerequisite results relative to the ASI slot being edited", () => {
    expect(discovery).toBeDefined();
    expect(discovery).toContain("target_feature_slug text default null");
    expect(discovery).toContain("feature.data_snapshot->>'feature_type' = 'asi'");
    expect(discovery).toContain("private.is_character_feature_grant_active(grant_row.id)");
    expect(discovery).toContain(
      "excluded_choice_source := 'choice:asi:' || matching_grant_ids[1]::text",
    );
    expect(discovery).toMatch(
      /private\.feat_prerequisite_status\([\s\S]*?definition\.data,[\s\S]*?null,[\s\S]*?excluded_choice_source/,
    );
    expect(prerequisite).toMatch(
      /when excluded_choice_source is null then excluded_content_id[\s\S]*?else null/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.search_usable_feats_for_character\(uuid, text, integer, text\)[\s\S]*?to authenticated/,
    );
  });

  it("preflights destination access before any copied dependency and remaps ASI refs", () => {
    expect(copyCharacter).toBeDefined();
    const accessPreflight = copyCharacter?.indexOf(
      "character contains content unavailable to the target campaign",
    ) ?? -1;
    const rpcBoundary = copyCharacter?.indexOf(
      "set_config('inkborne.asi_choice_rpc', 'on', true)",
    ) ?? -1;
    const refCopy = copyCharacter?.indexOf(
      "insert into public.character_content_refs",
      rpcBoundary,
    ) ?? -1;
    expect(accessPreflight).toBeGreaterThan(-1);
    expect(rpcBoundary).toBeGreaterThan(accessPreflight);
    expect(refCopy).toBeGreaterThan(rpcBoundary);

    expect(copyCharacter).toMatch(
      /select ref\.content_id, ref\.content_version[\s\S]*?where ref\.character_id = source_character_id[\s\S]*?ref\.feature_grant_id is null[\s\S]*?where private\.can_use_content_version\(/,
    );

    expect(copyCharacter).toMatch(
      /ref\.choice_source is null[\s\S]*?ref\.choice_source not like 'choice:asi:%'/,
    );
    expect(copyCharacter).toContain(
      "character contains a noncanonical feat ref that cannot be copied",
    );
    expect(copyCharacter).toMatch(
      /insert into public\.character_content_refs \([\s\S]*?ref\.choice_source not like 'choice:asi:%'[\s\S]*?not exists \([\s\S]*?version\.content_type_snapshot = 'feat'/,
    );
    expect(copyCharacter).toMatch(
      /jsonb_extract_path_text\([\s\S]*?source_character\.choices,[\s\S]*?'asi_choices',[\s\S]*?source_grant\.feature_slug,[\s\S]*?'featid'/,
    );
    expect(copyCharacter).toContain(
      "grant_row.character_id = new_character_id",
    );
    expect(copyCharacter).toContain(
      "'choice:asi:' || destination_grant.id::text",
    );
    expect(copyCharacter).toContain(
      "stored_feat_choice_count <> source_asi_ref_count",
    );
    expect(copyCharacter).toContain(
      "source_asi_ref_count <> inserted_asi_ref_count",
    );
  });

  it("does not grant the private guard functions to API roles", () => {
    expect(migration).toMatch(
      /revoke all on function private\.enforce_asi_choice_ref_boundary\(\)[\s\S]*?from public, anon, authenticated, service_role/,
    );
    expect(migration).toMatch(
      /revoke all on function private\.enforce_asi_choice_map_boundary\(\)[\s\S]*?from public, anon, authenticated, service_role/,
    );
  });
});
