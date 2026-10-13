import { useState } from "react";
import { createRoot } from "react-dom/client";
import { MonsterInstanceForm } from "@/components/campaigns/monster-instance-form";
import { MonsterInstancePanel } from "@/components/campaigns/monster-instance-panel";
import { instanceIntentFromForm } from "@/lib/campaigns/monster-instance-form";
import { admittedMonsterSnapshot, instanceDetailSchema, instanceSummarySchema, sourcePreviewSchema,
  type InstanceDetail, type SourcePreview } from "@/lib/campaigns/monster-instance-schema";

type Props = { campaignId: string; ownerId: string; systemId: string; initial?: InstanceDetail;
  sources?: { id: string; name: string; version: number }[]; generation: string; role: string; unavailable?: string; rows: unknown[] };
type Held = { response?: unknown; observed?: boolean; resolve: (value: unknown) => void; reject: (error: Error) => void };
type Trace = { kind: string; campaign: string; intent?: unknown; operation?: string; source?: string; version?: number };
declare global { interface Window { campaignMonster: ReturnType<typeof bridge>; __m5Executed?: boolean } }
const input = JSON.parse(document.getElementById("model-props")!.textContent!) as { props: Props; scenario: string };
let renderProps = (_next: Props) => {}; // Filled before actions can be invoked.
function bridge() {
  const calls: Trace[] = [], propsReceived: Props[] = [], gaps: unknown[] = [];
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
    calls, propsReceived, gaps,
    navigationFailure: false,
    mode(value: string) { mode = value; },
    api,
    commit(campaign: string, form: FormData) {
      const intent = instanceIntentFromForm(form);
      calls.push({ kind: "commit", campaign, intent: structuredClone(intent) });
      return transport("commit", { campaign, intent, mode }, ["hold", "settlement-saved", "settlement-uncertain", "settlement-refusal", "late"].includes(mode));
    },
    preview(campaign: string, source: string, version: number) {
      calls.push({ kind: "preview", campaign, source, version });
      return transport("preview", { campaign, source, version }, mode === "hold-preview");
    },
    resolve(campaign: string, operation: string) {
      calls.push({ kind: "resolve", campaign, operation }); return transport("resolve", { campaign, operation, mode }, false);
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
