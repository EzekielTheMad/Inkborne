"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { SaveBuilderStep } from "@/lib/builder/builder-step-command";
import { parseSubclassContentUpdateResponse, subclassPreviewMatches,
  type FiendContentUpdateCandidate, type PreviewSubclassContentUpdate,
  type SubclassContentUpdatePreview } from "@/lib/builder/subclass-content-update";
import { creationLeaseIsCurrent, getCreationScope, getServerCreationScope, subscribeCreationScope } from "@/lib/character/pending-creation-storage";

type View = { binding: string; preview: SubclassContentUpdatePreview | null; notice: string };

export function SubclassContentUpdate({ accountId, characterId, candidate, actionRevision, previewAction, saveAction, disabled = false }: {
  accountId: string; characterId: string; candidate: FiendContentUpdateCandidate; actionRevision: string;
  previewAction: PreviewSubclassContentUpdate; saveAction: SaveBuilderStep; disabled?: boolean;
}) {
  const scope = useSyncExternalStore(subscribeCreationScope, getCreationScope, getServerCreationScope);
  const [view, setView] = useState<View>({ binding: "", preview: null, notice: "" });
  const [busy, startTransition] = useTransition();
  const busyRef = useRef(false), mounted = useRef(false);
  const ready = scope.accountId === accountId && scope.storageReady;
  const binding = JSON.stringify([accountId, characterId, scope.epoch, actionRevision, candidate]);
  const currentBinding = useRef(binding);
  useLayoutEffect(() => { currentBinding.current = binding; }, [binding]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const preview = ready && view.binding === binding ? view.preview : null;
  const notice = ready && view.binding === binding ? view.notice : "";
  const expired = ready && view.preview !== null && view.binding !== binding;

  function review() {
    if (!ready || disabled || busyRef.current) return;
    const lease = scope, originalBinding = binding;
    const stillCurrent = () => mounted.current && currentBinding.current === originalBinding
      && creationLeaseIsCurrent(lease, window.sessionStorage);
    busyRef.current = true;
    setView({ binding, preview: null, notice: "Reading the saved content update…" });
    startTransition(async () => {
      try {
        const raw = await previewAction({ subclass_ref_id: candidate.subclass_ref_id, target_content_version: candidate.target_content_version });
        if (!stillCurrent()) return;
        const response = parseSubclassContentUpdateResponse(raw);
        if (!response || response.status !== "available"
          || !subclassPreviewMatches(response.preview, candidate, accountId, characterId, actionRevision)) {
          setView({ binding: originalBinding, preview: null,
            notice: "This content update could not be reviewed. Your saved version is unchanged. Reload before reviewing again." });
          return;
        }
        setView({ binding: originalBinding, preview: response.preview, notice: "" });
      } catch {
        if (mounted.current && currentBinding.current === originalBinding && getCreationScope().epoch === lease.epoch) {
          setView({ binding: originalBinding, preview: null,
            notice: "This content update could not be reviewed. Your saved version is unchanged. Try reviewing again." });
        }
      } finally { busyRef.current = false; }
    });
  }

  function confirm() {
    if (!ready || !preview || disabled || busyRef.current || !subclassPreviewMatches(preview, candidate, accountId, characterId, actionRevision)) return;
    const lease = scope, originalBinding = binding;
    busyRef.current = true;
    startTransition(async () => {
      try {
        if (!creationLeaseIsCurrent(lease, window.sessionStorage) || currentBinding.current !== originalBinding) return;
        await saveAction("update_subclass_version", preview.fields);
        if (mounted.current && currentBinding.current === originalBinding && creationLeaseIsCurrent(lease, window.sessionStorage)) {
          setView({ binding: originalBinding, preview: null, notice: "The content update is confirmed. Reload to view the current saved build." });
        }
      } catch {
        if (mounted.current && currentBinding.current === originalBinding && getCreationScope().epoch === lease.epoch) {
          setView({ binding: originalBinding, preview: null,
            notice: "The update could not be confirmed here. Check the original save before making another change." });
        }
      } finally { busyRef.current = false; }
    });
  }

  return <section aria-label="Fiend content update review" className="space-y-3 rounded-md border border-border p-4">
    <h3 className="text-base font-semibold">Review Fiend content update</h3>
    <p className="text-sm text-muted-foreground">A newer version of your saved Fiend content is available. Review its effect on this character before choosing whether to update.</p>
    {disabled && <p role="status" className="text-sm text-muted-foreground">Finish saving your class and spell choices before reviewing this update.</p>}
    {expired && <p role="status" className="text-sm text-muted-foreground">Your saved build changed. Review the current saved version again before confirming.</p>}
    {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    {!preview ? <Button type="button" variant="outline" disabled={!ready || disabled || busy} onClick={review}>
      {busy ? "Reviewing content update…" : "Review content update"}
    </Button> : <div className="space-y-4">
      <table className="w-full text-left text-sm"><caption className="sr-only">Saved and proposed Fiend content versions</caption>
        <thead><tr><th scope="col" className="py-1 pr-3">Saved version</th><th scope="col" className="py-1">Proposed version</th></tr></thead>
        <tbody><tr><td className="py-1 pr-3">{preview.saved_name} · version {preview.fields.expected_content_version}</td>
          <td className="py-1">{preview.target_name} · version {preview.fields.target_content_version}</td></tr></tbody>
      </table>
      <p className="text-sm">This update learns no spells automatically. Expanded spells use your ordinary spells-known allowance.</p>
      {(["retained", "removed", "added"] as const).map(group => <section key={group} aria-label={group[0].toUpperCase() + group.slice(1)} className="space-y-1">
        <h4 className="text-sm font-semibold">{group[0].toUpperCase() + group.slice(1)}</h4>
        {preview[group].length ? <ul className="list-disc space-y-1 pl-5 text-sm">{preview[group].map((item, index) => <li key={`${item.kind}:${index}`}>{item.label}</li>)}</ul>
          : <p className="text-sm text-muted-foreground">None.</p>}
      </section>)}
      <p className="text-sm text-muted-foreground">This updates only this character. The older content version remains in the library history.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => setView({ binding, preview: null, notice: "Your saved version is unchanged." })}>Keep saved version</Button>
        <Button type="button" disabled={!ready || disabled || busy} onClick={confirm}>{busy ? "Saving content update…" : "Confirm update for this character"}</Button>
      </div>
    </div>}
  </section>;
}
