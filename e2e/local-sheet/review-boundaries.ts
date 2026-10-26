import type { CharacterWithSystem, CharacterState } from "@/lib/types/character";
import type { InventoryItem } from "@/lib/types/inventory";
import type { CharacterSpell } from "@/lib/types/spells";
import type { RollLogEntry } from "@/lib/types/rolls";
import type { CharacterTimelineEvent, CharacterRelationship } from "@/lib/types/narrative";

const PREFIX = "inkborne-dev-sheet-review-v1:";
export interface StoredCharacter { character: CharacterWithSystem; state: CharacterState; inventory: InventoryItem[]; spells: CharacterSpell[]; rolls: RollLogEntry[]; timeline: CharacterTimelineEvent[]; relationships: CharacterRelationship[] }
type Row = Record<string, unknown>;
interface ReviewController {
  currentId: string;
  operations: Array<{ name: string; args: unknown[] }>;
  unexpected: string[];
  call: (name: string, ...args: unknown[]) => Promise<unknown>;
  read: (id?: string) => StoredCharacter | null;
}
declare global { interface Window { sheetReview: ReviewController } }
export function readStored(id: string): StoredCharacter | null { const json = localStorage.getItem(PREFIX + id); return json ? JSON.parse(json) : null; }
export function persist(id: string, record: StoredCharacter) { localStorage.setItem(PREFIX + id, JSON.stringify(record)); }
const clone = <T,>(value: T): T => structuredClone(value);
function loaded(id?: string) { const result = readStored(id ?? window.sheetReview.currentId); if (!result) throw new Error("Unknown local review character"); return result; }
function update(id: string, change: (record: StoredCharacter) => void) { const record = loaded(id); change(record); persist(id, record); return record; }

export function installBoundary() {
  window.sheetReview = {
    currentId: "", operations: [], unexpected: [],
    read: (id?: string) => clone(readStored(id ?? window.sheetReview.currentId)),
    async call(name, ...args) {
      const api = window.sheetReview;
      api.operations.push({ name, args: clone(args) });
      if (name === "rpc") {
        const [rpc, raw] = args as [string, Row];
        // Existing dev's single atomic shallow-merge RPC only. No simulated
        // conditional or authority behavior from the newer integration.
        if (rpc !== "patch_character_state") return unknown(name + ":" + rpc);
        const id = String(raw.character_id);
        update(id, record => { record.state = { ...record.state, ...(raw.state_patch as CharacterState) }; });
        return { error: null, data: null };
      }
      if (name === "updateCharacterColor") { const [id, color] = args as [string, string | null]; update(id, record => { record.character.primary_color = color; }); return; }
      if (["saveNarrative", "saveNarrativeRich", "savePersonalityChoices"].includes(name)) {
        const [id, value] = args as [string, Row];
        update(id, record => {
          if (name === "saveNarrative") record.character.narrative = { ...record.character.narrative, ...clone(value) };
          if (name === "saveNarrativeRich") record.character.narrative_rich = { ...record.character.narrative_rich, ...clone(value) };
          if (name === "savePersonalityChoices") record.character.choices = { ...record.character.choices, ...clone(value) };
        });
        return { success: true };
      }
      if (name === "insertRoll") {
        const [id, raw] = args as [string, RollLogEntry["result"]];
        update(id, record => { record.rolls.unshift({ id: crypto.randomUUID(), character_id: id, user_id: "local-review", kind: raw.request.kind, label: raw.request.label, expression: raw.request.expression, result: clone(raw), total: raw.total, rolled_at: raw.rolled_at }); }); return;
      }
      if (name === "searchItems" || name === "searchSpells") {
        const query = String(args[1] ?? "").toLowerCase(); const record = loaded();
        const definitions = (name === "searchItems" ? record.inventory : record.spells).flatMap(item => item.content_definitions ? [item.content_definitions] : []);
        return clone(definitions.filter(definition => definition.name.toLowerCase().includes(query)));
      }
      if (name === "addInventoryItem" || name === "addCharacterSpell") {
        const [id, payload] = args as [string, Row];
        let added: unknown;
        update(id, record => {
          const shared = { id: crypto.randomUUID(), character_id: id, content_id: null, content_version: null, custom_data: null, created_at: new Date().toISOString(), ...clone(payload) };
          if (name === "addInventoryItem") { const item = { equipped: false, attuned: false, sort_order: record.inventory.length, quantity: 1, notes: "", ...shared } as InventoryItem; record.inventory.push(item); added = item; }
          else { const item = { is_known: true, is_prepared: false, in_spellbook: true, always_prepared: false, source: "selection", ...shared } as CharacterSpell; record.spells.push(item); added = item; }
        }); return clone(added);
      }
      if (["updateInventoryItem", "removeInventoryItem", "updateCharacterSpell", "removeCharacterSpell"].includes(name)) {
        const [rowId, patch] = args as [string, Row]; const id = api.currentId;
        update(id, record => {
          if (name === "updateInventoryItem") record.inventory = record.inventory.map(item => item.id === rowId ? { ...item, ...clone(patch) } : item);
          if (name === "removeInventoryItem") record.inventory = record.inventory.filter(item => item.id !== rowId);
          if (name === "updateCharacterSpell") record.spells = record.spells.map(item => item.id === rowId ? { ...item, ...clone(patch) } : item);
          if (name === "removeCharacterSpell") record.spells = record.spells.filter(item => item.id !== rowId);
        }); return;
      }
      if (name === "unequipAllArmor") { update(String(args[0]), record => { record.inventory = record.inventory.map(item => item.content_type === "armor" ? { ...item, equipped: false } : item); }); return; }
      if (["uploadPortrait", "uploadToken", "deletePortrait", "deleteToken"].includes(name)) return { error: "Image uploads and deletions are not enabled in this local review." };
      if (["createTimelineEvent", "updateTimelineEvent", "deleteTimelineEvent", "createRelationship", "updateRelationship", "deleteRelationship"].includes(name)) return { error: "Story record mutations are not enabled in this local review." };
      if (name === "submitFeedback") return "Feedback is not sent from this local review.";
      return unknown(name);
    },
  };
}
function unknown(name: string): never { window.sheetReview.unexpected.push(name); throw new Error(`Unexpected local review operation: ${name}`); }
