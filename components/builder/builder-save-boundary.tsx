"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState,
  useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { builderStepResponseSchema, parseBuilderStepIntent, sameBuilderStepIntent,
  type BuilderStepIntent, type BuilderStepSaved, type SaveBuilderStep } from "@/lib/builder/builder-step-command";
import { equalEquipmentIntent } from "@/lib/builder/starting-equipment-contract";
import { clearConfirmedBuilderStep, persistPendingBuilderStep, readPendingBuilderStep,
  type PendingBuilderStep } from "@/lib/builder/pending-builder-step-storage";
import { creationLeaseIsCurrent, getCreationScope, getServerCreationScope, subscribeCreationScope,
  type CreationScope } from "@/lib/character/pending-creation-storage";
import { useSaveNavigationGuard } from "@/lib/builder/use-save-navigation-guard";
import { reloadBuilderSnapshot } from "@/lib/builder/reload-builder-snapshot";

type Action = (intent: BuilderStepIntent) => Promise<unknown>;
type View = { epoch: number; accountId: string; characterId: string; pending: PendingBuilderStep | null;
  blocked: boolean; notice: string };
const SaveContext = createContext<SaveBuilderStep | null>(null);
const retained = "Your original save is kept. Check its result or retry the original save.";

/** Preserve fixture/disabled callers while routing enabled builder saves through recovery. */
export function useBuilderStepSave(saveAction?: SaveBuilderStep): SaveBuilderStep | undefined {
  const save = useContext(SaveContext);
  return saveAction ? save ?? saveAction : undefined;
}

export function BuilderSaveBoundary({ accountId, characterId, submitAction, checkAction, children }: {
  accountId: string; characterId: string; submitAction: Action; checkAction: Action; children: ReactNode;
}) {
  const scope = useSyncExternalStore(subscribeCreationScope, getCreationScope, getServerCreationScope);
  const [view, setView] = useState<View>({ epoch: -1, accountId, characterId, pending: null, blocked: false, notice: "" });
  const [busy, setBusy] = useState(false);
  const [reloadRequest, setReloadRequest] = useState<{ lease: CreationScope; accountId: string; characterId: string } | null>(null);
  const reloadRequested = useRef(false);
  const busyRef = useRef(false), mounted = useRef(false);
  const currentTarget = useRef({ accountId, characterId });
  const { notice: navigationNotice, setBlocked } = useSaveNavigationGuard("builder choices");
  useLayoutEffect(() => { currentTarget.current = { accountId, characterId }; }, [accountId, characterId]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const ready = scope.accountId === accountId && scope.storageReady && view.epoch === scope.epoch
    && view.accountId === accountId && view.characterId === characterId;
  const blocked = !ready || view.blocked || view.pending !== null || busy;
  useEffect(() => { setBlocked(ready && (view.pending !== null || view.blocked || busy)); },
    [ready, view.pending, view.blocked, busy, setBlocked]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active || scope.accountId !== accountId || !scope.storageReady) return;
      try {
        const pending = readPendingBuilderStep(accountId, characterId, window.sessionStorage);
        if (creationLeaseIsCurrent(scope, window.sessionStorage)) {
          setView({ epoch: scope.epoch, accountId, characterId, pending, blocked: false, notice: pending ? retained : "" });
        }
      } catch {
        if (active) setView({ epoch: scope.epoch, accountId, characterId, pending: null, blocked: true,
          notice: "An unfinished builder save could not be read. It has been kept. Restore this browser session before trying again." });
      }
    });
    return () => { active = false; };
  }, [accountId, characterId, scope]);

  useEffect(() => {
    // Wait for the editor subtree (and its own unload guards/portals) to
    // unmount before reloading a confirmed historical operation.
    if (!reloadRequest || busy || reloadRequested.current || !ready
      || reloadRequest.accountId !== accountId || reloadRequest.characterId !== characterId) return;
    try {
      if (!creationLeaseIsCurrent(reloadRequest.lease, window.sessionStorage)) return;
      reloadRequested.current = true;
      setBlocked(false);
      reloadBuilderSnapshot(accountId, characterId);
    } catch {
      queueMicrotask(() => {
        if (mounted.current && currentTarget.current.accountId === accountId
          && currentTarget.current.characterId === characterId && getCreationScope().epoch === reloadRequest.lease.epoch) {
          setView(current => ({ ...current, blocked: true,
            notice: "Your original save is confirmed. Reload this page to read its current saved values." }));
        }
      });
    }
  }, [reloadRequest, busy, ready, accountId, characterId, setBlocked]);

  const send = useCallback(async (pending: PendingBuilderStep, lease: CreationScope, recovery: boolean,
    check: boolean): Promise<BuilderStepSaved | null> => {
    if (busyRef.current) throw new Error("The original builder save is still pending");
    const stillHere = () => mounted.current && currentTarget.current.accountId === pending.account_id
      && currentTarget.current.characterId === pending.intent.character_id
      && creationLeaseIsCurrent(lease, window.sessionStorage);
    if (!stillHere()) throw new Error("Sign-in or character changed");
    busyRef.current = true; setBusy(true);
    try {
      const raw = await (check ? checkAction(pending.intent) : submitAction(pending.intent));
      if (!stillHere()) throw new Error("Sign-in or character changed");
      const parsed = builderStepResponseSchema.safeParse(raw);
      if (!parsed.success || parsed.data.status === "absent") {
        setView({ epoch: lease.epoch, accountId, characterId, pending, blocked: false,
          notice: (parsed.success ? "No saved result was found yet. " : "The save is not confirmed yet. ") + retained });
        throw new Error("The original builder save is not confirmed");
      }
      const rejected = parsed.data.status === "rejected";
      const receipt = parsed.data.status === "rejected" ? parsed.data.rejection : parsed.data.receipt;
      const receivedIntent = parseBuilderStepIntent({ contract_version: 1, operation_id: receipt.operation_id,
        character_id: receipt.character_id, command: receipt.command, fields: receipt.fields });
      if (receipt.actor_id !== pending.account_id || !receivedIntent || !sameBuilderStepIntent(receivedIntent, pending.intent)
        || !equalEquipmentIntent(receipt.fields, pending.intent.fields)) {
        setView({ epoch: lease.epoch, accountId, characterId, pending, blocked: false,
          notice: "The result did not match your original save. " + retained });
        throw new Error("The original builder save did not match");
      }
      try {
        clearConfirmedBuilderStep(pending, lease, window.sessionStorage);
      } catch (error) {
        setView({ epoch: lease.epoch, accountId, characterId, pending, blocked: true,
          notice: "Your original save is confirmed. Its local record could not be cleared. Restore this browser session before editing again." });
        throw error;
      }
      if (recovery || parsed.data.status !== "applied" || pending.intent.command === "update_subclass_version") {
        // A fresh document reads the current server snapshot and drops all
        // in-memory editor drafts/queues, including module-scoped ability data.
        setView({ epoch: lease.epoch, accountId, characterId, pending: null, blocked: true,
          notice: rejected ? "This review is out of date. Loading the current saved build so you can review again."
            : "Your original save is confirmed. Loading the current saved choices…" });
        setReloadRequest({ lease, accountId: pending.account_id, characterId: pending.intent.character_id });
        return null;
      }
      setView({ epoch: lease.epoch, accountId, characterId, pending: null, blocked: false, notice: "" });
      return { choices: parsed.data.receipt.saved_choices, scores: parsed.data.receipt.saved_scores,
        action_revision: parsed.data.receipt.action_revision };
    } catch (error) {
      if (mounted.current && currentTarget.current.accountId === pending.account_id
        && currentTarget.current.characterId === pending.intent.character_id && getCreationScope().epoch === lease.epoch) {
        setView(current => ({ ...current, notice: current.notice || "The save could not be confirmed here. " + retained }));
      }
      throw error;
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [accountId, characterId, submitAction, checkAction]);

  const save = useCallback<SaveBuilderStep>(async (command, fields) => {
    if (!mounted.current || !ready || view.pending || view.blocked || busyRef.current) {
      throw new Error("Check the original builder save before making another change");
    }
    let pending: PendingBuilderStep;
    try {
      const intent = parseBuilderStepIntent({ contract_version: 1, operation_id: crypto.randomUUID(),
        character_id: characterId, command, fields });
      if (!intent) throw new Error("Invalid builder save");
      pending = persistPendingBuilderStep(intent, scope, window.sessionStorage);
    } catch (error) {
      setView(current => ({ ...current, blocked: true,
        notice: "Your change could not be kept safely in this browser. No new save was sent. Restore this browser session before trying again." }));
      throw error;
    }
    setView({ epoch: scope.epoch, accountId, characterId, pending, blocked: false, notice: "" });
    const saved = await send(pending, scope, false, false);
    if (!saved) throw new Error("Your original save was recovered. Current saved choices are loading.");
    return saved;
  }, [ready, view.pending, view.blocked, characterId, scope, accountId, send]);

  // Ability queues retain their first persistence callback. Give every editor
  // one stable delegate which consults the latest committed boundary state.
  const saveHandler = useRef<SaveBuilderStep | null>(null);
  useLayoutEffect(() => { saveHandler.current = save; }, [save]);
  const stableSave = useCallback<SaveBuilderStep>((command, fields) => {
    if (!mounted.current || !saveHandler.current) return Promise.reject(new Error("This builder is no longer open"));
    return saveHandler.current(command, fields);
  }, []);

  function recover(check: boolean) {
    if (!ready || !view.pending || view.blocked || busyRef.current) return;
    // Uncertainty stays in the recovery area; children have no historical
    // acknowledgement callback to apply after checking/retrying an old save.
    void send(view.pending, scope, true, check).catch(() => {});
  }

  return <SaveContext.Provider value={stableSave}>
    <section aria-label="Builder save recovery" className="space-y-3">
      {!ready ? <p role="status">Checking your signed-in browser session… If it changed, reload after signing in.</p>
        : view.notice ? <p role="status" className="text-sm text-muted-foreground">{view.notice}</p> : null}
      {ready && view.pending && <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy || view.blocked} onClick={() => recover(true)}>Check save</Button>
        <Button type="button" variant="outline" disabled={busy || view.blocked} onClick={() => recover(false)}>Retry original save</Button>
      </div>}
      {navigationNotice && <p role="status" className="text-sm">{navigationNotice}</p>}
    </section>
    {ready && (busy || (!view.pending && !view.blocked)) && <fieldset disabled={blocked} className="min-w-0 border-0 p-0" aria-label="Character builder choices">
      <div inert={blocked}>{children}</div>
    </fieldset>}
  </SaveContext.Provider>;
}
