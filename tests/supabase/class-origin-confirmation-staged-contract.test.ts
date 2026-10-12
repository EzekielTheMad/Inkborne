import { describe, expect, it } from "vitest";
import { createClassConfirmationProducerModel } from "@/lib/character/class-origin-confirmation-model";
import { classConfirmationSources } from "@/tests/fixtures/class-origin-confirmation";

const sources = classConfirmationSources(), sql = sources.confirmation.replace(/\r\n/g, "\n");
function body(name: string) {
  const start = sql.indexOf(`CREATE FUNCTION private.${name}(`), open = sql.indexOf("AS $$", start), end = sql.indexOf("$$;", open + 5);
  expect(start).toBeGreaterThan(-1); return sql.slice(start, end + 3);
}
describe("P1b.2 unapplied staged source/ACL contract only; no SQL engine", () => {
  it("orders preflight/lock-only policies → class inputs → authority source locks → before validator → private entry/ACL closure", () => {
    const entries = ["BEGIN;", "Frozen prerequisite/owner/disabled manifest required", "GRANT UPDATE(id)", "CREATE POLICY class_confirmation_no_mutation",
      "CREATE FUNCTION private.class_confirmation_private_inputs_v1", "GRANT EXECUTE ON FUNCTION private.class_confirmation_private_inputs_v1",
      "CREATE FUNCTION private.lock_class_confirmation_sources_v1", "GRANT EXECUTE ON FUNCTION private.lock_class_confirmation_sources_v1",
      "CREATE FUNCTION private.validate_class_confirmation_before_v1", "CREATE FUNCTION private.confirm_already_first_class_origin_v1",
      "REVOKE ALL ON FUNCTION private.confirm_already_first_class_origin_v1", "COMMIT;"];
    let previous = -1; for (const text of entries) { const next = sql.indexOf(text); expect(next).toBeGreaterThan(previous); previous = next; }
    expect(sql).not.toContain("CREATE OR REPLACE FUNCTION"); expect(sql).not.toMatch(/CREATE (?:TABLE|ROLE)/);
  });
  it("native after-wait and immediate pre-return checks precede all new-history/source reads", () => {
    const entry = body("confirm_already_first_class_origin_v1"), lookup = entry.indexOf("SELECT command.receipt INTO previous"), replay = entry.indexOf("'status','replayed'");
    expect(entry).toContain("SELECT command.receipt INTO previous FROM private.character_class_commands_v1 AS command");
    expect(entry).toContain("WHERE command.character_id=c.id AND command.operation_id=(p_intent->>'operation_id')::uuid");
    expect(entry).not.toContain("SELECT receipt INTO previous");
    expect(entry.indexOf("require_class_origin_auth_v1")).toBeLessThan(entry.indexOf("lock_character_writer_guard_v1"));
    const guard = entry.indexOf("lock_character_writer_guard_v1"), parent = entry.indexOf("FOR UPDATE", guard), afterWaitAuth = entry.indexOf("require_class_origin_auth_v1", parent);
    expect(afterWaitAuth).toBeGreaterThan(parent); expect(afterWaitAuth).toBeLessThan(lookup);
    expect(entry.indexOf("clock_timestamp()>=", afterWaitAuth)).toBeLessThan(lookup);
    const preReturnAuth = entry.indexOf("require_class_origin_auth_v1", lookup); expect(preReturnAuth).toBeLessThan(replay);
    expect(entry.indexOf("clock_timestamp()>=", preReturnAuth)).toBeLessThan(replay);
    expect(entry.indexOf("sources:=private.lock_class_confirmation_sources_v1")).toBeGreaterThan(replay);
    expect(entry.slice(0, replay)).not.toMatch(/FROM private\.(?:character_class_origin|character_class_occurrences|character_creation_commands|class_writer_acceptance)_v1/);
    expect(entry.slice(lookup, replay)).toContain("previous->'canonical_intent' IS DISTINCT FROM p_intent");
  });
  it("immutable receipts use existing bytes/guards; only historical journal/proof rows use existing locks", () => {
    const inputs = body("class_confirmation_private_inputs_v1");
    expect(inputs).toContain("FROM private.character_creation_commands_v1 WHERE target_character_id=p_character_id");
    expect(inputs).toContain("AND receipt=selection.receipt"); expect(inputs).toContain("FOR SHARE OF t");
    expect(inputs).toContain("historical_consumption_mismatch"); expect(inputs).toContain("NOT t.consumed OR NOT j.planned_transitions @>");
    expect(inputs).not.toMatch(/(?:character_creation_commands_v1|character_class_commands_v1)[^;]*FOR SHARE/);
    expect(sql).not.toMatch(/GRANT UPDATE[^;]*(?:character_creation_commands_v1|character_class_commands_v1)/);
    expect(sources.p1a).toContain("class_origin_creation_receipt_immutable BEFORE UPDATE OR DELETE");
    expect(sources.p1a).toContain("class_origin_class_receipt_immutable BEFORE UPDATE OR DELETE");
  });
  it("derives all retained tuples internally with ordered native locks and post-wait recheck", () => {
    const inputs = body("class_confirmation_private_inputs_v1"), locks = body("lock_class_confirmation_sources_v1");
    for (const domain of ["character_content_refs", "character_inventory", "character_spells", "character_feature_grants", "character_spell_grants", "character_class_occurrences_v1"]) expect(inputs).toContain(domain);
    expect(locks).toContain("inputs:=private.class_confirmation_private_inputs_v1(c.id,p_selected_occurrence_id)");
    expect(locks).toContain("ORDER BY d.id FOR SHARE"); expect(locks).toContain("ORDER BY v.content_id,v.version FOR SHARE OF v");
    expect(locks).toContain("WHERE character_id=$1 ORDER BY id FOR SHARE"); expect(locks).toContain("after_inputs IS DISTINCT FROM inputs");
    const definition = locks.indexOf("ORDER BY d.id FOR SHARE"), system = locks.indexOf("FROM public.game_systems"), campaign = locks.indexOf("FROM public.campaigns"), member = locks.indexOf("FROM public.campaign_members"), share = locks.indexOf("FROM public.content_shares"), version = locks.indexOf("ORDER BY v.content_id,v.version FOR SHARE OF v");
    expect(definition).toBeLessThan(system); expect(system).toBeLessThan(campaign); expect(campaign).toBeLessThan(member); expect(member).toBeLessThan(share); expect(share).toBeLessThan(version);
    expect(locks).not.toMatch(/p_(?:tuples|graph|sources|actor_id)/); expect(locks).not.toContain("read_locked_hit_die_graph_v1");
  });
  it("requires both pinned/current entitlement and nonretired selected sources without repin", () => {
    const locks = body("lock_class_confirmation_sources_v1");
    for (const text of ["version.scope_snapshot='platform'", "version.owner_id_snapshot=c.user_id", "definition.scope='platform'", "definition.owner_id=c.user_id",
      "campaign.owner_id=c.user_id OR EXISTS", "snapshot_allowed AND current_allowed AND NOT definition.is_retired", "definition.content_type IS DISTINCT FROM version.content_type_snapshot",
      "definition.slug IS DISTINCT FROM version.slug_snapshot", "version.system_id_snapshot IS DISTINCT FROM c.system_id"]) expect(locks).toContain(text);
    expect(locks).not.toMatch(/(?:UPDATE|INSERT INTO) public\./); expect(locks).not.toContain("can_use_content_version(");
  });
  it("binds actual bootstrap zero-capture and selected retained INSERT lineage, not first click or caller flag", () => {
    const validator = body("validate_class_confirmation_before_v1");
    for (const text of ["creation->>'verified_actor_id' IS DISTINCT FROM parent->>'user_id'", "bootstrap->'receipt' IS DISTINCT FROM receipt",
      "bootstrap#>>'{preinsert_proof,transaction_id}'", "initial#>>'{parent,action_revision}' IS DISTINCT FROM '0'", "initial#>>'{origin,command_revision}' IS DISTINCT FROM '0'",
      "initial#>>'{order,producer_revision}' IS DISTINCT FROM '0'", "t.before_row IS NULL", "t.after_row=creation AND t.consumed", "data_snapshot,parent_class",
      "selection#>>'{receipt,canonical_intent,fields,content_id}'", "'selected_at','controller_ref_id'", "reverse_class_graph_mismatch"]) expect(validator).toContain(text);
    expect(validator).not.toContain("class_origin_finalize_bootstrap_v1(");
  });
  it("derives current native time/three proofs and actual occurrence→origin→receipt/finalizer with only joint bump", () => {
    const entry = body("confirm_already_first_class_origin_v1");
    const marker = entry.indexOf("INSERT INTO private.class_writer_acceptance_v1"), occurrence = entry.indexOf("UPDATE private.character_class_occurrences_v1"), origin = entry.indexOf("UPDATE private.character_class_origin_v1"), receipt = entry.indexOf("INSERT INTO private.character_class_commands_v1"), final = entry.indexOf("SET finalized=true"), closure = entry.indexOf("private.class_origin_finalize_acceptance_v1(new_acceptance)");
    expect(entry.indexOf("accepted:=pg_catalog.clock_timestamp()")).toBeLessThan(marker); expect(marker).toBeLessThan(occurrence); expect(occurrence).toBeLessThan(origin); expect(origin).toBeLessThan(receipt); expect(receipt).toBeLessThan(final); expect(final).toBeLessThan(closure);
    expect(entry.slice(entry.indexOf("transitions:="), marker).match(/'relation_key'/g)).toHaveLength(3);
    expect(entry).toContain("acquired_character_level=1"); expect(entry).toContain("accepted_json:=pg_catalog.to_jsonb(accepted)");
    expect(entry).not.toContain("UPDATE public.characters"); expect(entry).not.toContain("UPDATE private.character_projection_order_v1");
    expect(entry).not.toContain("SET revision_transition_consumed"); expect(entry).not.toContain("EXCEPTION WHEN");
    expect(sources.joint).toContain("class_origin_metadata_revision_dispatch AFTER UPDATE"); expect(sources.p1a).toContain("DEFERRABLE INITIALLY DEFERRED");
  });
  it("closes exact helper-only original-owner bridges with five lock-key policies and no receipt privileges", () => {
    expect(sql).toContain("GRANT UPDATE(id) ON public.character_content_refs,public.character_inventory,public.character_spells,");
    expect(sql).toContain("public.character_feature_grants,public.character_spell_grants TO inkborne_hit_die_authority_owner");
    expect(sql).toContain("AS RESTRICTIVE FOR UPDATE TO inkborne_hit_die_authority_owner USING(true) WITH CHECK(false)");
    expect(sql).toContain("ALTER FUNCTION private.lock_class_confirmation_sources_v1(jsonb,uuid,uuid) OWNER TO inkborne_hit_die_authority_owner");
    expect(sql).toContain("ALTER FUNCTION private.confirm_already_first_class_origin_v1(jsonb,jsonb) OWNER TO inkborne_class_origin_owner");
    expect(sql.match(/GRANT EXECUTE/g)).toHaveLength(2); expect(sql).not.toMatch(/GRANT EXECUTE[^;]*confirm_already_first_class_origin_v1/);
    expect(sql).toContain("FROM PUBLIC,anon,authenticated,service_role"); expect(sql).not.toMatch(/GRANT[^;]*class_writer_(?:acceptance|row_transitions)_v1/);
  });
  it("still denies actual Auth and leaves bootstrap/readiness/public issuer/all writers unopened", () => {
    expect(sources.p1a).toContain("RAISE EXCEPTION 'auth_unavailable'"); expect(sources.authority).toContain("RAISE EXCEPTION 'auth_unavailable'");
    expect(sql).not.toMatch(/CREATE(?: OR REPLACE)? FUNCTION (?:public\.|private\.require_)/);
    expect(sql).not.toMatch(/(?:INSERT INTO|UPDATE) private\.(?:character_writer_readiness_v1|class_origin_gate_v1)/);
    expect(sql).not.toMatch(/(?:SET ROLE|set_config|current_setting|current_user)/);
    expect(createClassConfirmationProducerModel(sources).traceEntryForTest()).toMatchObject({ status: "model_refused", reason: "auth_unavailable" });
  });
  it("constructor guards bind actual staged critical bodies, separately from semantic evidence", () => {
    for (const token of ["SELECT command.receipt INTO previous", "WHERE command.character_id=c.id AND command.operation_id=(p_intent->>'operation_id')::uuid",
      "new_acceptance:=pg_catalog.gen_random_uuid()", "historical_consumption_mismatch", "NOT definition.is_retired"]) {
      expect(() => createClassConfirmationProducerModel({ ...sources, confirmation: sql.replace(token, "REMOVED_CRITICAL_BODY") })).toThrow("Actual producer critical path changed");
    }
  });
});
