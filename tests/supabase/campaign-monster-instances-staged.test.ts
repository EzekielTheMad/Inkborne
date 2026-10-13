import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync("supabase/staged/campaign-monster-instances.sql", "utf8");
const body = (name: string) => sql.slice(sql.indexOf(`CREATE FUNCTION ${name}(`)).split("END $$;")[0];
describe("UNAPPLIED campaign monster SQL static critical paths", () => {
  it("is an independent transaction with no character guard/kernel/shared authority", () => {
    expect(sql).toContain("BEGIN;"); expect(sql.trim()).toMatch(/COMMIT;$/);
    for (const absent of ["lock_character_writer_guard", "action_revision", "class_origin_", "UPDATE public.characters", "content_shares"]) expect(sql).not.toContain(absent);
    expect(sql).toContain("SELECT false"); expect(sql).toContain("NOLOGIN NOBYPASSRLS NOINHERIT");
  });
  it("closes default privileges and prevents source writes despite row-lock rights", () => {
    expect(sql).toContain("FROM PUBLIC,anon,authenticated,service_role");
    expect(sql).toContain("FORCE ROW LEVEL SECURITY"); expect(sql).toContain("AS RESTRICTIVE FOR UPDATE");
    expect(sql).toContain("WITH CHECK(false)"); expect(sql).toContain("GRANT SELECT ON public.campaign_monster_instances TO authenticated");
    expect(sql).not.toContain("GRANT INSERT ON public.campaign_monster_instances TO authenticated");
  });
  it("locks receipt operation and returns replay before new source/CAS work", () => {
    const commit = body("public.commit_campaign_monster_instance_v1");
    expect(commit.indexOf("pg_advisory_xact_lock")).toBeLessThan(commit.indexOf("SELECT command.* INTO prior"));
    expect(commit.indexOf("RETURN prior.receipt")).toBeLessThan(commit.indexOf("source := private.campaign_monster_source_v1"));
    expect(commit.indexOf("INSERT INTO public.campaign_monster_instances")).toBeLessThan(commit.indexOf("INSERT INTO private.campaign_monster_commands_v1"));
    expect(body("public.resolve_campaign_monster_command_v1")).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("PRIMARY KEY(campaign_id,operation_id)");
  });
  it("uses native source→system→campaign→version order with exact snapshot/current tuple", () => {
    const source = body("private.campaign_monster_source_v1");
    expect(source.indexOf("FROM public.content_definitions")).toBeLessThan(source.indexOf("FROM public.game_systems"));
    expect(source.indexOf("FROM public.game_systems")).toBeLessThan(source.indexOf("campaign_system := private.campaign_monster_owner_v1"));
    expect(source.indexOf("campaign_system := private.campaign_monster_owner_v1")).toBeLessThan(source.indexOf("FROM public.content_versions"));
    expect(source).toContain("definition.scope='personal' AND definition.owner_id=actor"); expect(source).toContain("IS DISTINCT FROM ROW(definition.id");
    expect(source).toContain("v.version=expected_version"); expect(source).not.toContain("scope='shared'");
  });
  it("keeps source/maxHP immutable and only native trigger increments changed revision", () => {
    expect(body("private.campaign_monster_row_guard_v1")).toContain("NEW.source_snapshot,NEW.source_digest,NEW.declared_max_hp");
    expect(body("private.campaign_monster_row_guard_v1")).toContain("NEW.revision := OLD.revision+1");
    expect(sql).toContain("Archive instead of delete"); expect(sql).toContain("Immutable command receipt");
    expect(sql).not.toMatch(/source_content_id uuid[^\n]*REFERENCES/);
    expect(sql).toContain("ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED");
  });
  it("returns exact text revisions, bounded summaries, owner-only reads and no SQL execution proof", () => {
    expect(body("public.list_campaign_monster_instances_v1")).toContain("LIMIT 20 OFFSET page_number*20");
    expect(body("public.list_campaign_monster_instances_v1")).toContain("ORDER BY i.name,i.id");
    expect(body("public.get_campaign_monster_instance_v1")).toContain("'revision',item.revision::text");
    expect(sql).toContain("expiration <= extract(epoch FROM pg_catalog.clock_timestamp())");
    expect(body("private.campaign_monster_snapshot_v1")).toContain("NOT complete Zod descriptive parity");
  });
});
