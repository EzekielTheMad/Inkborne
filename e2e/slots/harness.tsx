import { useState } from "react";
import { createRoot } from "react-dom/client";
import { CharacterProvider, useSpells } from "@/lib/character/character-context";
import { SlotTracker } from "@/components/sheet/spells/slot-tracker";
import { CastDialog } from "@/components/sheet/spells/cast-dialog";
import { RestDialog } from "@/components/sheet/rest-dialog";
import { CharacterPrintAction } from "@/components/sheet/character-print-action";
import { pinnedSlotClass } from "../../tests/fixtures/pinned-slot-class";
import { spellDataSchema } from "@/lib/schemas/content-types/spell";
import type { CharacterSpell } from "@/lib/types/spells";
import "./provider-shim";

const kind = window.__slotKind;
const noncaster = kind === "noncaster";
const baseRef = pinnedSlotClass(noncaster ? "fighter" : "paladin", 3, noncaster ? null : "half", noncaster ? null : [3, 0, 0, 0, 0, 0, 0, 0, 0]);
const validRefs = kind === "pact" ? [baseRef, pinnedSlotClass("local-pact", 3, "pact", [0, 2, 0, 0, 0, 0, 0, 0, 0])] : [baseRef];
const choices = validRefs.map(ref => ({ slug: ref.content_definitions.slug, level: 3 }));
const spell = { id: "original-light", character_id: "local-character", content_id: "light-content", content_version: 1, name: "Original Signal", class_slug: "paladin", is_known: true, is_prepared: true, source: "selection", content_definitions: { id: "light-content", version: 1, system_id: "local-system", slug: "original-signal", name: "Original Signal", content_type: "spell", data: spellDataSchema.parse({ level: 1, school: "illusion", casting_time: "1 action", range: "30 feet", components: ["V"], duration: "Instantaneous", concentration: false, ritual: false, description: "An original temporary signal for offline testing." }) } } as unknown as CharacterSpell;
const state = { current_hp: 12, spell_slots_used: noncaster ? {} : { "1": 1 } };
window.__slotStored = state; window.__slotWrites = [];
function Surface() {
  const [dialog, setDialog] = useState<"cast" | "rest" | null>(null);
  const { slotResolution } = useSpells();
  return <><p>Offline actual provider; in-memory conditional writes only.</p><output aria-label="Slot resolution">{JSON.stringify(slotResolution)}</output><SlotTracker /><CharacterPrintAction />
    {!noncaster && <button onClick={() => setDialog("cast")}>Open cast</button>}<button onClick={() => setDialog("rest")}>Open rest</button>
    {dialog === "cast" && <CastDialog open spell={spell} castability="full" onClose={() => setDialog(null)} />}
    {dialog === "rest" && <RestDialog open onClose={() => setDialog(null)} />}</>;
}
createRoot(document.getElementById("root")!).render(<CharacterProvider character={{ id: "local-character", user_id: "local-owner", system_id: "local-system", name: "Original Slot Fixture", game_systems: { id: "local-system", name: "Original Local Fixture System" }, level: choices.length * 3, choices: { classes: choices }, state, base_stats: {}, narrative: {} } as never}
  schema={{ ability_scores: [], skills: [], derived_stats: [], proficiency_levels: [], resources: [], content_types: [], currencies: [], creation_steps: [], sheet_sections: [] } as never}
  contentRefs={kind === "unavailable" ? [] : validRefs} contentSnapshotsComplete initialState={state} initialInventory={[]} initialSpells={noncaster ? [] : [spell]}
  classData={Object.fromEntries(validRefs.map(ref => [ref.content_definitions.slug, { slug: ref.content_definitions.slug, data: ref.content_definitions.data }])) as never} allEffects={[]} baseStatsWithLevel={{ level: choices.length * 3, intelligence: 10 }} structuredSources={{}}
  isOwner isDm={false} hasSheet maxHp={20} primaryColor={null} onPrimaryColorChange={() => {}}><Surface /></CharacterProvider>);
