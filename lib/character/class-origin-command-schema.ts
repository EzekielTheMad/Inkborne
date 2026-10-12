import { z } from "zod";
import {
  boundedClassRoleJson,
  classRoleConfirmationReceiptSchema,
  classRoleOccurrenceSchema,
  classRoleRevisionSchema,
} from "./class-role-effects-schema";

/** Internal P1a shape checks only. No shape, context or fixture authenticates a writer. */
const uuid = z.string().uuid();
const version = z.number().int().min(1).max(2147483647);
const baseInstant = z.string().datetime({ offset: true });
/** Native-microsecond correspondence only; no clock or acceptance authority. */
export function classOriginInstantMicros(value: unknown): bigint | null {
  if (!baseInstant.safeParse(value).success || typeof value !== "string") return null;
  const parts = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!parts || Number(value.slice(0, 4)) < 1) return null;
  const fraction = (parts[2] ?? "").padEnd(6, "0"), millis = Date.parse(`${parts[1]}.${fraction.slice(0, 3)}${parts[3]}`);
  if (!Number.isSafeInteger(millis)) return null;
  const micros = BigInt(millis) * BigInt(1000) + BigInt(fraction.slice(3));
  const minimum = BigInt(Date.parse("0001-01-01T00:00:00Z")) * BigInt(1000);
  const maximum = BigInt(Date.parse("9999-12-31T23:59:59Z") + 1000) * BigInt(1000);
  return micros >= minimum && micros < maximum ? micros : null;
}
const instant = baseInstant.refine(value => classOriginInstantMicros(value) !== null, "Finite supported native instant required");
const raw = z.record(z.string(), z.unknown());
const revisionStep = (before: string, after: string) => classRoleRevisionSchema.safeParse(before).success
  && classRoleRevisionSchema.safeParse(after).success && BigInt(after) === BigInt(before) + BigInt(1);
const transactionId = z.string().regex(/^[1-9]\d{0,19}$/).refine(value => /^[1-9]\d{0,19}$/.test(value)
  && BigInt(value) <= BigInt("18446744073709551615"));
const tuple = z.strictObject({ content_id: uuid, content_version: version });
const common = {
  contract_version: z.literal(1), character_id: uuid, operation_id: uuid,
  expected_action_revision: classRoleRevisionSchema,
  expected_class_revision: classRoleRevisionSchema,
};
export const classOriginRequestSchema = z.discriminatedUnion("command", [
  z.strictObject({ ...common, command: z.literal("add_class"), fields: z.strictObject({ ...tuple.shape, subclass: tuple.nullable() }) }),
  z.strictObject({ ...common, command: z.literal("set_level"), fields: z.strictObject({ occurrence_id: uuid, level: z.number().int().min(1).max(20) }) }),
  z.strictObject({ ...common, command: z.literal("set_subclass"), fields: z.strictObject({ occurrence_id: uuid, subclass: tuple.nullable() }) }),
  z.strictObject({ ...common, command: z.literal("remove_class"), fields: z.strictObject({ occurrence_id: uuid }) }),
  z.strictObject({ ...common, command: z.literal("reorder_classes"), fields: z.strictObject({ occurrence_ids: z.array(uuid).max(20).refine(ids => new Set(ids).size === ids.length) }) }),
  z.strictObject({ ...common, command: z.literal("confirm_origin"), fields: z.strictObject({ selected_occurrence_id: uuid }) }),
]);
const creationFields = z.strictObject({ name: z.string().trim().min(1).max(100), system_id: uuid, campaign_id: uuid.nullable() });
export const classOriginBootstrapRequestSchema = z.discriminatedUnion("command", [
  z.strictObject({ contract_version: z.literal(1), operation_id: uuid, command: z.literal("create_character"), fields: creationFields }),
  z.strictObject({ contract_version: z.literal(1), operation_id: uuid, command: z.literal("copy_character"), fields: z.strictObject({
    name: creationFields.shape.name, campaign_id: uuid.nullable(), source_character_id: uuid,
    expected_source_action_revision: classRoleRevisionSchema, expected_source_class_revision: classRoleRevisionSchema.nullable(),
  }) }),
]);
const map = z.array(z.strictObject({ source_id: uuid, target_id: uuid })).max(256)
  .refine(rows => new Set(rows.map(row => row.source_id)).size === rows.length && new Set(rows.map(row => row.target_id)).size === rows.length);
const rootAnchor = z.strictObject({
  root_confirmation: classRoleConfirmationReceiptSchema,
  root_occurrence_at_confirmation: classRoleOccurrenceSchema,
}).superRefine((anchor, context) => {
  const receipt = anchor.root_confirmation, occurrence = anchor.root_occurrence_at_confirmation;
  const selected = classOriginInstantMicros(occurrence.selected_at), accepted = classOriginInstantMicros(occurrence.accepted_at);
  const receiptTime = classOriginInstantMicros(receipt.accepted_at);
  if (receipt.canonical_intent.character_id !== occurrence.character_id
    || receipt.canonical_intent.selected_occurrence_id !== occurrence.id
    || receipt.canonical_intent.operation_id !== occurrence.acquisition_operation_id
    || receipt.accepted_at !== occurrence.accepted_at || occurrence.lifecycle !== "accepted"
    || occurrence.ended_at !== null || occurrence.acquired_character_level !== 1
    || selected === null || accepted === null || receiptTime === null || selected > accepted || accepted !== receiptTime
    || !revisionStep(receipt.canonical_intent.expected_revision, receipt.applied_revision)) {
    context.addIssue({ code: "custom", message: "Original confirmation anchor mismatch" });
  }
});
export const classOriginCopyLineageSchema = z.strictObject({
  lineage_version: z.literal(1), copy_kind: z.enum(["draft", "recorded", "legacy"]),
  root_anchor: rootAnchor.nullable(),
  immediate_source: z.strictObject({
    source_character_id: uuid, source_origin_occurrence_id: uuid.nullable(),
    creation_operation_id: uuid.nullable(), action_revision: classRoleRevisionSchema,
    class_revision: classRoleRevisionSchema.nullable(),
    origin_status: z.enum(["draft", "recorded", "legacy_unavailable"]),
    lifecycle: z.enum(["provisional", "accepted", "ended"]).nullable(), ended_at: instant.nullable(),
    raw_provenance: raw,
  }),
  source_copy_receipt_identity: z.strictObject({ operation_id: uuid, target_character_id: uuid, root_character_id: uuid, root_occurrence_id: uuid }).nullable(),
  occurrence_map: map, ref_map: map,
}).superRefine((lineage, context) => {
  const source = lineage.immediate_source, root = lineage.root_anchor;
  if ((lineage.copy_kind === "recorded") !== (root !== null)
    || lineage.copy_kind !== "recorded" && lineage.source_copy_receipt_identity !== null
    || source.origin_status !== ({ draft: "draft", recorded: "recorded", legacy: "legacy_unavailable" } as const)[lineage.copy_kind]
    || (source.lifecycle === "ended") !== (source.ended_at !== null)) {
    context.addIssue({ code: "custom", message: "Copy lifecycle/anchor mismatch" });
  }
  if (lineage.copy_kind === "recorded" && (!source.source_origin_occurrence_id || !source.creation_operation_id || !source.class_revision
    || !["accepted", "ended"].includes(source.lifecycle ?? "")
    || !lineage.occurrence_map.some(row => row.source_id === source.source_origin_occurrence_id))) {
    context.addIssue({ code: "custom", message: "Recorded immediate source is incomplete" });
  }
  if (root) {
    const accepted = classOriginInstantMicros(root.root_occurrence_at_confirmation.accepted_at), ended = classOriginInstantMicros(source.ended_at);
    if (source.lifecycle === "ended" && (accepted === null || ended === null || ended < accepted)) {
      context.addIssue({ code: "custom", message: "Immediate ended lifecycle precedes original acceptance" });
    }
    const identity = lineage.source_copy_receipt_identity;
    const original = root.root_confirmation.canonical_intent;
    if (source.source_character_id !== original.character_id && !identity
      || identity && (identity.target_character_id !== source.source_character_id
        || identity.operation_id !== source.creation_operation_id
        || identity.root_character_id !== original.character_id || identity.root_occurrence_id !== original.selected_occurrence_id)) {
      context.addIssue({ code: "custom", message: "Immediate copy is not the original confirmation" });
    }
  }
});
const receiptCommon = { receipt_version: z.literal(1), operation_id: uuid, verified_actor_id: uuid, target_character_id: uuid, accepted_at: instant };
const transitionReceipt = z.strictObject({
  ...receiptCommon, receipt_kind: z.literal("class_transition"), canonical_intent: classOriginRequestSchema,
  before_action_revision: classRoleRevisionSchema, after_action_revision: classRoleRevisionSchema,
  before_class_revision: classRoleRevisionSchema, after_class_revision: classRoleRevisionSchema,
  confirmation: classRoleConfirmationReceiptSchema.nullable(),
});
export const classOriginReceiptSchema = z.discriminatedUnion("receipt_kind", [
  transitionReceipt,
  z.strictObject({ ...receiptCommon, receipt_kind: z.literal("bootstrap_new"), canonical_intent: classOriginBootstrapRequestSchema,
    initial_action_revision: z.literal("0"), initial_class_revision: z.literal("0"), initial_producer_revision: z.literal("0"), copy_lineage: z.null() }),
  z.strictObject({ ...receiptCommon, receipt_kind: z.literal("bootstrap_copy"), canonical_intent: classOriginBootstrapRequestSchema,
    initial_action_revision: z.literal("0"), initial_class_revision: z.literal("0"), initial_producer_revision: z.literal("0"), copy_lineage: classOriginCopyLineageSchema }),
]).superRefine((receipt, context) => {
  const intent = receipt.canonical_intent;
  if (receipt.operation_id !== intent.operation_id) context.addIssue({ code: "custom", message: "Receipt operation mismatch" });
  if (receipt.receipt_kind === "class_transition") {
    if (intent.command === "create_character" || intent.command === "copy_character") return;
    if (receipt.target_character_id !== intent.character_id
      || receipt.before_action_revision !== intent.expected_action_revision || receipt.before_class_revision !== intent.expected_class_revision
      || !revisionStep(receipt.before_action_revision, receipt.after_action_revision)
      || !revisionStep(receipt.before_class_revision, receipt.after_class_revision)) {
      context.addIssue({ code: "custom", message: "Changed transition requires actual +1 counters" });
    }
    if (intent.command === "confirm_origin") {
      const confirmation = receipt.confirmation;
      if (!confirmation || confirmation.canonical_intent.character_id !== intent.character_id
        || confirmation.canonical_intent.operation_id !== intent.operation_id
        || confirmation.canonical_intent.selected_occurrence_id !== intent.fields.selected_occurrence_id
        || confirmation.canonical_intent.expected_revision !== receipt.before_class_revision
        || confirmation.applied_revision !== receipt.after_class_revision || confirmation.accepted_at !== receipt.accepted_at) {
        context.addIssue({ code: "custom", message: "Confirmation subreceipt mismatch" });
      }
    } else if (receipt.confirmation !== null) context.addIssue({ code: "custom", message: "Only confirmation has a confirmation subreceipt" });
  } else if (intent.command !== (receipt.receipt_kind === "bootstrap_new" ? "create_character" : "copy_character")) {
    context.addIssue({ code: "custom", message: "Bootstrap command kind mismatch" });
  } else if (receipt.receipt_kind === "bootstrap_copy" && intent.command === "copy_character"
    && (receipt.copy_lineage.immediate_source.source_character_id !== intent.fields.source_character_id
      || receipt.copy_lineage.immediate_source.action_revision !== intent.fields.expected_source_action_revision
      || receipt.copy_lineage.immediate_source.class_revision !== intent.fields.expected_source_class_revision
      || receipt.target_character_id === intent.fields.source_character_id)) {
    context.addIssue({ code: "custom", message: "Copy source freshness/target mismatch" });
  }
});
const domainIds = z.array(uuid).max(4096).refine(ids => new Set(ids).size === ids.length);
export const classOriginOrderSchema = z.strictObject({
  character_id: uuid, producer_version: z.literal(1), producer_revision: classRoleRevisionSchema,
  pins: domainIds, inventory: domainIds, spells: domainIds, feature_grants: domainIds, spell_grants: domainIds,
});
export const CLASS_ORIGIN_GRAPH_DOMAINS = ["refs", "inventory", "spells", "feature_grants", "spell_grants"] as const;
const graphRows = z.array(raw).max(4096);
export const classOriginGraphSchema = z.strictObject({
  parent: raw, origin: raw, occurrences: graphRows, refs: graphRows, inventory: graphRows,
  spells: graphRows, feature_grants: graphRows, spell_grants: graphRows, versions: graphRows, order: classOriginOrderSchema,
});
export const classOriginRowTransitionSchema = z.strictObject({
  relation_key: z.enum(["origin", "occurrence", "class_receipt", "creation_receipt"]),
  row_key: z.array(z.string().min(1).max(200)).min(1).max(2),
  before_row: raw.nullable(), after_row: raw.nullable(), consumed: z.boolean(),
}).refine(row => row.before_row !== null || row.after_row !== null, "Empty row transition");
export const classOriginPlannedTransitionSchema = z.strictObject({
  relation_key: classOriginRowTransitionSchema.shape.relation_key, row_key: classOriginRowTransitionSchema.shape.row_key,
  before_row: raw.nullable(), after_row: raw.nullable(),
}).refine(row => row.before_row !== null || row.after_row !== null, "Empty planned transition");
const acceptanceCommon = {
  acceptance_id: uuid, transaction_id: transactionId, verified_actor_id: uuid,
  target_character_id: uuid, finalized: z.boolean(), transitions: z.array(classOriginRowTransitionSchema).min(1).max(1024),
  planned_transitions: z.array(classOriginPlannedTransitionSchema).min(1).max(1024),
  expected_graph: classOriginGraphSchema, receipt: classOriginReceiptSchema,
};
const preinsertProof = z.strictObject({ acceptance_id: uuid, target_character_id: uuid, transaction_id: transactionId, captured_at: instant });
export const classOriginAcceptanceSchema = z.discriminatedUnion("acceptance_kind", [
  z.strictObject({ ...acceptanceCommon, acceptance_kind: z.literal("class_transition"), before_parent: raw, before_origin: raw,
    revision_transition_consumed: z.boolean() }),
  z.strictObject({ ...acceptanceCommon, acceptance_kind: z.literal("bootstrap_new"), preinsert_proof: preinsertProof }),
  z.strictObject({ ...acceptanceCommon, acceptance_kind: z.literal("bootstrap_copy"), preinsert_proof: preinsertProof }),
]);

/** Bounds before recursive parsing. This is internal evidence, never a readiness input. */
export function parseClassOriginRequest(input: unknown) {
  if (!boundedClassRoleJson(input) || new TextEncoder().encode(JSON.stringify(input)).byteLength > 32768) return null;
  const parsed = classOriginRequestSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}
export type ClassOriginAcceptance = z.infer<typeof classOriginAcceptanceSchema>;
export type ClassOriginGraph = z.infer<typeof classOriginGraphSchema>;
export type ClassOriginReceipt = z.infer<typeof classOriginReceiptSchema>;
