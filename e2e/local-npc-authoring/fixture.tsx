import React from "react";
import { createRoot } from "react-dom/client";
import { NpcForm } from "@/components/library/npc-form";
import { mapNpcForm } from "@/lib/homebrew/npc-form";
import { npcId, originalNpc } from "@/tests/fixtures/npcs";

const scenario = new URLSearchParams(location.search).get("scenario") ?? "structured";
const edit = scenario === "conflict" || scenario === "idle-edit";
const latest = edit && localStorage.getItem("npc-fixture-latest") === "2";
const calls: Array<{ mode: string; name: string; data: unknown; expectedVersion: string | null }> = [], navigation: string[] = [];
let finish: ((value: unknown) => void) | undefined;
const bridge = {
  scenario, calls, navigation,
  submit: async (mode: "create" | "edit", _state: unknown, form: FormData): Promise<unknown> => {
    calls.push({ mode, name: String(form.get("name")), data: JSON.parse(String(form.get("npc_data"))), expectedVersion: form.get("expected_version") as string | null });
    const mapped = mapNpcForm(form, mode);
    if (!mapped.success) return { status: "error", message: "Simulated field validation refusal.", fieldErrors: mapped.fieldErrors };
    if (scenario === "pending") return new Promise(resolve => { finish = resolve; });
    if (scenario.startsWith("idle")) return { status: "idle", message: "Unexpected nonblank idle after modeled call." };
    if (scenario === "uncertain") return undefined;
    if (scenario === "malformed") return { status: "saved", id: "invalid", version: 1, operation: mode };
    if (scenario === "conflict") { localStorage.setItem("npc-fixture-latest", "2"); return { status: "conflict", message: "Simulated strictly newer eligible NPC version." }; }
    if (scenario === "saved") return { status: "saved", id: npcId(1), version: 1, operation: "create" };
    return { status: "error", message: "Simulated rejected save; the draft is retained." };
  },
  release: (value: unknown) => { if (!finish) throw Error("No pending modeled action"); finish(value); },
};
Object.assign(window, { npcAuthoring: bridge });
createRoot(document.getElementById("root")!).render(<>
  <p className="mb-4 text-sm">Offline actual NPC form: actions, navigation, auth, persistence and latest-row reload are simulated. No SQL, catalog writes or campaign authority acceptance.</p>
  {edit ? <p role="status">Simulated loaded version {latest ? 2 : 1}</p> : null}
  <NpcForm key={`${scenario}-${latest}`} mode={edit ? "edit" : "create"} initialValue={edit ? { id: npcId(1), name: "Original NPC", version: latest ? 2 : 1,
    data: latest ? { ...originalNpc, description: "Stored simulated version 2." } : originalNpc } : undefined} />
</>);
