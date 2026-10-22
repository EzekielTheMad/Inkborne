"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { parseFirstClassIntent, type FirstClassIntent, type FirstClassUIResult } from "@/lib/character/first-class-command-schema";
import { creationUUID } from "@/lib/character/pending-creation-schema";
import { clearConfirmedFirstClass, persistPendingFirstClass, readPendingFirstClass, type PendingFirstClass } from "@/lib/character/pending-first-class-storage";
import { creationLeaseIsCurrent, getCreationScope, getServerCreationScope, subscribeCreationScope,
  type CreationScope } from "@/lib/character/pending-creation-storage";

type ClassOption = { id: string; name: string; version: number };
type Action = (intent: FirstClassIntent) => Promise<FirstClassUIResult>;
type View = { epoch: number; accountId: string; characterId: string; pending: PendingFirstClass | null;
  notice: string; blocked: boolean; confirmed?: boolean };
const confirmedSchema = z.strictObject({ status: z.literal("confirmed"), account_id: creationUUID,
  character_id: creationUUID, operation_id: creationUUID });
const retained = "Your original class choice is kept. Check its result or retry the original save.";

export function FirstClassForm({ accountId, characterId, classes, canStart, submitAction, checkAction }: {
  accountId: string; characterId: string; classes: ClassOption[]; canStart: boolean;
  submitAction: Action; checkAction: Action;
}) {
  const scope = useSyncExternalStore(subscribeCreationScope, getCreationScope, getServerCreationScope);
  const [view, setView] = useState<View>({ epoch: -1, accountId, characterId, pending: null, notice: "", blocked: false });
  const [busy, startTransition] = useTransition();
  const busyRef = useRef(false), mounted = useRef(false);
  const currentTarget = useRef({ accountId, characterId });
  useLayoutEffect(() => { currentTarget.current = { accountId, characterId }; }, [accountId, characterId]);
  const ready = scope.accountId === accountId && scope.storageReady && view.epoch === scope.epoch
    && view.accountId === accountId && view.characterId === characterId;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active || scope.accountId !== accountId || !scope.storageReady) return;
      try {
        const pending = readPendingFirstClass(accountId, characterId, window.sessionStorage);
        if (creationLeaseIsCurrent(scope, window.sessionStorage)) {
          setView({ epoch: scope.epoch, accountId, characterId, pending, blocked: false, notice: pending ? retained : "" });
        }
      } catch {
        if (active) setView({ epoch: scope.epoch, accountId, characterId, pending: null, blocked: true,
          notice: "An unfinished class save could not be read. It has been kept. Restore this browser session before trying again." });
      }
    });
    return () => { active = false; };
  }, [accountId, characterId, scope]);

  function send(pending: PendingFirstClass, lease: CreationScope, recovery: boolean) {
    if (busyRef.current || pending.intent.character_id !== characterId || pending.account_id !== accountId) return;
    busyRef.current = true;
    const stillHere = () => mounted.current && currentTarget.current.accountId === pending.account_id
      && currentTarget.current.characterId === pending.intent.character_id;
    startTransition(async () => {
      try {
        if (!creationLeaseIsCurrent(lease, window.sessionStorage)) return;
        const raw = await (recovery ? checkAction(pending.intent) : submitAction(pending.intent));
        if (!stillHere() || !creationLeaseIsCurrent(lease, window.sessionStorage)) return;
        const result = confirmedSchema.safeParse(raw);
        if (!result.success) {
          const absent = z.strictObject({ status: z.literal("absent") }).safeParse(raw).success;
          setView({ epoch: lease.epoch, accountId, characterId, pending, blocked: false,
            notice: (absent ? "No saved result was found yet. " : "The class save is not confirmed yet. ") + retained });
          return;
        }
        if (result.data.account_id !== pending.account_id || result.data.character_id !== pending.intent.character_id
          || result.data.operation_id !== pending.intent.operation_id) {
          setView({ epoch: lease.epoch, accountId, characterId, pending, blocked: false,
            notice: "The result did not match your original class choice. " + retained });
          return;
        }
        setView({ epoch: lease.epoch, accountId, characterId, pending, blocked: true, confirmed: true,
          notice: "Your first class is saved. You can return to your notebook." });
        clearConfirmedFirstClass(pending, lease, window.sessionStorage);
      } catch {
        if (stillHere() && getCreationScope().epoch === lease.epoch) {
          setView(current => ({ ...current, pending, notice: current.confirmed
            ? "Your class is saved. The local request could not be cleared; keep this browser session for recovery."
            : "The class save could not be confirmed here. " + retained }));
        }
      } finally { busyRef.current = false; }
    });
  }

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || !canStart || view.pending || view.blocked || view.confirmed || busyRef.current) return;
    try {
      const selectedId = String(new FormData(event.currentTarget).get("class_id") ?? "");
      const selected = classes.find(option => option.id === selectedId);
      if (!selected || classes.filter(option => option.id === selectedId).length !== 1) return;
      const intent = parseFirstClassIntent({ contract_version: 1, command: "add_class", character_id: characterId,
        operation_id: crypto.randomUUID(), expected_action_revision: "0", expected_class_revision: "0",
        fields: { content_id: selected.id, content_version: selected.version, subclass: null } });
      if (!intent) return;
      const pending = persistPendingFirstClass(intent, scope, window.sessionStorage);
      setView({ epoch: scope.epoch, accountId, characterId, pending, blocked: false, notice: retained });
      send(pending, scope, false);
    } catch {
      setView(current => ({ ...current, blocked: true,
        notice: "Your class choice could not be kept safely in this browser. No new save was sent. Restore this browser session before trying again." }));
    }
  }

  if (!ready) return <p role="status">Checking your signed-in browser session… If it changed, reload after signing in.</p>;
  return <div className="space-y-4">
    {view.notice && <p role="status" className="text-sm text-muted-foreground">{view.notice}</p>}
    {view.confirmed ? <Link href={"/characters/" + characterId + "/builder"}>Open your notebook</Link> : view.pending ? (
      <div className="space-y-3">
        <p className="text-sm">Waiting for confirmation of your original class choice.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy || view.blocked} onClick={() => send(view.pending!, scope, true)}>Check class save</Button>
          <Button type="button" variant="outline" disabled={busy || view.blocked} onClick={() => send(view.pending!, scope, false)}>Retry original class save</Button>
        </div>
      </div>
    ) : !view.blocked && canStart ? (
      <form onSubmit={create} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="first-class" className="block text-sm">First class</label>
          <select id="first-class" name="class_id" required defaultValue="" disabled={busy || !classes.length}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Choose a class</option>
            {classes.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
        </div>
        <Button type="submit" disabled={busy || !classes.length}>Save first class</Button>
      </form>
    ) : !view.blocked ? <p role="status">This notebook is not ready for a new first-class choice. Open it to review its saved selections.</p> : null}
  </div>;
}
