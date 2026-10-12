import { CLASS_ROLE_ABILITIES, boundedClassRoleJson, classRoleEvidenceSchema, classRoleConfirmationIntentSchema,
  classRoleConfirmationReceiptSchema, type ClassRoleEvidence, type ClassRoleAbility, type ClassRoleRawEffect, type ClassRoleConfirmationReceipt } from "./class-role-effects-schema";

/** Pure, advisory classifier. P1 authenticated producer/storage/fences and C2 consumers DO NOT exist here. */
export type ClassRoleReason = "LEGACY_UNAVAILABLE" | "DRAFT_UNCONFIRMED" | "ORIGIN_PROOF_UNAVAILABLE" | "ORIGIN_REMOVED_UNAVAILABLE"
  | "ORIGIN_PIN_UNAVAILABLE" | "SAVE_OCCURRENCE_UNAVAILABLE" | "LEGACY_SAVE_NAMESPACE" | "UNKNOWN_ROLE_GRAPH";
export interface ClassRoleIssue { reason: ClassRoleReason; occurrence_id?: string; source_id?: string; effect_index?: number }
export type ClassRoleCollection = { status: "invalid_evidence"; messages: string[] } | {
  status: "available" | "unavailable"; role_state: "provisional" | "confirmed" | "unavailable";
  originalSources: ClassRoleEvidence["sources"]; originalEffects: ClassRoleRawEffect[]; evaluationEffects: ClassRoleRawEffect[];
  excluded: Array<{ source_id: string; effect_index: number; occurrence_id: string }>;
  saveAvailability: Record<ClassRoleAbility, { status: "available" | "unavailable"; issues: ClassRoleIssue[] }>;
};
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "undefined";
}
const same = (left: unknown, right: unknown) => canonical(left) === canonical(right);
/** Intent correspondence only. This is not receipt authenticity, account ownership or permission verification. */
export function matchClassRoleConfirmationReplay(receipt: unknown, request: unknown): "same_intent" | "changed_intent" | "different_operation" | "invalid_evidence" {
  if (!boundedClassRoleJson(receipt) || !boundedClassRoleJson(request)) return "invalid_evidence";
  const accepted = classRoleConfirmationReceiptSchema.safeParse(receipt), incoming = classRoleConfirmationIntentSchema.safeParse(request);
  if (!accepted.success || !incoming.success || BigInt(accepted.data.applied_revision) !== BigInt(accepted.data.canonical_intent.expected_revision) + BigInt(1)) return "invalid_evidence";
  if (accepted.data.canonical_intent.character_id !== incoming.data.character_id || accepted.data.canonical_intent.operation_id !== incoming.data.operation_id) return "different_operation";
  return same(accepted.data.canonical_intent, incoming.data) ? "same_intent" : "changed_intent";
}
function validReceipt(receipt: ClassRoleConfirmationReceipt) {
  const parsed = classRoleConfirmationReceiptSchema.safeParse(receipt);
  return parsed.success && BigInt(parsed.data.applied_revision) === BigInt(parsed.data.canonical_intent.expected_revision) + BigInt(1);
}
function originReason(evidence: ClassRoleEvidence): ClassRoleReason | null {
  const origin = evidence.origin;
  if (!origin || origin.origin_status === "legacy_unavailable") return "LEGACY_UNAVAILABLE";
  if (origin.character_id !== evidence.character.id || origin.system_id !== evidence.character.system_id || !origin.creation_operation_id) return "ORIGIN_PROOF_UNAVAILABLE";
  if (origin.creation_provenance === "fresh_draft_copy" ? !origin.source_draft_operation_id || origin.source_draft_operation_id === origin.creation_operation_id : origin.source_draft_operation_id !== null) return "ORIGIN_PROOF_UNAVAILABLE";
  if (origin.origin_status === "draft") return origin.origin_occurrence_id === null && origin.role_proof === null
    && ["new_character", "fresh_draft_copy"].includes(origin.creation_provenance ?? "")
    && evidence.occurrences.filter(row => row.lifecycle !== "ended").every(row => row.lifecycle === "provisional") ? "DRAFT_UNCONFIRMED" : "ORIGIN_PROOF_UNAVAILABLE";
  const occurrence = evidence.occurrences.find(row => row.id === origin.origin_occurrence_id);
  if (!occurrence || !origin.role_proof || occurrence.acquired_character_level !== 1 || !occurrence.accepted_at || !occurrence.acquisition_operation_id) return "ORIGIN_PROOF_UNAVAILABLE";
  const proof = origin.role_proof;
  if (proof.kind === "confirmation") {
    if (!["new_character", "fresh_draft_copy"].includes(origin.creation_provenance ?? "") || !validReceipt(proof.receipt)
      || proof.receipt.canonical_intent.character_id !== evidence.character.id || proof.receipt.canonical_intent.selected_occurrence_id !== occurrence.id
      || proof.receipt.canonical_intent.operation_id !== occurrence.acquisition_operation_id || proof.receipt.accepted_at !== occurrence.accepted_at
      || BigInt(proof.receipt.applied_revision) > BigInt(origin.command_revision)) return "ORIGIN_PROOF_UNAVAILABLE";
  } else {
    const source = proof.source_occurrence, receipt = proof.source_confirmation;
    if (origin.creation_provenance !== "confirmed_copy" || origin.creation_operation_id !== proof.copy_operation_id || source.character_id === evidence.character.id
      || !validReceipt(receipt) || receipt.canonical_intent.character_id !== source.character_id || receipt.canonical_intent.selected_occurrence_id !== source.id
      || receipt.canonical_intent.operation_id !== source.acquisition_operation_id || receipt.accepted_at !== source.accepted_at
      || BigInt(receipt.applied_revision) > BigInt(proof.source_command_revision) || source.system_id !== occurrence.system_id
      || source.content_id !== occurrence.content_id || source.content_version !== occurrence.content_version || source.class_slug !== occurrence.class_slug
      || source.acquired_character_level !== 1 || source.acquisition_operation_id !== occurrence.acquisition_operation_id
      || source.accepted_at !== occurrence.accepted_at || source.lifecycle !== occurrence.lifecycle || source.ended_at !== occurrence.ended_at) return "ORIGIN_PROOF_UNAVAILABLE";
  }
  if (occurrence.lifecycle === "ended") return "ORIGIN_REMOVED_UNAVAILABLE";
  if (occurrence.lifecycle !== "accepted" || !evidence.character.classes.some(choice => choice.occurrence_id === occurrence.id)) return "ORIGIN_PIN_UNAVAILABLE";
  return null;
}
const rendererKey = (ability: ClassRoleAbility) => `saving_throw_${ability}`;
function candidateAbility(effect: ClassRoleRawEffect): ClassRoleAbility | null {
  if (effect.type !== "grant" || effect.value !== "proficient") return null;
  return CLASS_ROLE_ABILITIES.find(ability => effect.stat === rendererKey(ability) || effect.stat === `save_${ability}`) ?? null;
}
export function collectClassRoleEffects(input: unknown): ClassRoleCollection {
  if (!boundedClassRoleJson(input)) return { status: "invalid_evidence", messages: ["Bounded finite JSON evidence required"] };
  const parsed = classRoleEvidenceSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid_evidence", messages: parsed.error.issues.slice(0, 20).map(issue => issue.message.slice(0, 200)) };
  const evidence = parsed.data, { character } = evidence;
  const unique = (values: unknown[]) => new Set(values).size === values.length;
  const identityError = evidence.system.id !== character.system_id || !unique(evidence.sources.map(pin => pin.id))
    || !unique(evidence.occurrences.map(row => row.id)) || !unique(character.classes.map(row => row.occurrence_id)) || !unique(character.classes.map(row => row.slug))
    || character.classes.reduce((sum, row) => sum + row.level, 0) > 20
    || evidence.sources.some(pin => pin.character_id !== character.id || pin.content_id !== pin.resolved.id || pin.content_version !== pin.resolved.version || pin.resolved.system_id !== character.system_id)
    || evidence.occurrences.some(row => row.character_id !== character.id || row.system_id !== character.system_id
      || (row.lifecycle === "provisional" && (row.accepted_at !== null || row.acquisition_operation_id !== null || row.acquired_character_level !== null || row.ended_at !== null))
      || (row.lifecycle === "accepted" && (!row.accepted_at || !row.acquisition_operation_id || row.ended_at !== null)) || (row.lifecycle === "ended" && !row.ended_at)
      || (row.accepted_at !== null && Date.parse(row.accepted_at) < Date.parse(row.selected_at))
      || (row.ended_at !== null && Date.parse(row.ended_at) < Date.parse(row.accepted_at ?? row.selected_at))
      || (row.lifecycle === "ended" && ((row.accepted_at === null) !== (row.acquisition_operation_id === null) || row.accepted_at === null && row.acquired_character_level !== null)));
  if (identityError) return { status: "invalid_evidence", messages: ["Class evidence identity, lifecycle or uniqueness mismatch"] };
  const availableSave = (): { status: "available" | "unavailable"; issues: ClassRoleIssue[] } => ({ status: "available", issues: [] });
  const saveAvailability: Record<ClassRoleAbility, ReturnType<typeof availableSave>> = {
    strength: availableSave(), dexterity: availableSave(), constitution: availableSave(),
    intelligence: availableSave(), wisdom: availableSave(), charisma: availableSave(),
  };
  function unavailable(issue: ClassRoleIssue, abilities: Iterable<ClassRoleAbility>) {
    for (const key of abilities) { saveAvailability[key].status = "unavailable"; saveAvailability[key].issues.push(issue); }
  }
  const analyses = evidence.sources.filter(pin => pin.resolved.content_type === "class").map(pin => {
    const manifests = evidence.manifests.filter(value => value.content_id === pin.content_id && value.content_version === pin.content_version);
    const manifest = manifests.length === 1 ? manifests[0] : undefined;
    const candidates = pin.resolved.effects.flatMap((effect, index) => effect.type === "grant" && effect.value === "proficient"
      && typeof effect.stat === "string" && (effect.stat.startsWith("saving_throw_") || effect.stat.startsWith("save_")) ? [index] : []);
    const pairs = manifest?.occurrences ?? [], starting = pairs.filter(pair => pair.kind === "starting_save");
    const valid = Boolean(manifest && manifest.system_id === character.system_id && same(manifest.effects_snapshot, pin.resolved.effects)
      && same(manifest.saving_throws_snapshot, pin.resolved.data.saving_throws) && unique(manifest.saving_throws_snapshot)
      && pairs.every((pair, index) => (index === 0 || pair.effect_index > pairs[index - 1].effect_index) && pair.effect_index < pin.resolved.effects.length
        && same(pair.effect_snapshot, pin.resolved.effects[pair.effect_index]) && pair.stat_slug === rendererKey(pair.ability)
        && pair.effect_snapshot.type === "grant" && pair.effect_snapshot.stat === pair.stat_slug && pair.effect_snapshot.value === "proficient")
      && same(pairs.map(pair => pair.effect_index), candidates) && same(starting.map(pair => pair.ability), manifest.saving_throws_snapshot)
      && (manifest.compiler_id !== "private-basic-class-v1" || pairs.length <= 6 && pairs.every(pair => pair.kind === "starting_save") && manifest.effects_snapshot.length === pairs.length));
    // Only PROVEN independent occurrences leave the role-sensitive set. Unclassified tuples never do.
    const affected = new Set<ClassRoleAbility>(valid ? starting.map(pair => pair.ability) : []);
    const declared = pin.resolved.data.saving_throws as string[];
    let unknown = false;
    if (!valid) {
      for (const value of declared) {
        const ability = CLASS_ROLE_ABILITIES.find(ability => ability === value);
        if (ability) affected.add(ability); else unknown = true;
      }
      for (const index of candidates) { const ability = candidateAbility(pin.resolved.effects[index]); if (ability) affected.add(ability); else unknown = true; }
    }
    return { pin, valid, starting, affected, unknown };
  });
  const allAffected = new Set(analyses.flatMap(analysis => [...analysis.affected]));
  let reason = originReason(evidence);
  // Complete pin pairing first; missing/wrong actual raw graph cannot be made safe by a harmless substitute.
  const extraClassSource = analyses.some(({ pin }) => character.classes.filter(choice => {
    const occurrence = evidence.occurrences.find(row => row.id === choice.occurrence_id);
    return choice.slug === pin.resolved.slug && occurrence && occurrence.lifecycle !== "ended"
      && occurrence.class_slug === choice.slug && occurrence.content_id === pin.content_id
      && occurrence.content_version === pin.content_version && pin.context.source === "class";
  }).length !== 1);
  const missingGraph = extraClassSource || evidence.occurrences.some(row => row.lifecycle !== "ended" && !character.classes.some(choice => choice.occurrence_id === row.id)) || character.classes.some(choice => {
    const occurrence = evidence.occurrences.find(row => row.id === choice.occurrence_id);
    const pins = evidence.sources.filter(pin => pin.resolved.content_type === "class" && pin.resolved.slug === choice.slug);
    return !occurrence || occurrence.lifecycle === "ended" || (reason === null && occurrence.lifecycle !== "accepted")
      || occurrence.class_slug !== choice.slug || pins.length !== 1 || pins[0].content_id !== occurrence.content_id
      || pins[0].content_version !== occurrence.content_version || pins[0].context.source !== "class";
  });
  if (missingGraph && reason === null) reason = "ORIGIN_PIN_UNAVAILABLE";
  if (reason) unavailable({ reason }, allAffected);
  if (missingGraph || analyses.some(analysis => analysis.unknown)) unavailable({ reason: "UNKNOWN_ROLE_GRAPH" }, CLASS_ROLE_ABILITIES);
  const excluded: Array<{ source_id: string; effect_index: number; occurrence_id: string }> = [];
  const excludedIndices = new Map<string, Set<number>>();
  for (const analysis of analyses) {
    const { pin, valid, starting, affected } = analysis;
    const choice = character.classes.find(choice => choice.slug === pin.resolved.slug);
    const occurrence = choice && evidence.occurrences.find(row => row.id === choice.occurrence_id);
    if (!choice || !occurrence || missingGraph) {
      unavailable({ reason: "ORIGIN_PIN_UNAVAILABLE", source_id: pin.id, ...(choice ? { occurrence_id: choice.occurrence_id } : {}) }, affected); continue;
    }
    if (!valid) { unavailable({ reason: "SAVE_OCCURRENCE_UNAVAILABLE", source_id: pin.id }, affected); continue; }
    if (reason === null && occurrence.id !== evidence.origin?.origin_occurrence_id) {
      const indices = new Set(starting.map(pair => pair.effect_index)); excludedIndices.set(pin.id, indices);
      for (const index of indices) excluded.push({ source_id: pin.id, effect_index: index, occurrence_id: occurrence.id });
    }
  }
  for (const pin of evidence.sources) pin.resolved.effects.forEach((effect, index) => { const ability = candidateAbility(effect);
    if (ability && effect.stat === `save_${ability}`) unavailable({ reason: "LEGACY_SAVE_NAMESPACE", source_id: pin.id, effect_index: index }, [ability]); });
  const originalEffects = evidence.sources.flatMap(pin => pin.resolved.effects);
  return { status: CLASS_ROLE_ABILITIES.some(ability => saveAvailability[ability].status === "unavailable") ? "unavailable" : "available",
    role_state: reason === "DRAFT_UNCONFIRMED" ? "provisional" : reason ? "unavailable" : "confirmed", originalSources: evidence.sources, originalEffects,
    evaluationEffects: evidence.sources.flatMap(pin => pin.resolved.effects.filter((_effect, index) => !excludedIndices.get(pin.id)?.has(index))), excluded, saveAvailability };
}
