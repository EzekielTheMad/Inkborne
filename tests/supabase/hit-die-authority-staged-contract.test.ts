import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql=readFileSync("supabase/staged/hit-die-authority-and-writers.sql","utf8");
const cas=sql.slice(sql.indexOf("CREATE FUNCTION public.patch_character_state_at_revision_v1"),sql.indexOf("-- No sessionless"));
const reader=sql.slice(sql.indexOf("CREATE FUNCTION private.read_locked_hit_die_graph_v1"),sql.indexOf("CREATE FUNCTION public.read_hit_die_graph_v1"));
describe("authority source-only contracts; no PostgreSQL/roles/concurrency proof",()=>{
  it("leaves production Auth unavailable and never guesses Auth table SQL",()=>{
    const auth=sql.slice(sql.indexOf("CREATE FUNCTION private.require_verified_hit_die_auth_v1"),sql.indexOf("CREATE FUNCTION private.hit_die_context_shape_v1"));
    expect(auth).toContain("RAISE EXCEPTION 'auth_unavailable'"); expect(auth).not.toMatch(/SELECT|FROM auth\./);
    expect(sql).not.toMatch(/GRANT[^;]*ON[^;]*auth\./i); expect(sql).toContain("pg_catalog.count(*) = 13"); expect(sql).toContain("ready boolean NOT NULL DEFAULT false");
  });
  it("installs objects/owners/ACLs atomically and retires every sessionless public kernel entry",()=>{
    expect(sql.indexOf("BEGIN;")).toBeLessThan(sql.indexOf("CREATE ROLE")); expect(sql.trim().endsWith("COMMIT;")).toBe(true);
    expect(sql).toContain("public.read_hit_die_receipt_v1(uuid,jsonb,text), public.resolve_hit_die_snapshot_v1(uuid,uuid)");
    expect(sql).toContain("public.commit_hit_die_v1(uuid,jsonb,jsonb,jsonb,text,timestamptz) FROM PUBLIC,anon,authenticated,service_role");
    expect(sql).not.toMatch(/GRANT\s+CREATE|GRANT\s+inkborne_hit_die_authority_owner\s+TO/i);
  });
  it("counts raw source rows before left-joined ordered projections and carries every version tuple",()=>{
    expect(reader).toContain("SELECT pg_catalog.count(*) INTO n_pins FROM public.character_content_refs");
    expect(reader).toContain("LEFT JOIN public.content_versions"); expect(reader).toContain("required LEFT JOIN public.content_versions");
    expect(reader.indexOf("INTO n_pins")).toBeLessThan(reader.indexOf("INTO pins FROM"));
    expect(reader).toContain("feature.feature_content_id,feature.feature_version FROM public.character_feature_grants");
    expect(reader).toContain("grant_row.spell_content_id,grant_row.spell_version FROM public.character_spell_grants");
    expect(reader).toContain("r.feature_grant_id"); expect(reader).toContain("pg_catalog.to_jsonb(r)"); expect(reader).not.toContain("LIMIT "); expect(reader).not.toContain("digest(");
  });
  it("projects only persisted domain order and denies missing/extra/version-lost rows",()=>{
    expect(reader).toContain("WITH ORDINALITY ordered(id,position)"); expect(reader).toContain("ORDER BY ordered.position");
    expect(reader).toContain("ordering.producer_revision <> c.action_revision"); expect(reader).toContain("legacy_order_unproven");
    expect(reader).toContain("pg_catalog.cardinality(ordering.pins) <> n_pins"); expect(reader).toContain("version_entry.value = 'null'::jsonb");
    expect(sql).not.toContain("INSERT INTO private.character_projection_order_v1");
  });
  it("executes an inspiration-only atomic CAS, once-bumped revision and order-only rebind",()=>{
    expect(cas).toContain("ARRAY['inspiration']"); expect(cas).toContain("'boolean'"); expect(cas).toContain("FOR UPDATE");
    expect(cas.indexOf("next_state = c.state")).toBeLessThan(cas.indexOf("UPDATE public.characters"));
    expect(cas).toContain("UPDATE public.characters AS target SET state = next_state"); expect(cas).toContain("c.action_revision <> expected + 1");
    const rebind=sql.slice(sql.indexOf("CREATE FUNCTION private.hit_die_order_revision_rebind_v1"),sql.indexOf("CREATE FUNCTION public.patch_character_state_at_revision_v1"));
    expect(rebind).toContain("SET producer_revision = NEW.action_revision"); expect(rebind).not.toMatch(/SET\s+(pins|inventory|spells|feature_grants|spell_grants)/);
    expect(cas.slice(cas.indexOf("UPDATE public.characters"))).not.toContain("EXCEPTION WHEN");
  });
  it("contains no lifecycle/Auth/Storage mutation or active cutover",()=>{
    expect(sql).not.toMatch(/CREATE TRIGGER[^;]*ON (?:public\.)?profiles|DELETE FROM auth\.|UPDATE auth\.|storage\.objects|ready\s*=\s*true/i);
    expect(sql).toContain("FINAL CUTOVER MANIFEST"); expect(sql).toContain("No statement-role guard activation");
  });
  it("gives the isolated owner column-only lock permission and both lock visibility/mutation denial",()=>{
    expect(sql).toContain("GRANT UPDATE(id) ON public.content_definitions, public.game_systems, public.campaigns, public.campaign_members, public.content_shares TO inkborne_hit_die_authority_owner");
    expect(sql).toContain("GRANT UPDATE(content_id) ON public.content_versions TO inkborne_hit_die_authority_owner");
    for(const name of ["definition","system","campaign","member","share","version"]){
      expect(sql).toContain(`hit_die_${name}_lock`); expect(sql).toContain(`hit_die_${name}_no_mutation`);
    }
    expect(sql.match(/AS RESTRICTIVE FOR UPDATE TO inkborne_hit_die_authority_owner USING \(true\) WITH CHECK \(false\)/g)).toHaveLength(6);
    expect(sql).not.toMatch(/GRANT UPDATE ON public\.(content_definitions|game_systems|campaigns|campaign_members|content_shares|content_versions)/);
  });
  it("avoids local tuple/SQL-column ambiguity and invokes real earned validators, never field-presence completion",()=>{
    expect(reader).toContain("selected_content_id uuid; selected_content_version integer");
    expect(reader).not.toContain("SELECT content_id"); expect(reader).not.toContain("WHERE character_id");
    const authority=readFileSync("lib/character/hit-die-authority.ts","utf8");
    expect(authority).not.toContain('"feature_grant_id" in hitDieSnapshotSchema.shape.pins.element.shape');
    expect(authority).toContain('return unready("schema_unready")');
    expect(authority).toContain('import { frozenFeatureGrantSchema, resolveCharacterAsiContributions, type AsiEvidence } from "./asi-contributions"');
    expect(authority).toContain('resolveCharacterAsiContributions(c, evidence).status !== "available"');
    expect(authority).toContain("validateFrozenSpellAuthority({ character:");
    expect(authority).toContain('spells.status !== "available"');
    expect(authority).not.toContain("fixtureReaderEnabled");
  });
  it("projects v2 native immutable times from the same full LEFT JOIN/count closure outside canonical snapshot",()=>{
    expect(reader).toContain("INTO n_versions, versions, version_times FROM required LEFT JOIN public.content_versions");
    expect(reader).toContain("'content_id',v.content_id,'content_version',v.version,'created_at',private.hit_die_native_v1(v.created_at)");
    expect(reader).toContain("pg_catalog.jsonb_array_length(version_times) <> n_versions");
    expect(reader).toContain("'graph_version',2"); expect(reader).toContain("'version_times',version_times,'snapshot',snapshot");
    const snapshot = reader.slice(reader.indexOf("snapshot :="), reader.indexOf("counts :="));
    expect(snapshot).not.toContain("version_times"); expect(snapshot).toContain("'contract_version',1");
    expect(sql.match(/graph->'graph_version' IS DISTINCT FROM '2'::jsonb/g)).toHaveLength(3);
    expect(reader).not.toMatch(/JOIN public\.content_definitions[^;]*created_at|digest\(|jsonb::text/);
  });
});
