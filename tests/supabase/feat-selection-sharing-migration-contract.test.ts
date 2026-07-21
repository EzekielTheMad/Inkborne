import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260721221108_feat_selection_and_campaign_revocation.sql",
  ),
  "utf8",
)
  .replaceAll("\r\n", "\n")
  .toLowerCase();

const shareFunction = migration.match(
  /create or replace function public\.set_content_campaign_share[\s\S]*?\n\$\$;/,
)?.[0];
const discoveryFunction = migration.match(
  /create or replace function public\.search_usable_feats_for_character[\s\S]*?\n\$\$;/,
)?.[0];
const choiceFunction = migration.match(
  /create or replace function public\.set_character_asi_choice[\s\S]*?\n\$\$;/,
)?.[0];
const abilityFunction = migration.match(
  /create or replace function private\.character_ability_scores[\s\S]*?\n\$\$;/,
)?.[0];

describe("feat selection and campaign revocation migration contract", () => {
  it("allowlists released homebrew spells and feats while refusing imports", () => {
    expect(shareFunction).toBeDefined();
    expect(shareFunction).toContain("definition.source = 'homebrew'");
    expect(shareFunction).toContain("definition.content_type in ('spell', 'feat')");
    expect(shareFunction).toContain("definition.is_retired = false");
    expect(shareFunction).toMatch(
      /if enabled then[\s\S]*?locked_definition\.owner_id is distinct from actor_id/,
    );
    expect(shareFunction).toMatch(
      /from public\.content_import_origins as origin[\s\S]*?origin\.content_id = locked_definition\.id/,
    );
  });

  it("allows only the author to grant and either author or exact campaign owner to revoke", () => {
    expect(shareFunction).toMatch(
      /select campaign\.system_id, campaign\.owner_id[\s\S]*?where campaign\.id = target_campaign_id[\s\S]*?for key share/,
    );
    expect(shareFunction).toMatch(
      /if enabled then[\s\S]*?only the content owner can grant campaign access/,
    );
    expect(shareFunction).toMatch(
      /else[\s\S]*?locked_definition\.owner_id is distinct from actor_id[\s\S]*?campaign_owner_id is distinct from actor_id[\s\S]*?only the content owner or campaign owner can revoke access/,
    );
    expect(shareFunction).toMatch(
      /delete from public\.content_shares as share[\s\S]*?share\.content_id = locked_definition\.id[\s\S]*?share\.campaign_id = target_campaign_id/,
    );
    expect(shareFunction).toMatch(
      /locked_definition\.owner_id is distinct from actor_id[\s\S]*?not exists \([\s\S]*?share\.campaign_id = target_campaign_id[\s\S]*?content is not shared to this campaign/,
    );
  });

  it("keeps optimistic versioning and immutable scope snapshots in the sole share RPC", () => {
    const stale = shareFunction?.indexOf(
      "locked_definition.version is distinct from expected_version",
    );
    const mutation = shareFunction?.indexOf("if enabled then");
    expect(stale).toBeGreaterThan(-1);
    expect(mutation).toBeGreaterThan(stale ?? 0);
    expect(shareFunction).toContain("errcode = '40001'");
    expect(shareFunction).toMatch(
      /when shared_campaign_count > 0 then 'shared'[\s\S]*?else 'personal'/,
    );
    expect(shareFunction).toMatch(
      /update public\.content_definitions as definition[\s\S]*?set scope = derived_scope/,
    );
    expect(migration).toMatch(
      /revoke all on function public\.set_content_campaign_share\(uuid, uuid, boolean, integer\)[\s\S]*?from public, anon, authenticated, service_role/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.set_content_campaign_share\(uuid, uuid, boolean, integer\)[\s\S]*?to authenticated/,
    );
  });

  it("gives a campaign owner only a narrow shared-content read model", () => {
    const campaignList = migration.match(
      /create or replace function public\.list_campaign_shared_content_for_owner[\s\S]*?\n\$\$;/,
    )?.[0];
    expect(campaignList).toBeDefined();
    expect(campaignList).toMatch(
      /from public\.campaigns as campaign[\s\S]*?campaign\.id = target_campaign_id[\s\S]*?campaign\.owner_id = actor_id/,
    );
    expect(campaignList).toMatch(
      /from public\.content_shares as share[\s\S]*?join public\.content_definitions as definition/,
    );
    expect(campaignList).not.toContain("update public.content_definitions");
    expect(campaignList).not.toContain("insert into public.content_shares");
  });

  it("discovers only exact-character usable current feats", () => {
    expect(discoveryFunction).toBeDefined();
    expect(discoveryFunction).toMatch(
      /from public\.characters as character[\s\S]*?character\.id = target_character_id[\s\S]*?character\.user_id = actor_id/,
    );
    expect(discoveryFunction).toContain("definition.system_id = character_system_id");
    expect(discoveryFunction).toContain("definition.content_type = 'feat'");
    expect(discoveryFunction).toContain("definition.is_retired = false");
    expect(discoveryFunction).toContain(
      "private.can_use_content_version(\n      target_character_id,\n      definition.id,\n      definition.version",
    );
    expect(discoveryFunction).toContain("private.feat_prerequisite_status(");
    expect(discoveryFunction).toMatch(
      /char_length\(coalesce\(search_query, ''\)\) > 200/,
    );
    expect(discoveryFunction).toMatch(
      /limit least\(greatest\(coalesce\(result_limit, 50\), 1\), 50\)/,
    );
  });

  it("evaluates supported prerequisites without the candidate feat's own effects", () => {
    expect(abilityFunction).toBeDefined();
    expect(abilityFunction).toMatch(
      /excluded_content_id is null or ref\.content_id <> excluded_content_id/,
    );
    expect(abilityFunction).toContain("version.content_type_snapshot in ('race', 'subrace')");
    expect(abilityFunction).toContain("version.data_snapshot->'scores'");
    expect(abilityFunction).toContain("version.effects_snapshot");
    expect(abilityFunction).toContain("choice.value->>'mode' = 'asi'");
    expect(migration).toContain("prerequisite->>'op' <> 'gte'");
    expect(migration).toContain("this feat uses an unsupported prerequisite");
  });

  it("locks one earned ASI occurrence and writes its choice and ref atomically", () => {
    expect(choiceFunction).toBeDefined();
    expect(choiceFunction).toMatch(
      /from public\.characters as character[\s\S]*?character\.user_id = actor_id[\s\S]*?for update/,
    );
    expect(choiceFunction).toContain("feature.data_snapshot->>'feature_type' = 'asi'");
    expect(choiceFunction).toContain("private.is_character_feature_grant_active(grant_row.id)");
    expect(choiceFunction).toContain(
      "coalesce(pg_catalog.cardinality(matching_grant_ids), 0) <> 1",
    );
    expect(choiceFunction).toContain("choice_source_value := 'choice:asi:' || target_grant.id::text");
    expect(choiceFunction).toMatch(
      /delete from public\.character_content_refs as ref[\s\S]*?update public\.characters as character[\s\S]*?if choice_mode = 'feat' then[\s\S]*?insert into public\.character_content_refs/,
    );
  });

  it("validates ASI shape, uniqueness, score caps, exact feat versions, and duplicates", () => {
    expect(choiceFunction).toContain("jsonb_array_length(ability_allocations) not in (1, 2)");
    expect(choiceFunction).toContain("two distinct +1 abilities");
    expect(choiceFunction).toContain("> 20");
    expect(choiceFunction).toContain("selected_feat.version is distinct from target_feat_version");
    expect(choiceFunction).toContain("errcode = '40001'");
    expect(choiceFunction).toContain("private.can_use_content_version(");
    expect(choiceFunction).toContain("that feat is already selected for another asi");
    expect(choiceFunction).toMatch(
      /existing_ref\.content_id = selected_feat\.id[\s\S]*?existing_ref\.choice_source like 'choice:asi:%'[\s\S]*?existing_ref\.choice_source <> choice_source_value/,
    );
    expect(choiceFunction).toContain("private.feat_prerequisite_status(");
  });

  it("reserves ASI refs and prunes both choice state and its pin after level-down", () => {
    expect(migration).toContain("create trigger enforce_asi_choice_ref_boundary");
    expect(migration).toContain("new.choice_source like 'choice:asi:%'");
    expect(migration).toMatch(
      /create policy "owner can delete character content refs"[\s\S]*?choice_source not like 'choice:asi:%'/,
    );
    expect(migration).toContain("create trigger prune_inactive_asi_choices_before_choices");
    expect(migration).toContain("before update of choices on public.characters");
    expect(migration).toMatch(
      /create or replace function private\.prune_inactive_feature_refs_after_choices[\s\S]*?ref\.choice_source like 'choice:asi:%'[\s\S]*?private\.is_character_feature_grant_active\(grant_row\.id\)/,
    );
  });

  it("exposes discovery and mutation only to authenticated callers", () => {
    expect(migration).toMatch(
      /revoke all on function public\.search_usable_feats_for_character\(uuid, text, integer\)[\s\S]*?from public, anon, authenticated, service_role/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.search_usable_feats_for_character\(uuid, text, integer\)[\s\S]*?to authenticated/,
    );
    expect(migration).toMatch(
      /revoke all on function public\.set_character_asi_choice\([\s\S]*?\) from public, anon, authenticated, service_role/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.set_character_asi_choice\([\s\S]*?\) to authenticated/,
    );
  });
});
