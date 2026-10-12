import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { MonsterForm } from "@/components/library/monster-form";
import { mapHomebrewMonsterFormData, mergeMonsterEdit, monsterJsonEqual } from "@/lib/homebrew/monster-form";
import { monsterDataSchema, type MonsterData } from "@/lib/schemas/content-types/monster";
import { cinderlitKite, lanternReefRegent, monsterWithBytes } from "@/tests/fixtures/monsters";

type RecordValue = { id: string; name: string; version: number; data: MonsterData };
type Outcome = "normal" | "recoverable" | "reject" | "malformed" | "pending" | "conflict";
interface Capture { mode: string; transportBytes: number; status: string; submitted?: unknown }
interface LocalStore { record?: RecordValue; history: RecordValue[]; calls: Capture[] }
interface Fixture {
  invoke: (mode: "create" | "edit", previous: unknown, input: FormData) => Promise<unknown>;
  state: () => LocalStore & { outcome: Outcome; longBytes: number; injection: string };
  setOutcome: (outcome: Outcome) => void;
  releasePending: () => void;
}
declare global { interface Window { monsterAuthoringFixture: Fixture } }

const ID = "11111111-1111-4111-8111-111111111111";
const STORAGE = "offline-monster-authoring-synthetic-store";
const injection = '<script>globalThis.compromised=true</script><img src=x onerror="alert(1)"> javascript:alert(1)';
const allFields = monsterDataSchema.parse({ ...structuredClone(lanternReefRegent),
  actions: lanternReefRegent.actions!.map((entry, index) => index === 1 ? { ...entry, description: injection } : entry) });
const long = monsterWithBytes(62_000);
long.traits![0].description = "é" + long.traits![0].description.slice(1);
long.traits![0].name = "LanternMemory" + "Z".repeat(107);
long.traits![19].description = "The final lantern keeps its place.";
monsterDataSchema.parse(long);
const longBytes = new TextEncoder().encode(JSON.stringify(long)).byteLength;

const previous = sessionStorage.getItem(STORAGE);
let store: LocalStore = previous ? JSON.parse(previous) as LocalStore : { history: [], calls: [] };
if (store.record) monsterDataSchema.parse(store.record.data);
let outcome: Outcome = "normal";
let pendingResolve: ((value: unknown) => void) | undefined;
const persist = () => sessionStorage.setItem(STORAGE, JSON.stringify(store));
function replaceFixture(name: string, data: MonsterData) {
  const record = { id: ID, name, version: 1, data: structuredClone(monsterDataSchema.parse(data)) };
  store = { record, history: [structuredClone(record)], calls: [] };
  outcome = "normal"; persist();
  return structuredClone(record);
}
window.monsterAuthoringFixture = {
  state: () => ({ ...structuredClone(store), outcome, longBytes, injection }),
  setOutcome: (next) => { outcome = next; },
  releasePending: () => { pendingResolve?.({ status: "error", message: "Pending synthetic response released. Draft retained." }); pendingResolve = undefined; },
  async invoke(mode, _previous, input) {
    const transportBytes = ["name", "monster_data", "changed_fields", "id", "expected_version"]
      .reduce((sum, key) => sum + new TextEncoder().encode(String(input.get(key) ?? "")).byteLength, 0);
    const capture: Capture = { mode, transportBytes, status: outcome };
    store.calls.push(capture);
    const parsed = mapHomebrewMonsterFormData(input, mode);
    if (!parsed.success) { persist(); return { status: "error", message: "Synthetic input validation failed.", fieldErrors: parsed.fieldErrors }; }
    capture.submitted = structuredClone(parsed.value);
    persist();
    if (outcome === "recoverable") return { status: "error", message: "Synthetic recoverable error. Draft retained.", fieldErrors: { creature_type: ["Original synthetic retry control."] } };
    if (outcome === "pending") return new Promise((resolve) => { pendingResolve = resolve; });
    if (outcome === "conflict") {
      if (store.record) {
        store.record = { ...store.record, version: store.record.version + 1, data: { ...store.record.data, description: "Original simulated concurrent revision." } };
        store.history.push(structuredClone(store.record)); persist();
      }
      return { status: "conflict", message: "Synthetic concurrent change. Reload latest before saving again." };
    }
    let next: RecordValue;
    if (mode === "create") next = { id: ID, name: parsed.value.name, version: 1, data: parsed.value.data };
    else {
      if (!store.record || parsed.value.id !== store.record.id || parsed.value.expectedVersion !== store.record.version) return { status: "conflict", message: "Synthetic stored version does not match." };
      const data = mergeMonsterEdit(store.record.data, parsed.value.data, parsed.value.changedFields);
      if (store.record.name === parsed.value.name && monsterJsonEqual(store.record.data, data)) return { status: "idle", message: "No changes to save." };
      next = { ...store.record, name: parsed.value.name, data, version: store.record.version + 1 };
    }
    store.record = structuredClone(next); store.history.push(structuredClone(next)); persist();
    // Deliberately simulate a lost or malformed response AFTER the synthetic local
    // store changes. The real form must not infer rollback or confirm that save.
    if (outcome === "reject") throw new Error("Synthetic lost response after local fixture write.");
    if (outcome === "malformed") return { status: "saved", record: next };
    return { status: "idle", message: "Simulated save recorded. Reload simulated store to inspect." };
  },
};

function Harness() {
  const [mount, setMount] = useState(() => ({ token: 0, mode: store.record ? "edit" as const : "create" as const,
    initial: store.record ? structuredClone(store.record) : undefined }));
  function edit(name: string, data: MonsterData) {
    const initial = replaceFixture(name, data);
    setMount((current) => ({ token: current.token + 1, mode: "edit", initial }));
  }
  return <div className="mx-auto w-full max-w-3xl space-y-5">
    <aside aria-label="Offline test controls" className="space-y-3 rounded-lg border border-border p-3 text-sm">
      <p>Offline actual MonsterForm QA. Account/action transport and session storage are synthetic. Auth, RLS, database writes, immutable snapshots and actual Next navigation are unavailable.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { store = { history: [], calls: [] }; outcome = "normal"; persist(); setMount((current) => ({ token: current.token + 1, mode: "create", initial: undefined })); }}>New empty create</button>
        <button type="button" onClick={() => edit("Cinderlit Kite", cinderlitKite)}>Load small fixture</button>
        <button type="button" onClick={() => edit("Lantern Reef Regent", allFields)}>Load all fields fixture</button>
        <button type="button" onClick={() => edit("OriginalNearBudget" + "W".repeat(80), long)}>Load near budget fixture</button>
        <button type="button" onClick={() => { if (store.record) setMount((current) => ({ token: current.token + 1, mode: "edit", initial: structuredClone(store.record) })); }}>Reload simulated store</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["normal", "recoverable", "reject", "malformed", "pending", "conflict"] as const).map((next) => <button key={next} type="button" onClick={() => { outcome = next; }}>Set {next} response</button>)}
        <button type="button" onClick={() => window.monsterAuthoringFixture.releasePending()}>Resolve pending response</button>
      </div>
    </aside>
    <MonsterForm key={mount.token} mode={mount.mode} initialValue={mount.initial} />
  </div>;
}
createRoot(document.getElementById("root")!).render(<Harness />);
