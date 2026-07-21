import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function migration(name: string) {
  return readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8")
    .replaceAll("\r\n", "\n")
    .toLowerCase();
}

const restoreMigration = migration(
  "20260721224742_restore_feat_choice_rpc_boundary.sql",
);
const hardeningMigration = migration(
  "20260721223507_harden_feat_choice_atomicity.sql",
);

const choiceFunction = restoreMigration.match(
  /create or replace function public\.set_character_asi_choice[\s\S]*?\n\$\$;/,
)?.[0];
const copyFunction = hardeningMigration.match(
  /create or replace function public\.copy_character[\s\S]*?\n\$\$;/,
)?.[0];

describe("feat choice RPC boundary restoration migration contract", () => {
  it("captures the prior guard value before enabling the mutation boundary", () => {
    expect(choiceFunction).toBeDefined();
    const capture = choiceFunction?.indexOf("previous_rpc_setting text :=") ?? -1;
    const enable = choiceFunction?.indexOf(
      "set_config('inkborne.asi_choice_rpc', 'on', true)",
    ) ?? -1;

    expect(capture).toBeGreaterThan(-1);
    expect(choiceFunction).toMatch(
      /previous_rpc_setting text := pg_catalog\.current_setting\([\s\S]*?'inkborne\.asi_choice_rpc',[\s\S]*?true[\s\S]*?\);/,
    );
    expect(enable).toBeGreaterThan(capture);
  });

  it("restores the prior value after all protected writes and before the sole normal return", () => {
    const enable = choiceFunction?.indexOf(
      "set_config('inkborne.asi_choice_rpc', 'on', true)",
    ) ?? -1;
    const deleteRef = choiceFunction?.indexOf(
      "delete from public.character_content_refs",
      enable,
    ) ?? -1;
    const updateCharacter = choiceFunction?.indexOf(
      "update public.characters as character",
      deleteRef,
    ) ?? -1;
    const insertRef = choiceFunction?.indexOf(
      "insert into public.character_content_refs",
      updateCharacter,
    ) ?? -1;
    const restore = choiceFunction?.indexOf(
      "coalesce(previous_rpc_setting, 'off')",
      insertRef,
    ) ?? -1;
    const normalReturn = choiceFunction?.indexOf("return next", restore) ?? -1;

    expect(deleteRef).toBeGreaterThan(enable);
    expect(updateCharacter).toBeGreaterThan(deleteRef);
    expect(insertRef).toBeGreaterThan(updateCharacter);
    expect(restore).toBeGreaterThan(insertRef);
    expect(normalReturn).toBeGreaterThan(restore);
    expect(choiceFunction?.match(/return next/g)).toHaveLength(1);
    expect(choiceFunction).toMatch(
      /set_config\([\s\S]*?'inkborne\.asi_choice_rpc',[\s\S]*?coalesce\(previous_rpc_setting, 'off'\),[\s\S]*?true[\s\S]*?\);[\s\S]*?return next/,
    );
  });

  it("preserves the validated, locked, exact-version atomic mutation flow", () => {
    expect(choiceFunction).toContain("for update");
    expect(choiceFunction).toContain("feature.data_snapshot->>'feature_type' = 'asi'");
    expect(choiceFunction).toContain("private.is_character_feature_grant_active(grant_row.id)");
    expect(choiceFunction).toContain("two distinct +1 abilities");
    expect(choiceFunction).toContain("> 20");
    expect(choiceFunction).toContain(
      "selected_feat.version is distinct from target_feat_version",
    );
    expect(choiceFunction).toContain("private.can_use_content_version(");
    expect(choiceFunction).toContain("private.feat_prerequisite_status(");
    expect(choiceFunction).toContain(
      "choice_source_value := 'choice:asi:' || target_grant.id::text",
    );
  });

  it("keeps copy_character's independent capture and restoration boundary", () => {
    expect(copyFunction).toBeDefined();
    expect(copyFunction).toMatch(
      /previous_rpc_setting text := pg_catalog\.current_setting\([\s\S]*?'inkborne\.asi_choice_rpc',[\s\S]*?true[\s\S]*?\);/,
    );
    expect(copyFunction).toMatch(
      /set_config\([\s\S]*?'inkborne\.asi_choice_rpc',[\s\S]*?coalesce\(previous_rpc_setting, 'off'\),[\s\S]*?true[\s\S]*?\);[\s\S]*?return new_character_id/,
    );
  });

  it("retains the authenticated-only RPC grant", () => {
    expect(restoreMigration).toMatch(
      /revoke all on function public\.set_character_asi_choice\([\s\S]*?\) from public, anon, authenticated, service_role/,
    );
    expect(restoreMigration).toMatch(
      /grant execute on function public\.set_character_asi_choice\([\s\S]*?\) to authenticated/,
    );
  });
});
