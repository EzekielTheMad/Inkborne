// REVIEW MODEL ONLY. Static source binding is not execution of SQL/locks/RLS/Auth.
// Positive cases simulate the proposed transaction AFTER future gate acceptance;
// current actual native/product gates remain false. This module is not app code.
import { instanceReceiptSchema, instanceRequestSchema, sameInstanceIntent, type InstanceDetail, type InstanceReceipt, type InstanceRequest } from "@/lib/campaigns/monster-instance-schema";
import { MC, monsterDetail, monsterPreview } from "./campaign-monster-instances";
export function campaignMonsterStageModel(source: string) {
  for (const token of ["CREATE FUNCTION public.commit_campaign_monster_instance_v1", "pg_advisory_xact_lock", "RETURN prior.receipt",
    "source := private.campaign_monster_source_v1", "NEW.revision := OLD.revision+1", "INSERT INTO private.campaign_monster_commands_v1", "SELECT false"]) {
    if (!source.includes(token)) throw new Error(`STATIC source binding absent: ${token}`);
  }
  let rows = new Map<string, InstanceDetail>(); let receipts = new Map<string, InstanceReceipt>();
  let serial = 1;
  const current = { ...monsterPreview(), scope: "personal", owner: MC.owner as string | null, active: true, currentVersion: 1 };
  let campaignOwner: string = MC.owner;
  const owned = (actor: string) => { if (actor !== campaignOwner) throw new Error("OWNER_DENIED"); };
  function commit(actor: string, raw: InstanceRequest, fault?: "before-receipt" | "lost-response") {
    owned(actor); const intent = instanceRequestSchema.parse(raw);
    const prior = receipts.get(intent.operation_id);
    if (prior) { if (!sameInstanceIntent(prior.canonical_intent, intent)) throw new Error("INTENT_CONFLICT"); return structuredClone(prior); }
    const nextRows = structuredClone(rows); const nextReceipts = structuredClone(receipts);
    let row: InstanceDetail; let outcome: "created" | "updated" | "noop";
    if (intent.command === "create") {
      if (!current.active || !(current.scope === "platform" || current.scope === "personal" && current.owner === actor)
        || current.currentVersion !== intent.source_version || current.source_id !== intent.source_id || current.source_digest !== intent.source_digest) throw new Error("SOURCE_DENIED");
      const snapshot = current.snapshot as { content_id?: unknown; version?: unknown; system_id_snapshot?: unknown; content_type_snapshot?: unknown;
        scope_snapshot?: unknown; owner_id_snapshot?: unknown; effects_snapshot?: unknown; data_snapshot?: { schema_version?: unknown; hit_points?: { average?: unknown } } };
      if (!snapshot || snapshot.content_id !== current.source_id || snapshot.version !== current.currentVersion || snapshot.system_id_snapshot !== MC.system
        || snapshot.content_type_snapshot !== "monster" || snapshot.scope_snapshot !== current.scope || snapshot.owner_id_snapshot !== current.owner
        || !Array.isArray(snapshot.effects_snapshot) || snapshot.effects_snapshot.length !== 0 || snapshot.data_snapshot?.schema_version !== 1
        || snapshot.data_snapshot?.hit_points?.average !== current.declared_max_hp || current.scope === "platform" && current.owner !== null) throw new Error("SOURCE_IDENTITY_DENIED");
      row = { ...monsterDetail(), id: `20000000-0000-4000-8000-${String(serial).padStart(12, "0")}`, name: intent.name, current_hp: intent.current_hp,
        notes: intent.notes, source_snapshot: structuredClone(current.snapshot), source_digest: current.source_digest };
      outcome = "created";
    } else {
      const existing = nextRows.get(intent.instance_id); if (!existing) throw new Error("INSTANCE_DENIED");
      if (existing.revision !== intent.expected_revision) throw new Error("REVISION_CONFLICT");
      row = { ...existing, ...intent.patch }; outcome = sameInstanceIntent(existing, row) ? "noop" : "updated";
      if (outcome === "updated") { if (existing.revision === "9223372036854775807") throw new Error("REVISION_EXHAUSTED"); row.revision = (BigInt(existing.revision) + BigInt(1)).toString(); }
    }
    if (row.current_hp < 0 || row.current_hp > row.declared_max_hp) throw new Error("HP_DENIED");
    nextRows.set(row.id, row);
    if (fault === "before-receipt") throw new Error("INJECTED_ROLLBACK");
    const receipt = instanceReceiptSchema.parse({ command_version: 1, campaign_id: MC.campaign, operation_id: intent.operation_id, canonical_intent: intent,
      instance_id: row.id, original_actor_id: actor, accepted_at: "2026-10-13T12:10:00Z", outcome,
      readback: { id: row.id, campaign_id: row.campaign_id, name: row.name, current_hp: row.current_hp, declared_max_hp: row.declared_max_hp,
        notes: row.notes, archived: row.archived, revision: row.revision } });
    nextReceipts.set(intent.operation_id, receipt); rows = nextRows; receipts = nextReceipts; serial++;
    if (fault === "lost-response") throw new Error("INJECTED_RESPONSE_LOSS");
    return structuredClone(receipt);
  }
  return { evidence: "model_checked" as const, currentNativeGate: false as const, current, commit,
    setOwner(owner: string) { campaignOwner = owner; },
    resolve(actor: string, operation: string) { owned(actor); const receipt = receipts.get(operation); return receipt ? { status: "saved" as const, receipt: structuredClone(receipt) } : { status: "absent" as const }; },
    dump: () => ({ rows: structuredClone([...rows.values()]), receipts: structuredClone([...receipts.values()]) }) };
}
