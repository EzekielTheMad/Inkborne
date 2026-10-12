import { useState } from "react";
import { createRoot } from "react-dom/client";
import { CharacterProvider, useSpells } from "@/lib/character/character-context";
import { CastDialog } from "@/components/sheet/spells/cast-dialog";
import { SpellHeader } from "@/components/sheet/spells/spell-header";
import { castingAbilityFixture } from "../../tests/fixtures/casting-acquisitions";
import "./provider-shim";

const kind = window.__castingKind;
const input = castingAbilityFixture(kind.startsWith("cha-") ? 10 : 18, kind.startsWith("cha-") ? 18 : 10);
const target = input.spells.find(spell => spell.class_slug === (kind.endsWith("wizard") ? "wizard" : "warlock"))!;
const initialState = { current_hp: 20, spell_slots_used: {}, active_effects: [], concentrating_on: null };
window.__castingStored = initialState; window.__castingWrites = []; window.__castingRolls = [];
function Surface() {
  const [open, setOpen] = useState(false);
  const spells = useSpells();
  return <><h1>Original multiclass casting fixture</h1><p>Actual provider and cast dialog. In-memory conditional writes and roll log only.</p>
    <SpellHeader /><button onClick={() => setOpen(true)}>Open cast</button>
    <CastDialog open={open} spell={target} castability="full" onClose={() => setOpen(false)} />
    <output aria-label="Current profile">{JSON.stringify(spells.getCastingAbility(target))}</output></>;
}
createRoot(document.getElementById("root")!).render(<CharacterProvider
  character={{ ...input.character, name: "Original Multiclass Fixture", level: 6, state: initialState, narrative: {}, base_stats: {} } as never}
  schema={{ ability_scores: [{ slug: "intelligence", name: "Intelligence", abbr: "INT" }, { slug: "charisma", name: "Charisma", abbr: "CHA" }], derived_stats: [{ slug: "proficiency_bonus", name: "Proficiency bonus", base: 3 }], skills: [], proficiency_levels: [], resources: [], currencies: [], content_types: [], creation_steps: [], sheet_sections: [] }}
  contentRefs={input.contentRefs} initialState={initialState} initialInventory={[]} initialSpells={kind === "missing" ? [] : [...input.spells]}
  classData={Object.fromEntries(input.contentRefs.map(ref => [ref.content_definitions.slug, { slug: ref.content_definitions.slug, data: ref.content_definitions.data }])) as never}
  allEffects={[]} baseStatsWithLevel={{ level: 6, ...input.abilityScores }} structuredSources={{}} isOwner={kind !== "viewer"} isDm={kind === "viewer"} hasSheet maxHp={20} primaryColor={null} onPrimaryColorChange={() => {}}><Surface /></CharacterProvider>);
