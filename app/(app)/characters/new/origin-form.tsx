"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { creationUIResultSchema, parseCreationIntent, type CreationIntent, type CreationUIResult } from "@/lib/character/pending-creation-schema";
import { clearConfirmedCreation, creationLeaseIsCurrent, getCreationScope, getServerCreationScope,
  persistPendingCreation, readPendingCreation, subscribeCreationScope, type CreationScope,
  type PendingCreation } from "@/lib/character/pending-creation-storage";

type System = { id: string; name: string; slug: string };
type View = { epoch: number; pending: PendingCreation | null; notice: string; blocked: boolean; confirmedId?: string };
const retained = "Your original request is kept. Check its result or retry the original request.";

type CreationAction = (intent: CreationIntent) => Promise<CreationUIResult>;
export function OriginCreationForm({ accountId, systems, submitAction, checkAction }: {
  accountId: string; systems: System[]; submitAction: CreationAction; checkAction: CreationAction;
}) {
  const router = useRouter();
  const scope = useSyncExternalStore(subscribeCreationScope, getCreationScope, getServerCreationScope);
  const [view, setView] = useState<View>({ epoch: -1, pending: null, notice: "", blocked: false });
  const [busy, startTransition] = useTransition();
  const busyRef = useRef(false);
  const mounted = useRef(false);
  const supportedSystems = systems.filter(system => system.slug === "dnd-5e-2014");
  const ready = scope.accountId === accountId && scope.storageReady && view.epoch === scope.epoch;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active || scope.accountId !== accountId || !scope.storageReady) return;
      try {
        const pending = readPendingCreation(accountId, window.sessionStorage);
        if (creationLeaseIsCurrent(scope, window.sessionStorage)) {
          setView({ epoch: scope.epoch, pending, blocked: false, notice: pending ? retained : "" });
        }
      } catch {
        if (active) setView({ epoch: scope.epoch, pending: null, blocked: true,
          notice: "An unfinished request could not be read. It has been kept. Restore this browser session before trying again." });
      }
    });
    return () => { active = false; };
  }, [accountId, scope]);

  function send(pending: PendingCreation, lease: CreationScope, recovery: boolean) {
    if (busyRef.current) return;
    busyRef.current = true;
    startTransition(async () => {
      try {
        if (!creationLeaseIsCurrent(lease, window.sessionStorage)) return;
        const raw = await (recovery ? checkAction(pending.intent) : submitAction(pending.intent));
        if (!mounted.current || !creationLeaseIsCurrent(lease, window.sessionStorage)) return;
        const parsed = creationUIResultSchema.safeParse(raw);
        if (!parsed.success || parsed.data.status !== "confirmed") {
          const absent = parsed.success && parsed.data.status === "absent";
          setView({ epoch: lease.epoch, pending, blocked: false,
            notice: absent ? "No saved result was found yet. " + retained : "The result is not confirmed yet. " + retained });
          return;
        }
        const result = parsed.data;
        if (result.account_id !== pending.account_id || result.operation_id !== pending.intent.operation_id) {
          setView({ epoch: lease.epoch, pending, blocked: false, notice: "The result did not match your original request. " + retained });
          return;
        }
        setView({ epoch: lease.epoch, pending, blocked: true, confirmedId: result.character_id,
          notice: "Your character is saved. Opening its notebook…" });
        clearConfirmedCreation(pending, lease, window.sessionStorage);
        router.push("/characters/" + result.character_id + "/builder/first-class");
      } catch {
        if (mounted.current && getCreationScope().epoch === lease.epoch) {
          setView(current => ({ ...current, pending, notice: current.confirmedId
            ? "Your character is saved. Open its notebook below; the local request record could not be cleared."
            : "The result could not be confirmed here. " + retained }));
        }
      } finally { busyRef.current = false; }
    });
  }

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || view.pending || view.blocked || view.confirmedId || busyRef.current) return;
    try {
      const fields = new FormData(event.currentTarget);
      const name = String(fields.get("name") ?? "").trim();
      const systemId = String(fields.get("system_id") ?? "");
      if (!name || name.length > 100 || !supportedSystems.some(system => system.id === systemId)) return;
      const intent = parseCreationIntent({ contract_version: 1, operation_id: crypto.randomUUID(), command: "create_character",
        fields: { name, system_id: systemId, campaign_id: null } });
      if (!intent) return;
      // Durable write and readback must finish BEFORE the first server action.
      const pending = persistPendingCreation(intent, scope, window.sessionStorage);
      setView({ epoch: scope.epoch, pending, blocked: false, notice: retained });
      send(pending, scope, false);
    } catch {
      setView(current => ({ ...current, blocked: true,
        notice: "Your request could not be kept safely in this browser. No new request was sent. Restore this browser session before trying again." }));
    }
  }

  if (!ready) return <p role="status">Checking your signed-in browser session… If it changed, reload after signing in.</p>;
  return (
    <div className="space-y-4">
      {view.notice && <p role="status" className="text-sm text-muted-foreground">{view.notice}</p>}
      {view.confirmedId ? <Link href={"/characters/" + view.confirmedId + "/builder/first-class"}>Open your saved character</Link> : view.pending ? (
        <div className="space-y-3">
          <p className="text-sm">Waiting for confirmation: <strong>{view.pending.intent.fields.name}</strong></p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy || view.blocked} onClick={() => send(view.pending!, scope, true)}>Check result</Button>
            <Button type="button" variant="outline" disabled={busy || view.blocked} onClick={() => send(view.pending!, scope, false)}>Retry original request</Button>
          </div>
        </div>
      ) : !view.blocked && (
        <form onSubmit={create} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="origin-name" className="block text-sm">What will they be called?</label>
            <Input id="origin-name" name="name" required maxLength={100} autoFocus disabled={busy || !supportedSystems.length} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="origin-system" className="block text-sm">Game system</label>
            <select id="origin-system" name="system_id" required disabled={busy || !supportedSystems.length}
              defaultValue={supportedSystems.length === 1 ? supportedSystems[0].id : ""}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              {supportedSystems.length !== 1 && <option value="">Select a game system</option>}
              {supportedSystems.map(system => <option key={system.id} value={system.id}>{system.name}</option>)}
            </select>
          </div>
          <Button type="submit" disabled={busy || !supportedSystems.length}>Open the notebook</Button>
        </form>
      )}
    </div>
  );
}
