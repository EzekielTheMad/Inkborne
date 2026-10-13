import { nativeInstantMicros } from "@/lib/character/durable-hit-die-kernel-model";
import { parseArcanumRead, parseArcanumRequest, arcanumCaptureSchema, arcanumReceiptSchema, sameArcanumJson,
  type ArcanumCapture, type ArcanumReceipt } from "@/lib/spells/arcanum-selection-schema";

export function arcanumFunctionBody(sql: string, name: string): string {
  const start = sql.indexOf(`CREATE FUNCTION private.${name}(`);
  const end = sql.indexOf("END $$;", start);
  if (start < 0 || end < 0) throw new Error(`Missing actual staged body ${name}`);
  return sql.slice(start, end + 7);
}
function requireTokens(body: string, tokens: string[]) {
  for (const token of tokens) if (!body.includes(token)) throw new Error(`Static source binding lost: ${token}`);
}
type StoredRows = { parent: { id: string; owner_id: string; system_id: string; revision: string; state: unknown };
  captures: ArcanumCapture[]; receipts: ArcanumReceipt[] };
type ModeledAfterPrefix = { current_actor_id: string; before_at: string; return_at: string; expires_at: string };
const physicalColumns = ["schema_version", "capture_kind", "character_id", "selection_id", "system_id", "earned_occurrence_id", "origin_id",
  "operation_id", "original_actor_id", "accepted_at", "before_revision", "after_revision", "original_feature_grant_id", "controller_ref_id",
  "controller_content_id", "controller_version", "derived_feature_ref_id", "feature_content_id", "feature_version", "feature_slug",
  "unlock_level", "spell_content_id", "spell_version"] as const;

/** Source-bound hypothetical POST-prefix phases, NOT an Auth/SQL interpreter.
 * Real entry is bound to original Auth denial. Only original tests can inject
 * recorded rows/phase clocks; there is no production import or positive issuer. */
export function arcanumSelectionSourceModel(sql: string, authoritySql: string, rows: StoredRows) {
  const prefix = arcanumFunctionBody(sql, "lock_arcanum_parent_v1");
  requireTokens(prefix, ["SECURITY DEFINER SET search_path=''", "private.require_verified_hit_die_auth_v1(p_verified_context)",
    "private.lock_character_writer_guard_v1()", "parent.id=p_character_id", "parent.user_id=(p_verified_context->>'actor_id')::uuid FOR UPDATE", "pg_catalog.clock_timestamp()>="]);
  const authStart = authoritySql.indexOf("CREATE FUNCTION private.require_verified_hit_die_auth_v1(");
  const authEnd = authoritySql.indexOf("END $$;", authStart);
  if (authStart < 0 || authEnd < 0) throw new Error("Missing frozen native Auth body");
  requireTokens(authoritySql.slice(authStart, authEnd), ["RAISE EXCEPTION 'auth_unavailable'"]);
  for (const name of ["canonical", "lineage", "order"]) requireTokens(sql, [`CREATE FUNCTION private.arcanum_${name}_ready_v1(p_character_id uuid) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT false $$;`]);
  requireTokens(sql, ["CREATE FUNCTION private.arcanum_prerequisite_refusal_v1(p_character_id uuid) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT '{\"status\":\"unready\",\"reason\":\"canonical_lineage_order_unimplemented\"}'::jsonb $$;"]);
  for (const name of ["select_arcanum_spell_v1", "resolve_arcanum_selection_v1", "read_locked_arcanum_selection_v1"]) {
    const body = arcanumFunctionBody(sql, name);
    requireTokens(body, ["c:=private.lock_arcanum_parent_v1", "PERFORM private.require_verified_hit_die_auth_v1(p_verified_context)",
      "parent.id=c.id AND parent.user_id=", "pg_catalog.clock_timestamp()>=", "RETURN result;"]);
    if (body.indexOf("PERFORM private.require_verified_hit_die_auth_v1") < body.indexOf("result:=")) throw new Error("Terminal Auth not after construction");
    if (/\b(?:INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM)\b/i.test(body)) throw new Error("Positive issuer/body mutation forbidden");
    if (name !== "read_locked_arcanum_selection_v1") requireTokens(body, ["SELECT command.receipt,selection.capture", "WHERE command.character_id=c.id AND command.operation_id=", "private.arcanum_receipt_correspondence_v1"]);
  }
  const select = arcanumFunctionBody(sql, "select_arcanum_spell_v1");
  if (select.indexOf("SELECT command.receipt") >= select.indexOf("result:=private.arcanum_prerequisite_refusal_v1")) throw new Error("Replay must precede NEW prerequisite refusal");
  for (const name of ["arcanum_immutable_row_v1", "arcanum_pair_closure_v1"]) {
    requireTokens(arcanumFunctionBody(sql, name), ["SECURITY DEFINER SET search_path=''", "parent.id=", "NEW.character_id"]);
    requireTokens(sql, [`ALTER FUNCTION private.${name}() OWNER TO inkborne_hit_die_authority_owner;`]);
  }
  requireTokens(arcanumFunctionBody(sql, "arcanum_immutable_row_v1"), ["parent.id=OLD.character_id", "parent.id=NEW.character_id AND parent.system_id=NEW.system_id", "NOT NEW.capture @> identity", "capture_lifetime_immutable", "capture_identity_immutable"]);
  requireTokens(arcanumFunctionBody(sql, "arcanum_pair_closure_v1"), ["selection.character_id=NEW.character_id", "command.character_id=NEW.character_id", "s.capture IS DISTINCT FROM r.capture", "selection_pair_absent", "reciprocal_pair_mismatch"]);
  const checkOwner = (phase: ModeledAfterPrefix, at: string) => {
    if (phase.current_actor_id !== rows.parent.owner_id) throw new Error("CURRENT_OWNER_DENIED");
    if (nativeInstantMicros(at) >= nativeInstantMicros(phase.expires_at)) throw new Error("CURRENT_EXPIRY_DENIED");
  };
  const pairedReceipt = (operationId: string) => {
    const list = rows.receipts.filter(r => r.character_id === rows.parent.id && r.operation_id === operationId);
    if (list.length > 1) throw new Error("RECIPROCAL_GRAPH_UNAVAILABLE");
    if (!list.length) return null;
    const r = arcanumReceiptSchema.parse(list[0]);
    const c = rows.captures.filter(c => c.character_id === rows.parent.id && c.selection_id === r.selection_id && c.operation_id === operationId);
    if (c.length !== 1 || !sameArcanumJson(c[0], r.capture)) throw new Error("RECIPROCAL_GRAPH_UNAVAILABLE");
    return r;
  };
  return {
    // Bound to actual frozen Auth's unconditional exception; no supplied proof can activate it.
    invokeActualEntryForTest() { throw new Error("AUTH_UNAVAILABLE"); },
    lifetimeGuardForTest(operation: "INSERT" | "UPDATE" | "DELETE", row: ArcanumCapture & { capture: ArcanumCapture },
      visibleParents: Array<{ id: string; system_id: string }>) {
      if (operation === "DELETE") {
        if (visibleParents.some(parent => parent.id === row.character_id)) throw new Error("CAPTURE_LIFETIME_IMMUTABLE");
        return "model_checked_exact_parent_cascade";
      }
      if (operation !== "INSERT") throw new Error("CAPTURE_IDENTITY_IMMUTABLE");
      if (!visibleParents.some(parent => parent.id === row.character_id && parent.system_id === row.system_id)) throw new Error("EXACT_PARENT_UNAVAILABLE");
      const capture = arcanumCaptureSchema.parse(row.capture);
      if (physicalColumns.some(key => capture[key] !== row[key])) throw new Error("CAPTURE_ROW_CORRESPONDENCE");
      return "model_checked_structural_insert_only"; // FORCE-RLS has no INSERT policy; this is NOT native admission.
    },
    deferredPairForTest(visibleParentIds: string[]) {
      if (!visibleParentIds.includes(rows.parent.id)) return "model_checked_exact_parent_cascade";
      for (const c of rows.captures) if (!pairedReceipt(c.operation_id)) throw new Error("RECIPROCAL_GRAPH_UNAVAILABLE");
      for (const r of rows.receipts) if (!pairedReceipt(r.operation_id)) throw new Error("RECIPROCAL_GRAPH_UNAVAILABLE");
      return "model_checked_pair_closure";
    },
    readRecordedAfterPrefixForTest(phase: ModeledAfterPrefix) {
      checkOwner(phase, phase.before_at);
      const result = parseArcanumRead({ status: "read", read_version: 1, character_id: rows.parent.id, system_id: rows.parent.system_id,
        revision: rows.parent.revision, native_read_at: phase.return_at,
        counts: { selections: String(rows.captures.length), receipts: String(rows.receipts.length) },
        selections: structuredClone(rows.captures), receipts: structuredClone(rows.receipts), state: structuredClone(rows.parent.state),
        current_eligibility: { status: "unavailable", reason: "prerequisites_unimplemented" } });
      checkOwner(phase, phase.return_at); return result;
    },
    selectAfterPrefixForTest(raw: unknown, phase: ModeledAfterPrefix) {
      const request = parseArcanumRequest(raw); checkOwner(phase, phase.before_at);
      const receipt = pairedReceipt(request.operation_id);
      const result = receipt ? sameArcanumJson(request, receipt.canonical_intent)
        ? { status: "recorded" as const, receipt: structuredClone(receipt) } : { status: "intent_conflict" as const }
        : { status: "unready" as const, reason: "canonical_lineage_order_unimplemented" as const };
      checkOwner(phase, phase.return_at); return result;
    },
    resolveAfterPrefixForTest(operationId: string, phase: ModeledAfterPrefix) {
      checkOwner(phase, phase.before_at); const receipt = pairedReceipt(operationId);
      const result = receipt ? { status: "recorded" as const, receipt: structuredClone(receipt) } : { status: "absent" as const };
      checkOwner(phase, phase.return_at); return result;
    },
  };
}
