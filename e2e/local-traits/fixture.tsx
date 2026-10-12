import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { TraitForm } from "@/components/library/trait-form";
import { inspectTraitResourceEditability, mapHomebrewTraitFormData, TRAIT_UNCERTAIN_MESSAGE } from "@/lib/homebrew/trait-form";
import { traitDataSchema } from "@/lib/schemas/content-types/trait";

const cases = ["create-scalar", "create-blank", "create-zero", "edit-safe", "edit-locked", "create-pending", "create-invalid",
  "create-rejected", "create-malformed", "create-uncertain", "create-saved", "create-navigation-failure", "edit-conflict", "edit-uncertain"] as const;
type Scenario = typeof cases[number];
const requested = new URLSearchParams(location.search).get("case");
if (!cases.includes(requested as Scenario)) throw Error("Unknown offline trait scenario.");
const scenario = requested as Scenario;
const id = "33333333-3333-4333-8333-333333333331";
const latest = (scenario === "edit-conflict" || scenario === "edit-uncertain") && window.traitReloadCount > 1;
const raw = scenario === "edit-safe" ? { description: "Original safe integer trait.", usages: Number.MAX_SAFE_INTEGER, recovery: "long rest" }
  : scenario === "edit-locked" || latest ? { description: "Original per-level legacy trait.", usages: Array(20).fill(2), recovery: "dawn" }
  : { description: "Original synthetic trait.", usages: 2, recovery: "short rest" };
const mode = scenario.startsWith("edit-") ? "edit" : "create";
const resourceEditable = mode === "create" || inspectTraitResourceEditability(raw);
const initialValue = mode === "edit" ? { id, name: latest ? "Simulated latest trait" : "Original trait", version: latest ? 4 : 3,
  data: traitDataSchema.parse(raw), resourceEditable } : undefined;
interface ActionCall { mode: string; fields: Record<string, FormDataEntryValue>; mapped: ReturnType<typeof mapHomebrewTraitFormData>; simulatedId?: string }
interface Harness {
  scenario: Scenario; calls: ActionCall[]; navigation: Array<{ kind: string; href: string }>; homebrewChecks: number;
  simulatedInsertCount: number; releasePending?: () => void;
  submit: (mode: string, previous: unknown, form: FormData) => Promise<unknown>;
}
declare global { interface Window { traitReloadCount: number; traitHarness: Harness } }
window.traitHarness = { scenario, calls: [], navigation: [], homebrewChecks: 0, simulatedInsertCount: 0,
  async submit(actionMode, _previous, form) {
    const fields = Object.fromEntries(form.entries());
    const mapped = mapHomebrewTraitFormData(form, resourceEditable);
    const call: ActionCall = { mode: actionMode, fields, mapped };
    window.traitHarness.calls.push(call);
    if (!mapped.success) return { status: "error", message: "Simulated validation using the real mapper.", fieldErrors: mapped.fieldErrors };
    if (actionMode === "create") {
      window.traitHarness.simulatedInsertCount++;
      call.simulatedId = `33333333-3333-4333-8333-33333333333${window.traitHarness.simulatedInsertCount}`;
    }
    if (scenario === "create-rejected") throw Error("Simulated save succeeded but the response was lost; no real INSERT.");
    if (scenario === "create-malformed") return { status: "saved", id: "malformed-response-id" };
    if (scenario === "create-uncertain") return { status: "uncertain", message: TRAIT_UNCERTAIN_MESSAGE };
    if (scenario === "edit-conflict") return { status: "conflict", message: "Simulated stale version. Reload latest before saving again." };
    if (scenario === "edit-uncertain") return { status: "uncertain", message: "Simulated unconfirmed edit. Reload latest before saving again." };
    const saved = { status: "saved", id: call.simulatedId ?? id };
    if (scenario === "create-pending") return new Promise(resolve => { window.traitHarness.releasePending = () => resolve(saved); });
    return saved;
  } };

function App() {
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    const check = () => setChecked(true);
    window.addEventListener("trait-offline-homebrew-check", check);
    return () => window.removeEventListener("trait-offline-homebrew-check", check);
  }, []);
  return <main className="mx-auto w-full max-w-3xl space-y-5 p-4 sm:p-6">
    <h1 className="j-display text-3xl">Offline private trait form</h1>
    <p className="text-sm">Actual TraitForm and mapper. Original synthetic data. Actions, saved rows, owned-list checks and navigation are simulated; no auth, database or real attachment.</p>
    {checked ? <aside role="status" aria-label="Simulated Homebrew check" className="rounded border border-border p-3 text-sm">
      Simulated private Homebrew list checked. {window.traitHarness.simulatedInsertCount} simulated creation attempts; absence and duplicate prevention are not verified. This fixture keeps the form mounted; real navigation can lose its page-local draft.
    </aside> : null}
    {latest ? <p className="text-sm">Explicit local reload supplies simulated version4 with locked per-level/dawn data; no provider read.</p> : null}
    <TraitForm mode={mode} initialValue={initialValue} />
  </main>;
}
createRoot(document.getElementById("root")!).render(<App />);
