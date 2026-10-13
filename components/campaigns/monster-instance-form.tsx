"use client";
import Link from "next/link";
import { unstable_rethrow, useRouter } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { commitCampaignMonster, previewCampaignMonster, resolveCampaignMonster } from "@/app/(app)/campaigns/[id]/monsters/actions";
import { MonsterStatBlock } from "@/components/compendium/monster-stat-block";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { instanceIntentForm } from "@/lib/campaigns/monster-instance-form";
import { admittedMonsterSnapshot, instanceRequestSchema, parseInstanceActionResponse, sourcePreviewSchema,
  type InstanceDetail, type InstanceReceipt, type InstanceRequest, type SourcePreview } from "@/lib/campaigns/monster-instance-schema";

type Source = { id: string; name: string; version: number };
interface Props { campaignId: string; ownerId: string; systemId: string; initial?: InstanceDetail; sources?: Source[] }
type Scope = { key: string; ownerId: string; campaignId: string; editorId: string; systemId: string };
const uncertainMessage = "The command could not be confirmed. Your draft is retained. Check campaign monsters; do not submit a new operation.";
export function MonsterInstanceForm({ campaignId, ownerId, systemId, initial, sources = [] }: Props) {
  const router = useRouter(); const prefix = useId();
  const storageKey = `inkborne:campaign-monster:v1:${ownerId}:${campaignId}:${initial?.id ?? "create"}`;
  const [originalRevision] = useState(initial?.revision);
  const [originalContext] = useState(storageKey);
  const [originalSystem] = useState(systemId);
  const intent = useRef<InstanceRequest | null>(null);
  const operationId = useRef<string | null>(null); const acceptedReceipt = useRef<InstanceReceipt | null>(null);
  const busy = useRef(false); const hasUncertainty = useRef(false);
  const sequence = useRef(0); const flight = useRef<{ token: number; key: string; done: boolean; releaseOperation: boolean } | null>(null);
  const [settledToken, setSettledToken] = useState(0); const [canReplay, setCanReplay] = useState(false);
  const navigation = useRef(false); const [openingLatest, setOpeningLatest] = useState(false);
  const [ready, setReady] = useState(false); const [pending, setPending] = useState(false);
  const [operation, setOperation] = useState<string | null>(null); const [receipt, setReceipt] = useState<InstanceReceipt | null>(null);
  const [message, setMessage] = useState(""); const [conflict, setConflict] = useState(false);
  const [name, setName] = useState(initial?.name ?? ""); const [hp, setHP] = useState(initial ? String(initial.current_hp) : "");
  const [notes, setNotes] = useState(initial?.notes ?? ""); const [archived, setArchived] = useState(initial?.archived ?? false);
  const [selected, setSelected] = useState(""); const [preview, setPreview] = useState<SourcePreview | null>(null);
  const [previewPending, setPreviewPending] = useState(false); const previewBusy = useRef(false);
  const previewSequence = useRef(0); const previewRequest = useRef<{ token: number; scope: Scope; sourceId: string; version: number; done: boolean } | null>(null);
  const [settledPreviewToken, setSettledPreviewToken] = useState(0); const selection = useRef("");
  const current = useRef({ mounted: false, key: storageKey, ownerId, campaignId, editorId: initial?.id ?? "create", systemId, sources, preview });
  const locked = operation !== null || receipt !== null || conflict || pending;
  const drift = initial?.revision !== originalRevision || storageKey !== originalContext || systemId !== originalSystem;
  const previewDrift = preview !== null && sources.find((source) => source.id === preview.source_id)?.version !== preview.source_version;
  useLayoutEffect(() => { current.current = { mounted: true, key: storageKey, ownerId, campaignId, editorId: initial?.id ?? "create", systemId, sources, preview }; });
  useLayoutEffect(() => () => { current.current.mounted = false; }, []);
  useLayoutEffect(() => {
    const active = flight.current;
    if (!pending && active?.done && active.token === settledToken) {
      if (active.releaseOperation) {
        try {
          const marker = JSON.parse(sessionStorage.getItem(active.key) ?? "null") as { operation_id?: unknown } | null;
          if (marker?.operation_id !== operationId.current) throw new Error("Recovery marker changed");
          sessionStorage.removeItem(active.key); operationId.current = null; intent.current = null;
        }
        catch {
          hasUncertainty.current = true;
          const retained = operationId.current;
          queueMicrotask(() => { if (current.current.mounted && current.current.key === active.key) {
            setOperation(retained); setCanReplay(intent.current !== null); setMessage("Recovery storage could not clear. Keep the original operation and Check campaign monsters.");
          } });
        }
      }
      flight.current = null; busy.current = false;
    }
  }, [pending, settledToken]);
  useLayoutEffect(() => {
    const active = previewRequest.current;
    if (!previewPending && active?.done && active.token === settledPreviewToken) { previewRequest.current = null; previewBusy.current = false; }
  }, [previewPending, settledPreviewToken]);
  function sameEditor(scope: Scope) {
    const view = current.current;
    return view.mounted && view.key === scope.key && view.ownerId === scope.ownerId && view.campaignId === scope.campaignId
      && view.editorId === scope.editorId && view.systemId === scope.systemId;
  }
  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
    if (!mounted || storageKey !== originalContext) return;
    try {
      const marker = sessionStorage.getItem(storageKey);
      if (marker) {
        const parsed: unknown = JSON.parse(marker);
        const id = (parsed as { operation_id?: unknown })?.operation_id;
        if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Malformed recovery marker");
        operationId.current = id; setOperation(id); hasUncertainty.current = true;
        setMessage("A previous operation needs recovery. Its original intent is unavailable after reload; only Check campaign monsters is available.");
      }
      setReady(true);
    } catch { setMessage("Recovery storage is unavailable or malformed. Do not create a new operation in this editor."); }
    });
    return () => { mounted = false; };
  }, [storageKey, originalContext]);

  async function selectSource(id: string) {
    if (busy.current || operationId.current || intent.current || acceptedReceipt.current || hasUncertainty.current || conflict || previewBusy.current || storageKey !== originalContext || systemId !== originalSystem) return;
    const view = current.current;
    if (!view.mounted || view.key !== storageKey) return;
    const scope: Scope = { key: view.key, ownerId: view.ownerId, campaignId: view.campaignId, editorId: view.editorId, systemId: view.systemId };
    const source = view.sources.find((candidate) => candidate.id === id);
    const token = ++previewSequence.current;
    previewRequest.current = { token, scope, sourceId: id, version: source?.version ?? 0, done: false };
    selection.current = id;
    previewBusy.current = true;
    setSelected(id); setPreview(null); setPreviewPending(true); setMessage("");
    try {
      if (!source) return;
      const response = await previewCampaignMonster(scope.campaignId, source.id, source.version);
      if (!sameEditor(scope) || previewRequest.current?.token !== token || selection.current !== id || current.current.sources.find((entry) => entry.id === id)?.version !== source.version) {
        if (current.current.mounted && current.current.key === scope.key) setMessage("The source preview became stale. Choose its current version explicitly.");
        return;
      }
      if (response.status !== "preview") throw new Error("Unavailable preview");
      const next = sourcePreviewSchema.parse(response.preview);
      if (next.source_id !== source.id || next.source_version !== source.version || next.system_id !== scope.systemId) throw new Error("Preview identity mismatch");
      const parsed = admittedMonsterSnapshot(next.snapshot, next.system_id, source.id, source.version);
      if (parsed.data.hit_points.average !== next.declared_max_hp) throw new Error("Preview HP mismatch");
      setPreview(next); setHP(String(next.declared_max_hp));
      if (!name) setName(source.name);
    } catch (error) { unstable_rethrow(error); if (sameEditor(scope)) setMessage("This source is unavailable or unsupported. Choose its current supported version."); }
    finally {
      if (previewRequest.current?.token === token) {
        previewRequest.current.done = true;
        if (current.current.mounted) { setPreviewPending(false); setSettledPreviewToken(token); }
      }
    }
  }
  function applyReceipt(saved: InstanceReceipt, scope: Scope) {
    if ((scope.editorId !== "create" && saved.instance_id !== scope.editorId) || saved.canonical_intent.command !== (scope.editorId !== "create" ? "update" : "create")) throw new Error("Unexpected editor receipt");
    acceptedReceipt.current = saved; // Lifetime admission blocks native settlement-gap submits.
    let stored = true;
    try {
      const savedMarker = JSON.stringify({ operation_id: saved.operation_id, saved_id: saved.instance_id });
      const marker = JSON.parse(sessionStorage.getItem(scope.key) ?? "null") as { operation_id?: unknown } | null;
      // Retain late accepted evidence without overwriting a newer active operation.
      if (marker?.operation_id === saved.operation_id) sessionStorage.setItem(scope.key, savedMarker);
      else sessionStorage.setItem(`${scope.key}:accepted:${saved.operation_id}`, savedMarker);
    }
    catch { stored = false; }
    // Even an unmounted/changed editor keeps accepted evidence under its ORIGINAL scope.
    if (sameEditor(scope)) {
      setReceipt(saved); setMessage(stored ? "Saved. The original receipt is retained; opening the instance cannot create it again."
        : "Saved receipt confirmed. Recovery storage could not update; retain the saved instance link.");
    }
  }
  async function invoke(kind: "submit" | "check" | "replay", native?: FormData) {
    if (busy.current || !ready || previewBusy.current || storageKey !== originalContext || systemId !== originalSystem || (kind === "submit" && (drift || previewDrift))) return;
    if (kind === "submit" && (operationId.current || intent.current || acceptedReceipt.current || hasUncertainty.current || conflict)) return;
    if (kind !== "submit" && acceptedReceipt.current) return;
    const view = current.current;
    if (!view.mounted || view.key !== storageKey) return;
    const scope: Scope = { key: view.key, ownerId: view.ownerId, campaignId: view.campaignId, editorId: view.editorId, systemId: view.systemId };
    if (kind === "submit" && !initial && (!preview || !view.preview || preview.source_id !== view.preview.source_id || preview.source_version !== view.preview.source_version
      || preview.system_id !== scope.systemId || preview.source_digest !== view.preview.source_digest || selection.current !== preview.source_id
      || view.sources.find((source) => source.id === preview.source_id)?.version !== preview.source_version)) return;
    const token = ++sequence.current;
    flight.current = { token, key: scope.key, done: false, releaseOperation: false };
    busy.current = true; setPending(true); setMessage("");
    try {
      let op = operationId.current;
      if (kind === "submit") {
        if (locked || receipt) return;
        const expectedControls: Record<string, string> = { name, current_hp: hp, notes, ...(!initial ? { source: selected } : {}), ...(initial && archived ? { archived: "true" } : {}) };
        if (!native || [...native.entries()].some(([key, value]) => typeof value !== "string" || expectedControls[key] !== value)
          || Object.keys(expectedControls).some((key) => native.getAll(key).length !== 1 || native.get(key) !== expectedControls[key])) {
          setMessage("The rendered controls changed outside this draft. Review the fields before submitting."); return;
        }
        const face = /^(0|[1-9][0-9]*)$/.test(hp) ? Number(hp) : NaN;
        op = crypto.randomUUID();
        const raw = initial ? { command_version: 1, operation_id: op, command: "update", instance_id: initial.id, expected_revision: originalRevision,
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
        operationId.current = op; setCanReplay(true);
        setOperation(op);
      }
      if (!op || (kind === "replay" && !intent.current)) { setMessage("Original intent unavailable. Use recovery only."); return; }
      const submittedIntent = intent.current;
      const raw = kind === "check" ? await resolveCampaignMonster(scope.campaignId, op)
        : await commitCampaignMonster(scope.campaignId, instanceIntentForm(submittedIntent!));
      const response = parseInstanceActionResponse(raw, scope.campaignId, op, submittedIntent ?? undefined);
      if (flight.current?.token !== token || operationId.current !== op) throw new Error("Command token mismatch; recover original operation");
      if (response.status === "saved") applyReceipt(response.receipt, scope);
      else if (!sameEditor(scope)) { hasUncertainty.current = true; }
      else if (response.status === "absent") {
        hasUncertainty.current = true;
        setMessage("No receipt was found. The original delayed request can still commit. Keep this same operation and intent; do not start another.");
      } else if ((response.status === "error" || response.status === "conflict") && !hasUncertainty.current && kind === "submit") {
        // Definite initial refusal only; never release an operation after transport uncertainty.
        setOperation(null); setCanReplay(false);
        flight.current.releaseOperation = true; // Cleared ONLY after matching pending=false commit.
        setConflict(response.status === "conflict"); setMessage(response.message);
      } else { hasUncertainty.current = true; setMessage(uncertainMessage); }
    } catch (error) { unstable_rethrow(error); hasUncertainty.current = true; if (sameEditor(scope)) setMessage(uncertainMessage); }
    finally {
      if (flight.current?.token === token) {
        flight.current.done = true;
        if (current.current.mounted) { setPending(false); setSettledToken(token); }
      }
    }
  }
  function editLatest() {
    const saved = acceptedReceipt.current; const view = current.current;
    if (!initial || !receipt || !saved || busy.current || navigation.current || !view.mounted || view.key !== storageKey || view.key !== originalContext
      || view.ownerId !== ownerId || view.campaignId !== campaignId || view.editorId !== initial.id || view.systemId !== systemId || systemId !== originalSystem
      || saved.operation_id !== operationId.current || saved.operation_id !== receipt.operation_id || saved.instance_id !== initial.id
      || saved.instance_id !== receipt.instance_id || saved.campaign_id !== campaignId) return;
    // Revalidate captured accepted correspondence; uncertainty without accepted proof never reaches here.
    const checked = parseInstanceActionResponse({ status: "saved", receipt: saved }, campaignId, saved.operation_id, intent.current ?? undefined);
    if (checked.status !== "saved") return;
    navigation.current = true; setOpeningLatest(true);
    const markerValue = JSON.stringify({ operation_id: saved.operation_id, saved_id: saved.instance_id });
    let removed = false;
    try {
      sessionStorage.setItem(`${storageKey}:accepted:${saved.operation_id}`, markerValue);
      const raw = sessionStorage.getItem(storageKey);
      const marker = raw === null ? null : JSON.parse(raw) as { operation_id?: unknown; saved_id?: unknown } | null;
      if (raw !== null && (!marker || Array.isArray(marker) || marker.operation_id !== saved.operation_id || (marker.saved_id !== undefined && marker.saved_id !== saved.instance_id))) throw new Error("Active recovery marker does not match accepted operation");
      if (raw !== null) { sessionStorage.removeItem(storageKey); removed = true; }
      const target = `/campaigns/${campaignId}/monsters/${saved.instance_id}?${new URLSearchParams({ editAfter: saved.operation_id })}`;
      setMessage("Saved receipt retained. Opening a fresh latest instance editor…");
      globalThis.location.assign(target); // Hard navigation, new owner-checked server read and mount.
      // Return/hang is not evidence of a new editor; old lifetime stays locked.
    } catch {
      if (removed) { try { if (sessionStorage.getItem(storageKey) === null) sessionStorage.setItem(storageKey, markerValue); } catch { /* Accepted ID metadata/lifetime still retained. */ } }
      navigation.current = false; setOpeningLatest(false);
      setMessage("Saved instance retained. The latest editor could not open or its recovery marker changed. Use the saved link or explicitly retry; no save was resubmitted.");
    }
  }
  if (storageKey !== originalContext || systemId !== originalSystem) return <p role="alert">Editor identity changed. Earlier operations remain recoverable in their original editor; no draft or receipt is applied here.</p>;
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
        {canReplay ? <Button type="button" variant="outline" disabled={pending} onClick={() => void invoke("replay")}>Resubmit same operation</Button> : null}
        <p className="text-xs">Operation {operation}. Recovery never changes its intent.</p>
      </div> : null}
      {receipt ? <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => { try { router.push(`/campaigns/${campaignId}/monsters/${receipt.instance_id}`); } catch { setMessage("Saved. Navigation failed; use the saved instance link."); } }}>Open saved instance</Button>
        <Link href={`/campaigns/${campaignId}/monsters/${receipt.instance_id}`}>Saved instance {receipt.instance_id}</Link>
        {initial ? <Button type="button" variant="outline" disabled={pending || openingLatest} onClick={editLatest}>Edit latest instance</Button> : null}
        {!initial ? <Button type="button" variant="outline" onClick={() => {
          if (busy.current || !acceptedReceipt.current || acceptedReceipt.current.operation_id !== receipt.operation_id) return;
          try { sessionStorage.removeItem(storageKey); } catch { setMessage("Saved instance retained. Recovery storage could not clear; do not start another instance here."); return; }
          intent.current = null; operationId.current = null; acceptedReceipt.current = null; hasUncertainty.current = false; selection.current = ""; setCanReplay(false);
          setReceipt(null); setOperation(null); setName(""); setHP(""); setNotes(""); setPreview(null); setSelected(""); setMessage("");
        }}>Add another deliberate instance</Button> : null}
      </div> : null}
    </form>
    {statBlock}
  </div>;
}
