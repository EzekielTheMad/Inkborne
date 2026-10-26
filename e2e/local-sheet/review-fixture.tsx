/** Local review only. The real character provider/page/UI run against a
 * fictional loaded graph and an explicit browser-local persistence adapter.
 * Nothing here is imported by the Next application or deployed routes. */
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { CharacterPageClient } from "@/components/character/character-page-client";
import { ThemeProvider } from "@/components/theme-provider";
import { AppNav } from "@/components/nav/app-nav";
import { MobileNav } from "@/components/nav/mobile-nav";
import { FeedbackProvider } from "@/components/feedback/feedback-provider";
import { localFixtureData } from "./fixture-data";
import { classDataSchema } from "@/lib/schemas/content-types/class";
import { featureDataSchema } from "@/lib/schemas/content-types/feature";
import { spellDataSchema } from "@/lib/schemas/content-types/spell";
import { evaluate } from "@/lib/engine/evaluator";
import type { CharacterWithSystem } from "@/lib/types/character";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import { CharacterRouteFrame } from "@/components/character/character-route-frame";
import { installBoundary, readStored, persist, type StoredCharacter } from "./review-boundaries";

export const REVIEW_STORAGE_PREFIX = "inkborne-dev-sheet-review-v1:";
const ids = {
  martial: "11111111-1111-4111-8111-111111111111",
  caster: "11111111-1111-4111-8111-111111111112",
};
const paragraph = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

function fixture(kind: "martial" | "caster") {
  const source = localFixtureData(kind);
  const id = ids[kind];
  const classSlug = kind === "martial" ? "fighter" : "wizard";
  const character = structuredClone(source.character) as CharacterWithSystem;
  character.id = id;
  character.campaign_id = null;
  character.primary_color = null;
  character.choices = {
    ...character.choices,
    personality_traits: ["I remember every bridge I have crossed."],
    ideals: ["A safe road belongs to everyone."],
    bonds: ["The village lantern still waits for my return."],
    flaws: ["I take responsibility for travelers I have only just met."],
  };
  character.narrative = {
    full_name: character.name,
    aliases: kind === "martial" ? "The Bridgewarden" : "Keeper of the Last Light",
    one_liner: kind === "martial" ? "A steady hand on an uncertain road." : "A curious scholar, following the lights home.",
    age: kind === "martial" ? "34" : "42",
    build: kind === "martial" ? "Broad-shouldered, weathered by the high road" : "Wiry, with ink-stained fingers",
    origin: "The foothill villages of Bellmere",
    motivation: "Keep the next traveler from making the journey alone.",
    mannerisms: "Counts the lanterns before leaving any room.",
    fear: "An unlit road and a voice no one answers.",
    fun_traits: { favorite_food: "Apple bread", hobby: "Sketching roadside shrines" },
  };
  character.narrative_rich = {
    backstory_origin: paragraph("The old road wound through Bellmere long before its villages had names. I grew up listening for the sound of travelers at the bridge, and learned to leave a lantern burning for anyone who arrived after dusk."),
    backstory_turning_point: paragraph("When the spring floods took the bridge, strangers helped us build it again. I have followed the road ever since, repaying that kindness one crossing at a time."),
    distinguishing_features: paragraph("A small brass lantern hangs from a worn leather strap. The notebook in my coat is full of maps, names, and promises kept."),
  };
  const schema = structuredClone(source.schema);
  schema.skills = [
    ["acrobatics", "Acrobatics", "dexterity"], ["animal-handling", "Animal Handling", "wisdom"],
    ["arcana", "Arcana", "intelligence"], ["athletics", "Athletics", "strength"],
    ["deception", "Deception", "charisma"], ["history", "History", "intelligence"],
    ["insight", "Insight", "wisdom"], ["intimidation", "Intimidation", "charisma"],
    ["investigation", "Investigation", "intelligence"], ["medicine", "Medicine", "wisdom"],
    ["nature", "Nature", "intelligence"], ["perception", "Perception", "wisdom"],
    ["performance", "Performance", "charisma"], ["persuasion", "Persuasion", "charisma"],
    ["religion", "Religion", "intelligence"], ["sleight-of-hand", "Sleight of Hand", "dexterity"],
    ["stealth", "Stealth", "dexterity"], ["survival", "Survival", "wisdom"],
  ].map(([slug, name, ability]) => ({ slug, name, ability }));
  schema.proficiency_levels = [{ slug: "proficient", name: "Proficient", multiplier: 1 }, { slug: "expertise", name: "Expertise", multiplier: 2 }];
  schema.derived_stats = [
    { slug: "proficiency_bonus", name: "Proficiency bonus", base: 3 },
    { slug: "armor_class", name: "Armor class", base: kind === "martial" ? 17 : 12 },
    { slug: "initiative", name: "Initiative", formula: "mod(dexterity)" },
    { slug: "speed", name: "Speed", base: 30 },
  ];
  schema.currencies = [{ slug: "cp", name: "Copper", rate: .01 }, { slug: "sp", name: "Silver", rate: .1 }, { slug: "ep", name: "Electrum", rate: .5 }, { slug: "gp", name: "Gold", rate: 1 }, { slug: "pp", name: "Platinum", rate: 10 }];
  character.game_systems = { ...character.game_systems!, schema_definition: schema };
  const slots = [4, 3, 2, 0, 0, 0, 0, 0, 0];
  const classData = classDataSchema.parse({
    description: "Original loaded class profile for a local visual review.", hit_die: kind === "martial" ? 10 : 6,
    spellcasting: kind === "martial" ? null : { type: "full", ability: "intelligence", focus: "Arcane focus", ritual_casting: true },
    multiclass: { prerequisites: [], proficiencies_gained: [] }, saving_throws: kind === "martial" ? ["strength", "constitution"] : ["intelligence", "wisdom"], starting_proficiencies: [],
    levels: Array.from({ length: 20 }, (_, index) => ({ level: index + 1, features: [], spellcasting: kind === "martial" ? null : { cantrips_known: 3, spell_slots: slots } })),
    attacks: Array(20).fill(kind === "martial" ? 2 : 1), improvements: Array(20).fill(false), source_refs: [],
    ...(kind === "caster" ? { spellcastingKnown: { cantrips: Array(20).fill(3), spells: "all", prepared: true } } : {}),
  });
  const refs: ContentRefWithContent[] = source.contentRefs.map(row => ({ ...row, character_id: id, context: {}, content_definitions: { ...row.content_definitions } }));
  const classId = kind === "martial" ? "22222222-2222-4222-8222-222222222210" : "22222222-2222-4222-8222-222222222211";
  refs.push({ id: "71111111-1111-4111-8111-111111111119", character_id: id, content_id: classId, content_version: 1, choice_source: null, context: {}, created_at: "2026-10-23T10:00:00Z", content_definitions: { id: classId, version: 1, slug: classSlug, name: kind === "martial" ? "Fighter" : "Wizard", content_type: "class", system_id: character.system_id, source: "homebrew", data: classData, effects: [] } });
  // One original resource uses the existing dev resource computation.
  const feature = refs[0];
  feature.content_definitions.data = featureDataSchema.parse({ ...feature.content_definitions.data, usages: 3, recovery: "long rest" });
  const inventory = source.inventory.map(item => ({ ...item, character_id: id, content_type: item.content_type === "equipment" ? "item" : item.content_type, notes: "", custom_data: item.custom_data ? { weight: 5, description: "A sturdy rope marked at regular intervals." } : null }));
  const spells = source.spells.map(spell => ({ ...spell, character_id: id, content_definitions: { ...spell.content_definitions!, slug: "guiding-lantern", data: spellDataSchema.parse({ ...spell.content_definitions!.data, ritual: false, classes: ["wizard"] }) } }));
  const state = { current_hp: source.state.current_hp, temp_hp: 4, inspiration: false, conditions: [], exhaustion: 0, death_saves: { successes: 0, failures: 0 }, hit_dice_spent: { [classSlug]: 2 }, currency: source.currency, feature_uses: {}, spell_slots_used: kind === "caster" ? { "1": 1 } : {}, quick_notes: "Meet at the north bridge before sunset.", notes: "The old milestones point toward Bellmere. Ask the innkeeper about the missing lantern.", active_effects: [], concentrating_on: null, seen_sheet_first_time: true };
  const saved = readStored(id) ?? { character, state, inventory, spells, rolls: [], timeline: [], relationships: [] } as StoredCharacter;
  persist(id, saved);
  const structuredSources = { level: 5, raceData: { speed: 30 }, classData: { attacks: classData.attacks, improvements: classData.improvements } };
  return { character: { ...saved.character, state: saved.state }, schema, contentRefs: refs, initialState: saved.state, maxHp: source.maxHp,
    initialInventory: saved.inventory, initialSpells: saved.spells, initialRolls: saved.rolls,
    classData: { [classSlug]: { slug: classSlug, data: classData } },
    allEffects: source.evalResult.grants,
    baseStatsWithLevel: { ...source.character.base_stats, level: 5 },
    structuredSources, isOwner: true, isDm: false, hasSheet: true,
    evalResult: evaluate({ ...source.character.base_stats, level: 5 }, source.evalResult.grants, schema, structuredSources, saved.state),
    campaignPageBacklinks: [], timelineEvents: saved.timeline, relationships: saved.relationships };
}

installBoundary();
window.sheetReview.currentId = new URLSearchParams(location.search).get("character") === "caster" ? ids.caster : ids.martial;
function App() {
  const longAdmin = new URLSearchParams(location.search).get("navigation") === "long-admin";
  const reviewer = { displayName: longAdmin ? "Alexandria Amberweather of the Seven Lanterns" : "Local reviewer", avatarUrl: null, email: "review@example.invalid", isAdmin: longAdmin };
  const [kind, setKind] = useState<"martial" | "caster">(() => new URLSearchParams(location.search).get("character") === "caster" ? "caster" : "martial");
  const [revision, setRevision] = useState(0);
  const [props, setProps] = useState(() => fixture(kind));
  const switchCharacter = (next: "martial" | "caster") => {
    window.sheetReview.currentId = ids[next];
    setKind(next); history.replaceState({}, "", `/?character=${next}`); setProps(fixture(next));
  };
  return <ThemeProvider><CharacterRouteFrame>
    <aside aria-label="Local review controls" className="border-b border-border bg-card px-4 py-2 text-sm flex flex-wrap items-center gap-3">
      <strong>Local character review</strong><span>Fictional characters. Changes stay in this browser.</span>
      <label className="ml-auto">Character <select aria-label="Review character" value={kind} onChange={event => switchCharacter(event.target.value as "martial" | "caster")} className="ml-2 border border-border bg-background text-foreground px-2 py-1 rounded"><option value="martial">Mara Stonepath · Fighter</option><option value="caster">Iven Lanternkeeper · Wizard</option></select></label>
      <button type="button" className="underline" onClick={() => { localStorage.removeItem(REVIEW_STORAGE_PREFIX + ids[kind]); setProps(fixture(kind)); setRevision(value => value + 1); }}>Reset review character</button>
    </aside>
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"><FeedbackProvider><div className="container mx-auto flex h-14 items-center justify-between px-4"><AppNav {...reviewer}/><MobileNav {...reviewer}/></div></FeedbackProvider></header>
    <main className="flex-1 container mx-auto px-4 py-6"><CharacterPageClient key={revision} {...props}/></main>
  </CharacterRouteFrame></ThemeProvider>;
}
createRoot(document.getElementById("root")!).render(<App/>);
