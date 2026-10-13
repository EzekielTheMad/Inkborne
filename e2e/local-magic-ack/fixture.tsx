import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { MagicItemForm } from "@/components/library/magic-item-form";
import { acceptMagicItemResponse, mapHomebrewMagicItemFormData, mapMagicItemEditIdentity, mergeMagicItemEdit, MAGIC_ITEM_VERSION_MAX } from "@/lib/homebrew/magic-item-form";
import { magicItemDataSchema } from "@/lib/schemas/content-types/magic-item";
import { parseContentDefinition, parseContentVersionSnapshot } from "@/lib/supabase/content-definitions-parser";

const ID = "11111111-1111-4111-8111-111111111111", OTHER = "22222222-2222-4222-8222-222222222222", OWNER = "33333333-3333-4333-8333-333333333333", SYSTEM = "44444444-4444-4444-8444-444444444444";
const scenario = new URLSearchParams(location.search).get("scenario") ?? "create";
const edits = ["edit-raw", "edit-absent", "idle-edit", "drift-id", "drift-version", "no-op", "max-no-op", "max-change", "conflict"];
const edit = edits.includes(scenario), storageKey = `magic-ack-modeled-reload:${scenario}`;
interface ModelRow { id: string; name: string; version: number; data: Record<string, unknown>; effects: unknown[]; slug: string; system_id: string; owner_id: string;
  content_type: "magic_item"; source: "homebrew"; scope: "personal"; is_retired: false; created_at: string }
const effects = [{ type: "mechanical", stat: "armor_class", op: "add", value: 1, tag: "synthetic_manual", extension: { preserved: true } },
  { type: "mechanical", stat: "strength", op: "formula", expr: "strength + 1", condition: { field: "synthetic_ready", op: "eq", value: true }, extension: [0, 0, null] }];
const rawExtensions = { source_refs: [{ slug: "synthetic-original-source" }], custom: { order: [2, 2, 1], optional: null } };
function original(): ModelRow {
  return { id: ID, system_id: SYSTEM, owner_id: OWNER, name: scenario === "edit-absent" ? "  Original Compass  " : "Original Compass", content_type: "magic_item", source: "homebrew", scope: "personal", is_retired: false,
    slug: "synthetic-original-compass", version: scenario.startsWith("max-") ? MAGIC_ITEM_VERSION_MAX : 1, created_at: "2026-10-01T00:00:00.000Z", effects,
    data: scenario === "edit-absent" ? { description: "  Original narrative.  ", ...rawExtensions }
      : { rarity: "Rare", description: "Original narrative.", equipment_category: "Wondrous item", requires_attunement: true, ...rawExtensions } };
}
function pin(row: ModelRow) { return { content_id: row.id, version: row.version, system_id_snapshot: row.system_id, owner_id_snapshot: row.owner_id, content_type_snapshot: row.content_type,
  source_snapshot: row.source, scope_snapshot: row.scope, slug_snapshot: row.slug, name_snapshot: row.name, data_snapshot: row.data, effects_snapshot: row.effects }; }
const originalRow = original(), historicalPin = structuredClone(pin(originalRow));
function admit(row: ModelRow) {
  if (!parseContentDefinition(row) || !parseContentVersionSnapshot(pin(row))) throw Error("Canonical synthetic row/pin fixture admission failed");
}
admit(originalRow);
const stored = localStorage.getItem(storageKey), loaded = stored ? JSON.parse(stored) as ModelRow : originalRow; admit(loaded);
const calls: Array<{ mode: string; entries: Array<[string, string]>; expectedVersion: string | null; mapped?: unknown }> = [];
const writes: Array<{ operation: string; row: ModelRow; payload: unknown; boundary: string }> = [], navigation: Array<{ kind: string; href: string }> = [], pinAdmissions: Array<{ id: string; version: number }> = [];
let finish: ((value: unknown) => void) | undefined, changeProps: ((value: ModelRow) => void) | undefined;
function modeledWrite(row: ModelRow, operation: "create" | "edit", payload: unknown) {
  admit(row); pinAdmissions.push({ id: row.id, version: row.version }); writes.push({ operation, row: structuredClone(row), payload, boundary: "Modeled Auth/DAL/write/immutable confirmation; real canonical parsers" });
  return { status: "saved", operation, id: row.id, version: row.version };
}
const bridge = {
  scenario, calls, writes, navigation, pinAdmissions, historicalPin, originalRow, loaded,
  submit: async (mode: "create" | "edit", _previous: unknown, form: FormData): Promise<unknown> => {
    const call = { mode, entries: [...form.entries()].map(([key, value]) => [key, String(value)] as [string, string]), expectedVersion: form.get("expected_version") as string | null, mapped: undefined as unknown };
    calls.push(call);
    const mapped = mapHomebrewMagicItemFormData(form); if (!mapped.success) return { status: "error", message: "Modeled field refusal from the actual mapper.", fieldErrors: mapped.fieldErrors };
    call.mapped = mapped.data;
    if (scenario === "pending") return new Promise(resolve => { finish = resolve; });
    if (mode === "edit") {
      const identity = mapMagicItemEditIdentity(form); if (!identity) return { status: "error", message: "Modeled invalid edit identity." };
      if (identity.id !== loaded.id || identity.expectedVersion !== loaded.version) return { status: "uncertain", message: "Modeled mounted identity mismatch." };
      if (scenario === "conflict") {
        const latest = { ...loaded, version: loaded.version + 1, data: { ...loaded.data, description: "Modeled latest canonical description." } }; admit(latest);
        localStorage.setItem(storageKey, JSON.stringify(latest)); return { status: "conflict", message: "Modeled strictly newer eligible version; reload discards the draft." };
      }
      if (scenario === "idle-edit") { localStorage.setItem(storageKey, JSON.stringify(loaded)); return { status: "idle", message: "Modeled unexpected nonblank idle edit response." }; }
      const merged = mergeMagicItemEdit(loaded.name, loaded.data, mapped.data);
      if (merged.name === loaded.name && JSON.stringify(merged.data) === JSON.stringify(loaded.data)) return acceptMagicItemResponse({ status: "unchanged", id: loaded.id, version: loaded.version, message: "Modeled no-op: this invocation did not write." }, "edit", identity.id, identity.expectedVersion);
      if (loaded.version === MAGIC_ITEM_VERSION_MAX) return { status: "error", message: "Modeled pg version limit; no write attempted." };
      return modeledWrite({ ...loaded, ...merged, version: loaded.version + 1 }, "edit", { name: merged.name, data: merged.data });
    }
    const saved = modeledWrite({ ...originalRow, id: ID, name: mapped.data.name, data: mapped.data.data, effects: [], version: 1 }, "create", { name: mapped.data.name, data: mapped.data.data, effects: [] });
    if (scenario === "idle-create") return { status: "idle", message: "Modeled unexpected nonblank idle after an issued create." };
    if (scenario === "malformed-create") return { ...saved, id: "invalid" };
    if (scenario === "lost-create") throw Error("Modeled transport loss after issued create");
    return scenario === "saved-cache" ? { ...saved, message: "Modeled catalog refresh failed after exact saved pin confirmation; do not repeat this save." } : saved;
  },
  release: (value: unknown) => { if (!finish) throw Error("No pending modeled action"); finish(value); finish = undefined; },
  drift: () => {
    if (!changeProps) throw Error("Fixture not mounted");
    const next = { ...loaded, ...(scenario === "drift-id" ? { id: OTHER } : { version: loaded.version + 1 }), name: "Reloaded original Compass", data: { ...loaded.data, description: "Reloaded original narrative." } };
    admit(next); localStorage.setItem(storageKey, JSON.stringify(next)); changeProps(next);
  },
};
Object.assign(window, { magicAck: bridge });
function App() {
  const [initial, setInitial] = useState(loaded);
  useEffect(() => { changeProps = setInitial; return () => { changeProps = undefined; }; }, []);
  return <div className="mx-auto max-w-3xl space-y-4">
    <p className="text-sm" id="magic-offline-disclosure">Offline actual MagicItemForm/mapper/canonical pin parsers. Auth, action/DAL, writes, cache, router, Homebrew destination and reload reads are modeled. Native reset/reload/events are real. No SQL, RLS, persistence, latest-private or exactly-once acceptance.</p>
    <p className="text-xs" id="magic-modeled-identity">Modeled loaded identity {initial.id}, version {initial.version}.</p>
    <MagicItemForm mode={edit ? "edit" : "create"} initialValue={edit ? { id: initial.id, name: initial.name, version: initial.version, data: magicItemDataSchema.parse(initial.data) } : undefined} />
  </div>;
}
createRoot(document.getElementById("root")!).render(<App />);
