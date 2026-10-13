import { startTransition, useState } from "react";
import { createRoot } from "react-dom/client";
import { MonsterInstanceForm } from "@/components/campaigns/monster-instance-form";
import { MonsterInstancePanel } from "@/components/campaigns/monster-instance-panel";
import { instanceIntentFromForm } from "@/lib/campaigns/monster-instance-form";
import { admittedMonsterSnapshot, instanceDetailSchema, instanceSummarySchema, sourcePreviewSchema,
  instanceRequestSchema, instanceReceiptSchema, parseInstanceActionResponse, sameInstanceIntent,
  type InstanceDetail, type InstanceReceipt, type InstanceRequest, type SourcePreview } from "@/lib/campaigns/monster-instance-schema";
import { MC, monsterReceipt } from "@/tests/fixtures/campaign-monster-instances";

type Props = { campaignId: string; ownerId: string; systemId: string; initial?: InstanceDetail;
  sources?: { id: string; name: string; version: number }[]; generation: string; role: string; unavailable?: string; rows: unknown[] };
type Held = { response?: unknown; observed?: boolean; resolve: (value: unknown) => void; reject: (error: Error) => void };
type Trace = { kind: string; campaign: string; intent?: unknown; operation?: string; source?: string; version?: number };
declare global { interface Window { campaignMonster: ReturnType<typeof bridge>; __m5Executed?: boolean } }
const input = JSON.parse(document.getElementById("model-props")!.textContent!) as { props: Props; scenario: string };
let renderProps = (_next: Props) => {}; // Filled before actions can be invoked.
function bridge() {
  const calls: Trace[] = [], propsReceived: Props[] = [], gaps: unknown[] = [];
  const immediate: { mode: string; intent: InstanceRequest; responseConsumed: boolean; reply: unknown }[] = [];
  const immediateRequests = new Map<string, InstanceRequest>(), immediateReceipts = new Map<string, InstanceReceipt>();
  let held: Held | null = null, previewHeld: Held | null = null;
  let mode = input.scenario;
  async function api(kind: string, data: unknown) {
    const response = await fetch("/__model/" + kind, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!response.ok) throw Error("Explicit modeled boundary unavailable"); return response.json();
  }
  function transport(kind: string, data: unknown, pause: boolean) {
    return new Promise<unknown>((resolve, reject) => {
      const target: Held = { resolve, reject };
      if (pause) { if (kind === "preview") previewHeld = target; else held = target; }
      void api(kind, data).then(response => {
        if (pause) target.response = response;
        else if (mode === "lost" && kind === "commit") reject(Error("Modeled response lost"));
        else resolve(response);
      }, reject);
    });
  }
  return {
    calls, propsReceived, gaps, immediate,
    startTransition, // The actual React implementation; no scheduler replacement.
    navigationFailure: false,
    mode(value: string) { mode = value; },
    api,
    commit(campaign: string, form: FormData) {
      const intent = instanceIntentFromForm(form);
      calls.push({ kind: "commit", campaign, intent: structuredClone(intent) });
      if (["settlement-saved", "settlement-uncertain", "settlement-refusal", "settlement-replay"].includes(mode)) {
        // Case08 ONLY: explicitly modeled immediate action, no HTTP/held barrier.
        // The real form still awaits and validates this reply with its own parser.
        const request = instanceRequestSchema.parse(intent);
        if (campaign !== MC.campaign || request.command !== "create" || request.source_id !== MC.source || request.source_version !== 1 || request.source_digest !== MC.digest)
          throw Error("Immediate original-fixture correspondence refused");
        const original = immediateRequests.get(request.operation_id);
        if (original && !sameInstanceIntent(original, request)) throw Error("Immediate modeled operation changed intent");
        if (mode === "settlement-replay" && !original) throw Error("Immediate replay lacks original intent");
        immediateRequests.set(request.operation_id, structuredClone(request));
        let reply: unknown;
        if (mode === "settlement-uncertain") reply = { status: "uncertain", message: "Immediate modeled response unavailable." };
        else if (mode === "settlement-refusal") reply = { status: "error", message: "Definite immediate modeled prewrite refusal." };
        else {
          const accepted = immediateReceipts.get(request.operation_id) ?? instanceReceiptSchema.parse(monsterReceipt(request));
          immediateReceipts.set(request.operation_id, accepted); reply = { status: "saved", receipt: accepted };
        }
        const validated = parseInstanceActionResponse(reply, campaign, request.operation_id, request);
        const record = { mode, intent: structuredClone(request), responseConsumed: false, reply: structuredClone(validated) };
        immediate.push(record);
        return Promise.resolve(new Proxy(validated, { get(object, property, receiver) {
          if (property === "status") record.responseConsumed = true;
          return Reflect.get(object, property, receiver);
        } }));
      }
      return transport("commit", { campaign, intent, mode }, ["hold", "late"].includes(mode));
    },
    preview(campaign: string, source: string, version: number) {
      calls.push({ kind: "preview", campaign, source, version });
      return transport("preview", { campaign, source, version }, mode === "hold-preview");
    },
    resolve(campaign: string, operation: string) {
      calls.push({ kind: "resolve", campaign, operation });
      if (mode.startsWith("settlement-")) {
        if (campaign !== MC.campaign || !immediateRequests.has(operation)) throw Error("Immediate resolver correspondence refused");
        const receipt = immediateReceipts.get(operation);
        return Promise.resolve(parseInstanceActionResponse(receipt ? { status: "saved", receipt } : { status: "absent" }, campaign, operation));
      }
      return transport("resolve", { campaign, operation, mode }, false);
    },
    readyHeld() { return held?.response !== undefined; },
    readyPreview() { return previewHeld?.response !== undefined; },
    release(withGap = false) {
      if (!held || held.response === undefined) throw Error("No actual pending modeled response");
      const target = held; held = null;
      // Observe actual response-property consumption by the unchanged parser,
      // never mutate rendered control state to create a settlement condition.
      const response = target.response;
      target.resolve(response && typeof response === "object" ? new Proxy(response, {
        get(object, key, receiver) { if (key === "status") target.observed = true; return Reflect.get(object, key, receiver); },
      }) : response);
      if (withGap) queueMicrotask(() => {
        const form = document.querySelector("form"), pending = document.body.textContent!.includes("Checking command");
        const fieldset = form?.querySelector("fieldset"), button = form?.querySelector('button[type="submit"]') as HTMLButtonElement | null;
        gaps.push({ pending, promiseSettled: true, sourceResponseObserved: target.observed === true,
          originalEnabledDom: !!fieldset && !fieldset.disabled && !!button && !button.disabled,
          callsBefore: calls.filter(call => call.kind === "commit").length });
        form?.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
      });
    },
    releasePreview() { if (!previewHeld || previewHeld.response === undefined) throw Error("No pending preview"); const target = previewHeld; previewHeld = null; target.resolve(target.response); },
    rerender(next: Props) { renderProps(next); },
    props: input.props,
  };
}
window.campaignMonster = bridge();
function App() {
  const [props, setProps] = useState(input.props);
  renderProps = setProps;
  window.campaignMonster.props = props;
  window.campaignMonster.propsReceived.push(structuredClone(props));
  if (props.role !== "owner") return <p role="status">Modeled nonowner: no DM instance props supplied.</p>;
  if (props.unavailable) return <p role="alert">{props.unavailable}</p>;
  const rows = props.rows.map(row => instanceSummarySchema.parse(row));
  let initial = props.initial;
  try {
    if (initial) {
      initial = instanceDetailSchema.parse(initial);
      const source = admittedMonsterSnapshot(initial.source_snapshot, initial.system_id, initial.source_content_id, initial.source_version);
      if (source.data.hit_points.average !== initial.declared_max_hp) throw Error("Wrong declared HP");
    }
  } catch { return <p role="alert">The modeled read returned an unsupported immutable source.</p>; }
  return <main className="min-w-0 space-y-6">
    <h1 className="j-display text-3xl">Original campaign monster fixture</h1>
    <p>Offline only: Auth, owner roles, actions, RPC, digest, server freshness and persistence are modeled.</p>
    <MonsterInstancePanel campaignId={props.campaignId} rows={rows} />
    <MonsterInstanceForm key={props.generation} campaignId={props.campaignId} ownerId={props.ownerId}
      systemId={props.systemId} initial={initial} sources={props.sources} />
  </main>;
}
createRoot(document.getElementById("root")!).render(<App />);
// Keep schema imports actual, not mocked: preview fixtures enter the real form parser.
export type ActualPreview = SourcePreview;
export const actualPreviewAdmission = sourcePreviewSchema;
