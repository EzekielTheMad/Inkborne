import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260720185305_character_content_boundary_guards.sql",
  ),
  "utf8",
).replaceAll("\r\n", "\n");

function functionBody(qualifiedName: string): string {
  const escapedName = qualifiedName.replaceAll(".", "\\.");
  const match = migration.match(
    new RegExp(
      `CREATE OR REPLACE FUNCTION ${escapedName}[\\s\\S]*?\\$\\$;`,
    ),
  );
  expect(match).toBeDefined();
  return match?.[0] ?? "";
}

describe("character content boundary guard migration contract", () => {
  it("prevents linked snapshot visibility from becoming a cross-owner oracle", () => {
    const policy = migration.match(
      /CREATE POLICY "Visible catalog or referenced versions can be read"[\s\S]*?\n  \);/,
    )?.[0];

    expect(policy).toBeDefined();
    expect(policy).toContain("scope_snapshot = 'platform'");
    expect(policy).toContain("owner_id_snapshot = (SELECT auth.uid())");
    expect(policy).toContain("private.can_access_campaign(share.campaign_id)");
    for (const alias of ["ref", "item", "spell"]) {
      expect(policy).toContain(`private.can_view_character(${alias}.character_id)`);
    }
    expect(policy?.match(/character\.user_id = \(SELECT auth\.uid\(\)\)/g)).toHaveLength(3);
    expect(policy?.match(/content_versions\.owner_id_snapshot = character\.user_id/g)).toHaveLength(3);
  });

  it("validates every physical pin and dormant grant after destination changes", () => {
    const helper = functionBody("private.validate_character_content_boundaries");

    for (const table of [
      "character_content_refs",
      "character_inventory",
      "character_spells",
      "character_feature_grants",
      "character_spell_grants",
    ]) {
      expect(helper).toContain(`public.${table}`);
    }
    expect(helper).toContain("private.character_can_access_content_version(");
    expect(helper).toContain("NEW.id");
    expect(helper).toContain("NEW.campaign_id IS NULL");
    expect(helper).toContain("NEW.system_id IS NOT DISTINCT FROM OLD.system_id");
    expect(migration).toMatch(
      /CREATE TRIGGER validate_character_content_boundaries[\s\S]*?AFTER UPDATE OF campaign_id, system_id[\s\S]*?ON public\.characters/,
    );
  });

  it("keeps the destination validator private and hardened", () => {
    const helper = functionBody("private.validate_character_content_boundaries");
    expect(helper).toContain("SECURITY DEFINER");
    expect(helper).toContain("SET search_path = ''");
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION private\.validate_character_content_boundaries\(\)[\s\S]*?FROM PUBLIC, anon, authenticated/,
    );
  });

  it("derives active feature grants from persisted choices and the pinned controller", () => {
    const helper = functionBody("private.is_character_feature_grant_active");
    expect(helper).toContain("character.choices->'classes'");
    expect(helper).toContain("controller_ref.content_id");
    expect(helper).toContain("controller_ref.content_version");
    expect(helper).toContain("controller.data_snapshot->>'parent_class'");
    expect(helper).toContain("class_choice.value->>'subclass' = controller.slug_snapshot");
    expect(helper).not.toContain("auth.uid()");
    expect(helper).toContain("SECURITY DEFINER");
    expect(helper).toContain("SET search_path = ''");
    expect(migration).not.toMatch(
      /GRANT EXECUTE ON FUNCTION private\.is_character_feature_grant_active/,
    );
  });

  it("rejects inactive, forged, mutable, or prefix-spoofed derived refs", () => {
    const guard = functionBody("private.enforce_character_feature_grant");
    expect(guard).toContain("OLD.feature_grant_id IS NOT NULL");
    expect(guard).toContain("NEW.feature_grant_id IS DISTINCT FROM OLD.feature_grant_id");
    expect(guard).toContain("private.is_character_feature_grant_active(NEW.feature_grant_id)");
    expect(guard).toContain("NEW.content_id IS DISTINCT FROM grant_row.feature_content_id");
    expect(guard).toContain("NEW.content_version IS DISTINCT FROM grant_row.feature_version");
    expect(guard).toContain("NEW.choice_source LIKE 'auto:feature-grant:%'");
    expect(guard).toContain("NEW.context IS DISTINCT FROM expected_context");
    expect(guard).toMatch(
      /FROM public\.characters AS character[\s\S]*?WHERE character\.id = NEW\.character_id[\s\S]*?FOR UPDATE/,
    );
    expect(migration).toMatch(
      /CREATE TRIGGER enforce_character_feature_grant[\s\S]*?BEFORE INSERT OR UPDATE OF[\s\S]*?feature_grant_id[\s\S]*?ON public\.character_content_refs/,
    );
  });

  it("serializes direct ref writes with level changes and prunes stale projections", () => {
    const cleanup = functionBody(
      "private.prune_inactive_feature_refs_after_choices",
    );
    expect(cleanup).toContain("DELETE FROM public.character_content_refs");
    expect(cleanup).toContain("ref.character_id = NEW.id");
    expect(cleanup).toContain(
      "private.is_character_feature_grant_active(ref.feature_grant_id)",
    );
    expect(cleanup).toContain("SECURITY DEFINER");
    expect(cleanup).toContain("SET search_path = ''");
    expect(migration).toMatch(
      /CREATE TRIGGER prune_inactive_feature_refs_after_choices[\s\S]*?AFTER UPDATE OF choices[\s\S]*?ON public\.characters/,
    );
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION private\.prune_inactive_feature_refs_after_choices\(\)[\s\S]*?FROM PUBLIC, anon, authenticated/,
    );
  });

  it("cleans stale legacy projections before installing the strict trigger", () => {
    const inactiveCleanup = migration.indexOf(
      "DELETE FROM public.character_content_refs AS ref\nWHERE ref.feature_grant_id IS NOT NULL",
    );
    const prefixCleanup = migration.indexOf(
      "DELETE FROM public.character_content_refs AS ref\nWHERE ref.feature_grant_id IS NULL",
    );
    const trigger = migration.indexOf(
      "CREATE TRIGGER enforce_character_feature_grant",
    );
    expect(inactiveCleanup).toBeGreaterThan(-1);
    expect(prefixCleanup).toBeGreaterThan(inactiveCleanup);
    expect(trigger).toBeGreaterThan(prefixCleanup);
  });

  it("reconciles active exact pins in one locked owner-only RPC", () => {
    const rpc = functionBody("public.sync_character_feature_refs");
    expect(rpc).toContain("character.user_id = actor_id");
    expect(rpc).toContain("FOR UPDATE");
    expect(rpc).toContain("DELETE FROM public.character_content_refs");
    expect(rpc).toContain("INSERT INTO public.character_content_refs");
    expect(rpc).toContain("grant_row.feature_content_id");
    expect(rpc).toContain("grant_row.feature_version");
    expect(rpc).toContain("private.is_character_feature_grant_active(grant_row.id)");
    expect(rpc).toContain("private.character_can_access_content_version(");
    expect(rpc).not.toContain("DELETE FROM public.character_feature_grants");
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.sync_character_feature_refs\(uuid\)[\s\S]*?FROM PUBLIC, anon, authenticated/,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.sync_character_feature_refs\(uuid\)[\s\S]*?TO authenticated/,
    );
  });
});
