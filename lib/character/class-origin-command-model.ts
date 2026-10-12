import { boundedClassRoleJson } from "./class-role-effects-schema";
import {
  classOriginAcceptanceSchema, classOriginGraphSchema, classOriginReceiptSchema,
  CLASS_ORIGIN_GRAPH_DOMAINS, type ClassOriginAcceptance, type ClassOriginGraph,
} from "./class-origin-command-schema";

/** Source-bound reference checks, NOT SQL execution, authorization or a gameplay API. */
export const CLASS_ORIGIN_STAGE_PATH = "supabase/staged/class-origin-producer.sql";
export const CLASS_ORIGIN_FINALIZERS = {
  class_transition: "private.class_origin_finalize_transition_v1",
  bootstrap_new: "private.class_origin_finalize_bootstrap_v1",
  bootstrap_copy: "private.class_origin_finalize_bootstrap_v1",
} as const;
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "undefined";
}
const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);
const rowKey = (row: { relation_key: string; row_key: string[] }) => canonical([row.relation_key, row.row_key]);
function graphClosure(graph: ClassOriginGraph): boolean {
  if (graph.order.character_id !== graph.parent.id || graph.order.producer_revision !== graph.parent.action_revision
    || graph.origin.character_id !== graph.parent.id || graph.origin.system_id !== graph.parent.system_id) return false;
  for (const domain of CLASS_ORIGIN_GRAPH_DOMAINS) {
    const ids = graph.order[domain === "refs" ? "pins" : domain], rows = graph[domain];
    if (ids.length !== rows.length || ids.some((id, index) => rows[index].id !== id || rows[index].character_id !== graph.parent.id)) return false;
  }
  const choices = (graph.parent.choices as { classes?: unknown } | undefined)?.classes ?? [];
  if (!Array.isArray(choices) || choices.some(choice => choice === null || typeof choice !== "object" || Array.isArray(choice))
    || choices.length > 20 || new Set(choices.map(choice => choice?.occurrence_id)).size !== choices.length
    || new Set(choices.map(choice => choice?.slug)).size !== choices.length) return false;
  if (Math.max(1, choices.reduce((total, choice) => total + choice.level, 0)) !== graph.parent.level || Number(graph.parent.level) > 20) return false;
  const selectedRefs = new Set<string>(), selectedSubclasses = new Set<string>();
  for (const choice of choices) {
    if (!Number.isInteger(choice.level) || choice.level < 1 || choice.level > 20) return false;
    const occurrences = graph.occurrences.filter(row => row.id === choice.occurrence_id && row.lifecycle !== "ended" && row.character_id === graph.parent.id);
    if (occurrences.length !== 1) return false;
    const occurrence = occurrences[0], ref = graph.refs.find(row => row.id === occurrence.controller_ref_id);
    const version = ref && graph.versions.find(row => row.content_id === ref.content_id && row.version === ref.content_version);
    if (!ref || !version || occurrence.class_slug !== choice.slug || occurrence.content_id !== ref.content_id
      || occurrence.content_version !== ref.content_version || version.content_type_snapshot !== "class"
      || version.slug_snapshot !== choice.slug || version.system_id_snapshot !== occurrence.system_id
      || (ref.context as { source?: unknown })?.source !== "class") return false;
    selectedRefs.add(String(ref.id));
    if (choice.subclass !== undefined) {
      const subclass = graph.refs.find(row => row.id === occurrence.subclass_ref_id);
      const subclassVersion = subclass && graph.versions.find(row => row.content_id === subclass.content_id && row.version === subclass.content_version);
      if (!subclass || !subclassVersion || subclassVersion.content_type_snapshot !== "subclass"
        || subclassVersion.slug_snapshot !== choice.subclass || subclassVersion.system_id_snapshot !== occurrence.system_id
        || (subclassVersion.data_snapshot as { class?: unknown })?.class !== occurrence.class_slug
        || (subclass.context as { source?: unknown; class?: unknown })?.source !== "subclass"
        || (subclass.context as { class?: unknown }).class !== occurrence.class_slug) return false;
      selectedSubclasses.add(String(subclass.id));
    } else if (occurrence.subclass_ref_id !== null) return false;
  }
  if (graph.occurrences.some(row => row.lifecycle !== "ended" && !choices.some(choice => choice.occurrence_id === row.id))) return false;
  for (const ref of graph.refs) {
    const version = graph.versions.find(row => row.content_id === ref.content_id && row.version === ref.content_version);
    if (!version || version.content_type_snapshot === "class" && !selectedRefs.has(String(ref.id))
      || version.content_type_snapshot === "subclass" && !selectedSubclasses.has(String(ref.id))) return false;
  }
  const required = new Set<string>();
  for (const rows of [graph.refs, graph.inventory, graph.spells, graph.occurrences]) for (const row of rows) {
    if (row.content_id !== null && row.content_id !== undefined) required.add(canonical([row.content_id, row.content_version]));
  }
  for (const row of graph.feature_grants) required.add(canonical([row.feature_content_id, row.feature_version]));
  for (const row of graph.spell_grants) required.add(canonical([row.spell_content_id, row.spell_version]));
  const resolved = graph.versions.map(row => canonical([row.content_id, row.version]));
  if (new Set(resolved).size !== resolved.length || resolved.length !== required.size || resolved.some(key => !required.has(key))) return false;
  const origin = graph.occurrences.find(row => row.id === graph.origin.origin_occurrence_id);
  if (graph.origin.origin_status === "recorded" && !origin) return false;
  if (graph.origin.origin_status === "draft" && (graph.origin.origin_occurrence_id !== null || graph.origin.role_proof !== null)
    || graph.origin.origin_status === "recorded" && (graph.origin.role_proof === null || typeof graph.origin.role_proof !== "object")) return false;
  if (new Set(graph.occurrences.map(row => row.id)).size !== graph.occurrences.length) return false;
  return !origin || origin.lifecycle === "ended" || choices[0]?.occurrence_id === origin.id;
}
function functionBody(sql: string, name: string): string {
  const start = sql.indexOf(`CREATE FUNCTION ${name}(`);
  if (start < 0) throw Error(`Missing staged function ${name}`);
  const end = sql.indexOf("END $$;", start);
  if (end < 0) throw Error(`Missing staged function body ${name}`);
  return sql.slice(start, end + 7);
}
export function createClassOriginStageModel(sqlSource: string) {
  const entry = functionBody(sqlSource, "private.begin_class_origin_acceptance_v1");
  const auth = functionBody(sqlSource, "private.require_class_origin_auth_v1");
  const dispatch = functionBody(sqlSource, "private.class_origin_finalize_acceptance_v1");
  if (!entry.includes("PERFORM private.require_class_origin_auth_v1(p_context)") || !auth.includes("RAISE EXCEPTION 'auth_unavailable'")
    || entry.indexOf("require_class_origin_auth_v1") > entry.indexOf("lock_character_writer_guard_v1")
    || !dispatch.includes("IF j.acceptance_kind='class_transition'") || !dispatch.includes("ELSIF j.acceptance_kind IN ('bootstrap_new','bootstrap_copy')")) {
    throw Error("Staged entry/finalizer contract changed; source review required");
  }
  for (const name of new Set(Object.values(CLASS_ORIGIN_FINALIZERS))) functionBody(sqlSource, name);
  for (const name of ["private.class_origin_assert_common_v1", "private.class_origin_read_final_graph_v1",
    "private.class_origin_protected_row_guard_v1", "private.class_origin_acceptance_guard_v1", "private.class_origin_deferred_finalizer_v1"]) functionBody(sqlSource, name);
  if (!sqlSource.includes("CREATE CONSTRAINT TRIGGER class_origin_acceptance_closure") || !sqlSource.includes("DEFERRABLE INITIALLY DEFERRED")) {
    throw Error("Actual staged deferred closure missing");
  }
  const requiredChecks: Record<string, string[]> = {
    "private.class_origin_finalize_transition_v1": ["before_shared+1", "before_class+1", "NOT j.revision_transition_consumed", "Actual metadata confirmation delta missing"],
    "private.class_origin_finalize_bootstrap_v1": ["j.before_parent IS NOT NULL", "j.preinsert_proof->>'transaction_id'", "IS DISTINCT FROM '0'", "Target copy must preserve root identity and immediate lifecycle"],
    "private.class_origin_assert_common_v1": ["graph IS DISTINCT FROM j.expected_graph", "Exact planned proof set mismatch", "Reverse class graph mismatch"],
    "private.class_origin_protected_row_guard_v1": ["match_count<>1", "transition.before_row IS NOT DISTINCT FROM old_row", "transition.after_row IS NOT DISTINCT FROM new_row"],
    "private.class_origin_read_final_graph_v1": ["private.class_origin_ids_match_v1", "required_count<>resolved_count", "WITH ORDINALITY"],
  };
  for (const [name, checks] of Object.entries(requiredChecks)) {
    const body = functionBody(sqlSource, name);
    if (checks.some(check => !body.includes(check))) throw Error(`Staged checks changed in ${name}; model cannot substitute for source`);
  }
  return {
    sourcePath: CLASS_ORIGIN_STAGE_PATH,
    traceEntryForTest(_context: unknown, _intent: unknown) {
      void _context; void _intent;
      return { status: "unready" as const, reason: "auth_unavailable" as const,
        trace: ["private.begin_class_origin_acceptance_v1", "private.require_class_origin_auth_v1"] };
    },
    consumeRowForTest(acceptance: ClassOriginAcceptance, transactionId: string, relation: string, key: string[], before: unknown, after: unknown) {
      if (acceptance.finalized || acceptance.transaction_id !== transactionId) return null;
      const candidate = { relation_key: relation, row_key: key, before_row: before, after_row: after };
      if (!acceptance.planned_transitions.some(row => same(row, candidate))) return null;
      const matches = acceptance.transitions.filter(row => !row.consumed && rowKey(row) === rowKey(candidate) && same(row.before_row, before) && same(row.after_row, after));
      if (matches.length !== 1) return null;
      const copy = structuredClone(acceptance); copy.transitions.find(row => rowKey(row) === rowKey(candidate))!.consumed = true;
      return copy; // injected reference only; no write or permission receipt
    },
    finalizeForTest(input: unknown, observedGraph: unknown, storedReceipt: unknown, transactionId: string, phase: "immediate" | "deferred") {
      const trace = ["private.class_origin_finalize_acceptance_v1"];
      const reject = (reason: string) => ({ status: "model_rejected" as const, reason, phase, trace });
      if (!boundedClassRoleJson(input) || !boundedClassRoleJson(observedGraph) || !boundedClassRoleJson(storedReceipt)) return reject("bounded_json_required");
      const parsed = classOriginAcceptanceSchema.safeParse(input), graphParsed = classOriginGraphSchema.safeParse(observedGraph), receiptParsed = classOriginReceiptSchema.safeParse(storedReceipt);
      if (!parsed.success || !graphParsed.success || !receiptParsed.success) return reject("invalid_shape");
      const acceptance = parsed.data, graph = graphParsed.data, receipt = receiptParsed.data;
      trace.push(CLASS_ORIGIN_FINALIZERS[acceptance.acceptance_kind], "private.class_origin_assert_common_v1", "private.class_origin_read_final_graph_v1");
      if (!acceptance.finalized || acceptance.transaction_id !== transactionId) return reject("current_finalized_transaction_required");
      if (acceptance.transitions.some(row => !row.consumed) || acceptance.transitions.length !== acceptance.planned_transitions.length
        || new Set(acceptance.transitions.map(rowKey)).size !== acceptance.transitions.length
        || new Set(acceptance.planned_transitions.map(rowKey)).size !== acceptance.planned_transitions.length
        || acceptance.transitions.some(row => !acceptance.planned_transitions.some(plan => same(plan, {
          relation_key: row.relation_key, row_key: row.row_key, before_row: row.before_row, after_row: row.after_row,
        })))) return reject("exact_consumed_plan_required");
      if (!same(graph, acceptance.expected_graph) || !same(receipt, acceptance.receipt) || receipt.receipt_kind !== acceptance.acceptance_kind
        || graph.parent.id !== acceptance.target_character_id || graph.parent.user_id !== acceptance.verified_actor_id
        || receipt.target_character_id !== acceptance.target_character_id || receipt.verified_actor_id !== acceptance.verified_actor_id
        || !graphClosure(graph)) return reject("final_graph_receipt_mismatch");
      if (acceptance.acceptance_kind === "class_transition") {
        if (receipt.receipt_kind !== "class_transition" || !acceptance.revision_transition_consumed
          || receipt.before_action_revision !== acceptance.before_parent.action_revision
          || receipt.before_class_revision !== acceptance.before_origin.command_revision
          || receipt.after_action_revision !== graph.parent.action_revision || receipt.after_class_revision !== graph.origin.command_revision) return reject("transition_counter_mismatch");
        if (receipt.canonical_intent.command === "confirm_origin") {
          if (acceptance.before_origin.origin_status !== "draft" || graph.origin.origin_status !== "recorded"
            || graph.origin.origin_occurrence_id !== receipt.canonical_intent.fields.selected_occurrence_id
            || !same(graph.origin.role_proof, { kind: "confirmation", receipt: receipt.confirmation })) return reject("metadata_delta_missing");
        } else {
          const before = { ...acceptance.before_origin }, after = { ...graph.origin };
          delete before.command_revision; delete after.command_revision;
          if (!same(before, after)) return reject("unexpected_origin_change");
        }
      } else {
        const proof = acceptance.preinsert_proof;
        if (proof.acceptance_id !== acceptance.acceptance_id || proof.target_character_id !== acceptance.target_character_id
          || proof.transaction_id !== transactionId || graph.parent.action_revision !== "0" || graph.origin.command_revision !== "0"
          || graph.order.producer_revision !== "0") return reject("bootstrap_initial_proof_mismatch");
        if (acceptance.acceptance_kind === "bootstrap_new" && (graph.origin.origin_status !== "draft" || graph.origin.origin_occurrence_id !== null
          || graph.origin.creation_provenance !== "new_character" || graph.occurrences.length || graph.refs.length)) return reject("fresh_not_empty_draft");
        if (receipt.receipt_kind !== "class_transition") {
          if (graph.parent.name !== receipt.canonical_intent.fields.name || graph.parent.campaign_id !== receipt.canonical_intent.fields.campaign_id) return reject("bootstrap_requested_identity_mismatch");
          if (receipt.canonical_intent.command === "create_character" && graph.parent.system_id !== receipt.canonical_intent.fields.system_id) return reject("bootstrap_requested_identity_mismatch");
          if (graph.origin.origin_status !== "legacy_unavailable" && graph.origin.creation_operation_id !== receipt.operation_id) return reject("bootstrap_creation_operation_mismatch");
        }
        if (receipt.receipt_kind === "bootstrap_copy") {
          const lineage = receipt.copy_lineage;
          if (lineage.copy_kind === "recorded") {
            const origin = graph.occurrences.find(row => row.id === graph.origin.origin_occurrence_id), root = lineage.root_anchor!.root_occurrence_at_confirmation;
            if (!origin || graph.origin.origin_status !== "recorded" || graph.origin.creation_provenance !== "confirmed_copy"
              || !same(graph.origin.role_proof, { kind: "copy_lineage", lineage_version: 1, lineage })
              || !lineage.occurrence_map.some(row => row.source_id === lineage.immediate_source.source_origin_occurrence_id && row.target_id === origin.id)
              || origin.lifecycle !== lineage.immediate_source.lifecycle || origin.ended_at !== lineage.immediate_source.ended_at
              || origin.acquisition_operation_id !== root.acquisition_operation_id || origin.accepted_at !== root.accepted_at) return reject("copy_root_or_current_lifecycle_mismatch");
          } else if (lineage.copy_kind === "draft" && (graph.origin.origin_status !== "draft" || graph.origin.creation_provenance !== "fresh_draft_copy" || graph.origin.origin_occurrence_id !== null)
            || lineage.copy_kind === "legacy" && (graph.origin.origin_status !== "legacy_unavailable" || graph.origin.origin_occurrence_id !== null)) return reject("copy_cannot_mint_origin");
        }
      }
      return { status: "model_checked" as const, phase, trace }; // NEVER committed/authorized/ready
    },
  };
}
