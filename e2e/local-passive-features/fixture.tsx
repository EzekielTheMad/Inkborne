import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { PassiveFeatureForm } from "@/components/library/passive-feature-form";
import { mapPassiveFeatureCreate, mapPassiveFeatureEdit, featureUncertainty } from "@/lib/homebrew/passive-feature-form";
import { featureDataSchema } from "@/lib/schemas/content-types/feature";
import { effectSchema } from "@/lib/schemas/effects";
import { extendedFeatureData, extendedFeatureEffects, passiveFeatureId } from "@/tests/fixtures/passive-features";

const cases = ["create-basic", "create-subclass", "create-level20", "create-invalid-class", "create-invalid-subclass", "create-invalid-level", "create-leading-level", "create-name101", "create-long", "create-pending", "create-rejected", "create-missing", "create-malformed", "create-uncertain", "create-navigation-failure", "edit-preserved", "edit-absent", "edit-noop", "edit-conflict", "edit-uncertain", "edit-rejected", "edit-admission"] as const;
type Scenario = typeof cases[number];
const requested = new URLSearchParams(location.search).get("case");
if (!cases.includes(requested as Scenario)) throw Error("Unknown passive feature scenario.");
const scenario = requested as Scenario, mode = scenario.startsWith("edit-") ? "edit" : "create";
const latest = ["edit-conflict", "edit-uncertain", "edit-rejected"].includes(scenario) && window.passiveFeatureReloadCount > 1;
const raw = structuredClone(extendedFeatureData) as Record<string, unknown>;
if (scenario === "edit-absent") delete raw.feature_type;
if (scenario === "edit-admission") raw.feature_type = "class_feature";
const effects = structuredClone(extendedFeatureEffects);
const initialValue = mode === "edit" ? { id: passiveFeatureId, name: latest ? "Simulated latest feature" : "Original standalone feature", version: latest ? 4 : 3,
  data: { description: String(raw.description), class: String(raw.class), level: Number(raw.level),
    ...(Object.hasOwn(raw, "feature_type") && raw.feature_type !== "class_feature" ? { feature_type: raw.feature_type as "choice" } : {}) } } : undefined;
type Mapped = ReturnType<typeof mapPassiveFeatureCreate> | ReturnType<typeof mapPassiveFeatureEdit>;
interface Call { mode: string; fields: Record<string, FormDataEntryValue>; mapped: Mapped; simulatedId?: string }
interface Harness {
 scenario: Scenario; calls: Call[]; navigation: Array<{kind:string;href:string}>; homebrewChecks:number; simulatedInsertCount:number;
 simulatedWrites: Array<{ id:string; version:number; data:Record<string,unknown>; effects:unknown[] }>;
 initialRaw: Record<string,unknown>; initialEffects:unknown[]; releasePending?:()=>void;
 submit:(mode:string, previous:unknown, form:FormData)=>Promise<unknown>;
}
declare global { interface Window { passiveFeatureReloadCount:number; passiveFeatureHarness:Harness } }
window.passiveFeatureHarness = { scenario, calls:[], navigation:[], homebrewChecks:0, simulatedInsertCount:0, simulatedWrites:[], initialRaw:structuredClone(raw), initialEffects:structuredClone(effects),
 async submit(actionMode, _previous, form) {
  const mapped = actionMode === "create" ? mapPassiveFeatureCreate(form) : mapPassiveFeatureEdit(form);
  const call:Call = { mode:actionMode, fields:Object.fromEntries(form), mapped }; window.passiveFeatureHarness.calls.push(call);
  if (!mapped.success) return {status:"error",message:"Simulated action admission using the actual named-control mapper.",fieldErrors:mapped.fieldErrors};
  const data = actionMode === "create" ? {feature_type:"passive",class:call.fields.class,subclass:call.fields.subclass || null,level:Number(call.fields.level),description:call.fields.description} : {...raw,description:call.fields.description};
  // Real canonical validation, but this synthetic write/readback is NOT the DAL or PostgreSQL.
  if (!featureDataSchema.safeParse(data).success || !effects.every(effect => effectSchema.safeParse(effect).success)) return {status:"error",message:"Unsupported canonical feature data; no simulated write attempted."};
  if (scenario === "edit-conflict") return {status:"conflict",message:"Simulated stale version. Reload latest before saving again."};
  if (scenario === "edit-noop") return {status:"unchanged",id:passiveFeatureId,version:3,message:"No changes to save."};
  if (actionMode === "create") { window.passiveFeatureHarness.simulatedInsertCount++; call.simulatedId = `11111111-1111-4111-8111-11111111111${window.passiveFeatureHarness.simulatedInsertCount}`; }
  const saved = {status:"saved",id:call.simulatedId ?? passiveFeatureId,version:actionMode === "create" ? 1 : 4,operation:actionMode};
  const accept = () => window.passiveFeatureHarness.simulatedWrites.push({id:saved.id,version:saved.version,data,effects:actionMode === "create" ? [] : structuredClone(effects)});
  if (scenario === "create-pending") return new Promise(resolve => {window.passiveFeatureHarness.releasePending = () => {accept();resolve(saved);};});
  accept();
  if (scenario.endsWith("rejected")) throw Error("Simulated write followed by rejected response; no actual persistence.");
  if (scenario === "create-missing") return undefined;
  if (scenario === "create-malformed") return {status:"saved",id:"bad"};
  if (scenario.endsWith("uncertain")) return featureUncertainty(actionMode as "create"|"edit");
  return saved;
 } };
function App() {
 const [checked,setChecked]=useState(false);
 useEffect(()=>{const check=()=>setChecked(true);window.addEventListener("passiveFeature-offline-homebrew-check",check);return()=>window.removeEventListener("passiveFeature-offline-homebrew-check",check);},[]);
 return <main className="mx-auto w-full max-w-3xl space-y-5 p-4 sm:p-6"><h1 className="j-display text-3xl">Offline private passive feature form</h1>
 <p className="text-sm">Actual form and canonical admission; original content. Actions, writes, readback, list checks and navigation simulated. No database, auth or attachment authority.</p>
 {checked ? <aside role="status" aria-label="Simulated Homebrew check">Simulated private list checked. Page-local draft remains mounted; real navigation may lose it.</aside>:null}
 <PassiveFeatureForm mode={mode} initialValue={initialValue}/></main>;
}
createRoot(document.getElementById("root")!).render(<App/>);
