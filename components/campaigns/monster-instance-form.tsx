"use client";
import Link from "next/link";
import { unstable_rethrow, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { commitCampaignMonster, previewCampaignMonster, resolveCampaignMonster } from "@/app/(app)/campaigns/[id]/monsters/actions";
import { MonsterStatBlock } from "@/components/compendium/monster-stat-block";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { instanceIntentForm } from "@/lib/campaigns/monster-instance-form";
import { admittedMonsterSnapshot, instanceRequestSchema, parseInstanceActionResponse, sourcePreviewSchema,
  type InstanceDetail, type InstanceReceipt, type InstanceRequest, type SourcePreview } from "@/lib/campaigns/monster-instance-schema";

type Source = { id: string; name: string; version: number };
interface Props { campaignId: string; ownerId: string; initial?: InstanceDetail; sources?: Source[] }
const uncertainMessage = "The command could not be confirmed. Your draft is retained. Check campaign monsters; do not submit a new operation.";
export function MonsterInstanceForm({ campaignId, ownerId, initial, sources = [] }: Props) {
  const router = useRouter(); const prefix = useId();
  const storageKey = `inkborne:campaign-monster:v1:${ownerId}:${campaignId}:${initial?.id ?? "create"}`;
  const originalRevision = useRef(initial?.revision);
  const originalContext = useRef(storageKey);
  const intent = useRef<InstanceRequest | null>(null);
  const busy = useRef(false); const hasUncertainty = useRef(false);
  const [ready, setReady] = useState(false); const [pending, setPending] = useState(false);
  const [operation, setOperation] = useState<string | null>(null); const [receipt, setReceipt] = useState<InstanceReceipt | null>(null);
  const [message, setMessage] = useState(""); const [conflict, setConflict] = useState(false);
  const [name, setName] = useState(initial?.name ?? ""); const [hp, setHP] = useState(initial ? String(initial.current_hp) : "");
  const [notes, setNotes] = useState(initial?.notes ?? ""); const [archived, setArchived] = useState(initial?.archived ?? false);
  const [selected, setSelected] = useState(""); const [preview, setPreview] = useState<SourcePreview | null>(null);
  const [previewPending, setPreviewPending] = useState(false); const previewBusy = useRef(false);
  const locked = operation !== null || receipt !== null || conflict || pending;
  const drift = initial?.revision !== originalRevision.current || storageKey !== originalContext.current;
  const previewDrift = preview !== null && sources.find((source) => source.id === preview.source_id)?.version !== preview.source_version;
  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
    if (!mounted || storageKey !== originalContext.current) return;
    try {
      const marker = sessionStorage.getItem(storageKey);
      if (marker) {
        const parsed: unknown = JSON.parse(marker);
        const id = (parsed as { operation_id?: unknown })?.operation_id;
        if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Malformed recovery marker");
        setOperation(id); hasUncertainty.current = true;
        setMessage("A previous operation needs recovery. Its original intent is unavailable after reload; only Check campaign monsters is available.");
      }
      setReady(true);
    } catch { setMessage("Recovery storage is unavailable or malformed. Do not create a new operation in this editor."); }
    });
    return () => { mounted = false; };
  }, [storageKey]);

  async function selectSource(id: string) {
    if (busy.current || locked || previewBusy.current || storageKey !== originalContext.current) return;
    previewBusy.current = true;
    setSelected(id); setPreview(null); setPreviewPending(true); setMessage("");
    const source = sources.find((candidate) => candidate.id === id);
    try {
      if (!source) return;
      const response = await previewCampaignMonster(campaignId, source.id, source.version);
      if (response.status !== "preview") throw new Error("Unavailable preview");
      const next = sourcePreviewSchema.parse(response.preview);
      if (next.source_id !== source.id || next.source_version !== source.version) throw new Error("Preview identity mismatch");
      const parsed = admittedMonsterSnapshot(next.snapshot, next.system_id, source.id, source.version);
      if (parsed.data.hit_points.average !== next.declared_max_hp) throw new Error("Preview HP mismatch");
      setPreview(next); setHP(String(next.declared_max_hp));
      if (!name) setName(source.name);
    } catch (error) { unstable_rethrow(error); setMessage("This source is unavailable or unsupported. Choose its current supported version."); }
    finally { previewBusy.current = false; setPreviewPending(false); }
  }
  function applyReceipt(saved: InstanceReceipt) {
    if ((initial && saved.instance_id !== initial.id) || saved.canonical_intent.command !== (initial ? "update" : "create")) throw new Error("Unexpected editor receipt");
    setReceipt(saved); setMessage("Saved. The original receipt is retained; opening the instance cannot create it again.");
    try { sessionStorage.setItem(storageKey, JSON.stringify({ operation_id: saved.operation_id, saved_id: saved.instance_id })); }
    catch { setMessage("Saved receipt confirmed. Recovery storage could not update; retain the saved instance link."); }
  }
  async function invoke(kind: "submit" | "check" | "replay", native?: FormData) {
    if (busy.current || !ready || previewBusy.current || storageKey !== originalContext.current || (kind === "submit" && (drift || previewDrift))) return;
    busy.current = true; setPending(true); setMessage("");
    try {
      let op = operation;
      if (kind === "submit") {
        if (locked || receipt) return;
        const expectedControls: Record<string, string> = { name, current_hp: hp, notes, ...(!initial ? { source: selected } : {}), ...(initial && archived ? { archived: "true" } : {}) };
        if (!native || [...native.entries()].some(([key, value]) => typeof value !== "string" || expectedControls[key] !== value)
          || Object.keys(expectedControls).some((key) => native.getAll(key).length !== 1 || native.get(key) !== expectedControls[key])) {
          setMessage("The rendered controls changed outside this draft. Review the fields before submitting."); return;
        }
        const face = /^(0|[1-9][0-9]*)$/.test(hp) ? Number(hp) : NaN;
        op = crypto.randomUUID();
        const raw = initial ? { command_version: 1, operation_id: op, command: "update", instance_id: initial.id, expected_revision: originalRevision.current,
          patch: { name, current_hp: face, notes, archived } } : { command_version: 1, operation_id: op, command: "create", source_id: preview?.source_id,
          source_version: preview?.source_version, source_digest: preview?.source_digest, name, current_hp: face, notes };
        const parsed = instanceRequestSchema.safeParse(raw);
        const maximum = initial?.declared_max_hp ?? preview?.declared_max_hp;
        if (!parsed.success || maximum === undefined || !Number.isSafeInteger(face) || face > maximum) {
          setMessage("Check name (100 characters), whole current HP, notes (8000 characters), and source preview.");
          document.getElementById(`${prefix}-name`)?.focus(); return;
        }
        // Persist only the operation marker, never notes/raw source or invented reload intent.
        try { sessionStorage.setItem(storageKey, JSON.stringify({ operation_id: op })); }
        catch { setReady(false); setMessage("Recovery storage is unavailable. This command was not submitted."); return; }
        intent.current = parsed.data;
        setOperation(op);
      }
      if (!op || (kind === "replay" && !intent.current)) { setMessage("Original intent unavailable. Use recovery only."); return; }
      const raw = kind === "check" ? await resolveCampaignMonster(campaignId, op)
        : await commitCampaignMonster(campaignId, instanceIntentForm(intent.current!));
      const response = parseInstanceActionResponse(raw, campaignId, op, intent.current ?? undefined);
      if (response.status === "saved") applyReceipt(response.receipt);
      else if (response.status === "absent") {
        hasUncertainty.current = true;
        setMessage("No receipt was found. The original delayed request can still commit. Keep this same operation and intent; do not start another.");
      } else if ((response.status === "error" || response.status === "conflict") && !hasUncertainty.current && kind === "submit") {
        // Definite initial refusal only; never release an operation after transport uncertainty.
        sessionStorage.removeItem(storageKey); setOperation(null); intent.current = null;
        setConflict(response.status === "conflict"); setMessage(response.message);
      } else { hasUncertainty.current = true; setMessage(uncertainMessage); }
    } catch (error) { unstable_rethrow(error); hasUncertainty.current = true; setMessage(uncertainMessage); }
    finally { busy.current = false; setPending(false); }
  }
  let statBlock = null;
  try {
    const source = initial ? admittedMonsterSnapshot(initial.source_snapshot, initial.system_id, initial.source_content_id, initial.source_version)
      : preview ? admittedMonsterSnapshot(preview.snapshot, preview.system_id, preview.source_id, preview.source_version) : null;
    if (source) statBlock = <section className="min-w-0 space-y-3"><h2 className="j-display text-xl">Declared source: {source.sourceName} · v{source.sourceVersion}</h2><MonsterStatBlock data={source.data} /></section>;
  } catch { statBlock = <p role="alert">The saved source stat block is unsupported and cannot be displayed.</p>; }
  return <div className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
    <form onSubmit={(event) => { event.preventDefault(); void invoke("submit", new FormData(event.currentTarget)); }} onReset={(event) => event.preventDefault()} className="min-w-0 space-y-4">
      <p className="text-sm text-muted-foreground">DM-only instance. Current HP is entered manually; this does not roll dice or change the source stat block.</p>
      {!initial ? <label className="block space-y-1" htmlFor={`${prefix}-source`}>Monster source
        <select id={`${prefix}-source`} name="source" value={selected} disabled={!ready || locked || previewPending} onChange={(event) => void selectSource(event.target.value)}
          className="w-full min-w-0 rounded-lg border bg-background p-2" required>
          <option value="">Choose a platform or your personal monster</option>
          {sources.map((source) => <option key={source.id} value={source.id}>{source.name} · v{source.version}</option>)}
        </select>
      </label> : <p className="text-sm">Source {initial.source_content_id} · immutable version {initial.source_version}</p>}
      <fieldset disabled={!ready || locked || previewPending || drift || previewDrift} className="min-w-0 space-y-4">
        <label className="block space-y-1" htmlFor={`${prefix}-name`}>Instance name
          <Input id={`${prefix}-name`} name="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} />
        </label>
        <label className="block space-y-1" htmlFor={`${prefix}-hp`}>Current HP (manual, 0–{initial?.declared_max_hp ?? preview?.declared_max_hp ?? "source maximum"})
          <Input id={`${prefix}-hp`} name="current_hp" value={hp} onChange={(event) => setHP(event.target.value)} type="number" inputMode="numeric" min={0}
            max={initial?.declared_max_hp ?? preview?.declared_max_hp} step={1} required />
        </label>
        <label className="block space-y-1" htmlFor={`${prefix}-notes`}>DM notes
          <textarea id={`${prefix}-notes`} name="notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={8000} rows={5}
            className="w-full min-w-0 rounded-lg border bg-background p-3" />
        </label>
        {initial ? <label className="flex items-center gap-2"><input name="archived" value="true" type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} />Archived (restore by clearing)</label> : null}
        <Button type="submit" disabled={!initial && !preview}>{initial ? "Save instance" : "Add monster instance"}</Button>
      </fieldset>
      {pending || previewPending ? <p role="status">{previewPending ? "Loading source preview…" : "Checking command…"}</p> : null}
      {message ? <p role="status" className="text-sm">{message}</p> : null}
      {drift || conflict ? <p role="alert">The instance changed. Your draft is retained. <Link href={`/campaigns/${campaignId}/monsters/${initial?.id ?? ""}`}>Reload latest</Link></p> : null}
      {previewDrift ? <p role="alert">The selected source changed or is unavailable. Select a current source again; the original pending operation, if any, remains recoverable.</p> : null}
      {previewDrift && !locked ? <Button type="button" variant="outline" disabled={previewPending} onClick={() => void selectSource(selected)}>Load current source version</Button> : null}
      {operation && !receipt ? <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={pending} onClick={() => void invoke("check")}>Check campaign monsters</Button>
        {intent.current ? <Button type="button" variant="outline" disabled={pending} onClick={() => void invoke("replay")}>Resubmit same operation</Button> : null}
        <p className="text-xs">Operation {operation}. Recovery never changes its intent.</p>
      </div> : null}
      {receipt ? <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => { try { router.push(`/campaigns/${campaignId}/monsters/${receipt.instance_id}`); } catch { setMessage("Saved. Navigation failed; use the saved instance link."); } }}>Open saved instance</Button>
        <Link href={`/campaigns/${campaignId}/monsters/${receipt.instance_id}`}>Saved instance {receipt.instance_id}</Link>
        {!initial ? <Button type="button" variant="outline" onClick={() => {
          try { sessionStorage.removeItem(storageKey); } catch { setMessage("Saved instance retained. Recovery storage could not clear; do not start another instance here."); return; }
          intent.current = null; hasUncertainty.current = false;
          setReceipt(null); setOperation(null); setName(""); setHP(""); setNotes(""); setPreview(null); setSelected(""); setMessage("");
        }}>Add another deliberate instance</Button> : null}
      </div> : null}
    </form>
    {statBlock}
  </div>;
}
