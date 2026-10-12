import { useState } from "react";
import { createRoot } from "react-dom/client";
import { CharacterProvider, useSpells } from "@/lib/character/character-context";
import { CastDialog } from "@/components/sheet/spells/cast-dialog";
import { SpellsTab } from "@/components/sheet/tabs/spells-tab";
import { RestDialog } from "@/components/sheet/rest-dialog";
import { CharacterPrintAction } from "@/components/sheet/character-print-action";
import { originalGrantData, originalParent, originalSubclass, originalSubclassData, originalSubclassFixture, subclassOwnerId } from "../../tests/fixtures/subclass-casting";
import "./provider-shim";
const kind = window.__subclassKind, input = originalSubclassFixture(kind === "inactive" ? 1 : 3);
if (kind === "prepared") input.contentRefs[1] = originalSubclass(originalSubclassData(true));
if (kind.startsWith("grant-")) {
  const type = kind === "grant-full" ? "full" : kind === "grant-half" ? "half" : "pact";
  input.contentRefs = [originalParent("warden", type, type === "pact" ? [0, 2, 0, 0, 0, 0, 0, 0, 0] : [3, 0, 0, 0, 0, 0, 0, 0, 0]), originalSubclass(originalGrantData())];
}
if (kind === "missing") input.contentRefs.pop();
if (kind === "multiclass") {
  input.character.choices.classes.push({ slug: "original-full", level: 5 });
  input.contentRefs.push(originalParent("original-full", "full", [4, 3, 2, 0, 0, 0, 0, 0, 0], 11));
}
const level = input.character.choices.classes.reduce((sum, choice) => sum + choice.level, 0);
const initialState = { current_hp: 12, spell_slots_used: {}, active_effects: [], concentrating_on: null };
window.__subclassStored = initialState; window.__subclassWrites = []; window.__subclassRolls = []; window.__subclassUpdates = [];
function Surface() {
  const [rest, setRest] = useState(false), [inspect, setInspect] = useState(false);
  const spells = useSpells();
  return <><h1>Original selected subclass fixture</h1><p>Canonical private snapshot payloads, actual provider/dialogs; local conditional model and roll log.</p>
    <SpellsTab /><CharacterPrintAction /><button onClick={() => setRest(true)}>Open rest</button>
    {kind === "viewer" && <button onClick={() => setInspect(true)}>Inspect source</button>}
    <RestDialog open={rest} onClose={() => setRest(false)} />
    <CastDialog open={inspect} spell={input.spells[0]} castability="full" onClose={() => setInspect(false)} />
    <output aria-label="Slot resolution">{JSON.stringify(spells.slotResolution)}</output>
    <output aria-label="Casting profiles">{JSON.stringify(spells.casterInfo.classes)}</output></>;
}
createRoot(document.getElementById("root")!).render(<CharacterProvider
  character={{ ...input.character, user_id: subclassOwnerId, name: "Original Warden", level, state: initialState, narrative: {}, base_stats: {}, game_systems: { id: input.character.system_id, name: "Original local system" } } as never}
  schema={{ ability_scores: [{ slug: "intelligence", name: "Intelligence", abbr: "INT" }, { slug: "charisma", name: "Charisma", abbr: "CHA" }], derived_stats: [{ slug: "proficiency_bonus", name: "Proficiency bonus", base: 2 }, { slug: "armor_class", name: "Armor class", base: 10 }], skills: [], proficiency_levels: [], resources: [], content_types: [], currencies: [], creation_steps: [], sheet_sections: [] }}
  contentRefs={input.contentRefs} contentSnapshotsComplete initialState={initialState} initialInventory={[]} initialSpells={input.spells}
  classData={Object.fromEntries(input.contentRefs.filter(ref => ref.content_definitions.content_type === "class").map(ref => [ref.content_definitions.slug, { slug: ref.content_definitions.slug, data: ref.content_definitions.data }])) as never}
  allEffects={[]} baseStatsWithLevel={{ level, intelligence: 14, charisma: 20, constitution: 10 }} structuredSources={{}} isOwner={kind !== "viewer"} isDm={kind === "viewer"} hasSheet maxHp={20} primaryColor={null} onPrimaryColorChange={() => {}}><Surface /></CharacterProvider>);
