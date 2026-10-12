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
    expect(reader).toContain("feature_content_id,feature_version FROM public.character_feature_grants");
    expect(reader).toContain("spell_content_id,spell_version FROM public.character_spell_grants");
    expect(reader).toContain("r.feature_grant_id"); expect(reader).toContain("pg_catalog.to_jsonb(r)"); expect(reader).not.toContain("LIMIT "); expect(reader).not.toContain("digest(");
  });
  it("projects only persisted domain order and denies missing/extra/version-lost rows",()=>{
    expect(reader).toContain("WITH ORDINALITY ordered(id,position)"); expect(reader).toContain("ORDER BY ordered.position");
    expect(reader).toContain("ordering.producer_revision <> c.action_revision"); expect(reader).toContain("legacy_order_unproven");
    expect(reader).toContain("pg_catalog.cardinality(ordering.pins) <> n_pins"); expect(reader).toContain("value = 'null'::jsonb");
    expect(sql).not.toContain("INSERT INTO private.character_projection_order_v1");
  });
  it("executes an inspiration-only atomic CAS, once-bumped revision and order-only rebind",()=>{
    expect(cas).toContain("ARRAY['inspiration']"); expect(cas).toContain("'boolean'"); expect(cas).toContain("FOR UPDATE");
    expect(cas.indexOf("next_state = c.state")).toBeLessThan(cas.indexOf("UPDATE public.characters"));
    expect(cas).toContain("UPDATE public.characters SET state = next_state"); expect(cas).toContain("c.action_revision <> expected + 1");
    const rebind=sql.slice(sql.indexOf("CREATE FUNCTION private.hit_die_order_revision_rebind_v1"),sql.indexOf("CREATE FUNCTION public.patch_character_state_at_revision_v1"));
    expect(rebind).toContain("SET producer_revision = NEW.action_revision"); expect(rebind).not.toMatch(/SET\s+(pins|inventory|spells|feature_grants|spell_grants)/);
    expect(cas.slice(cas.indexOf("UPDATE public.characters"))).not.toContain("EXCEPTION WHEN");
  });
  it("contains no lifecycle/Auth/Storage mutation or active cutover",()=>{
    expect(sql).not.toMatch(/CREATE TRIGGER[^;]*ON (?:public\.)?profiles|DELETE FROM auth\.|UPDATE auth\.|storage\.objects|ready\s*=\s*true/i);
    expect(sql).toContain("FINAL CUTOVER MANIFEST"); expect(sql).toContain("No statement-role guard activation");
  });
});
