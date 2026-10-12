import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { RaceStepClient } from "@/app/(app)/characters/[id]/builder/race/race-step-client";
import { AbilitiesStepClient } from "@/app/(app)/characters/[id]/builder/abilities/abilities-step-client";
import { ClassStepClient } from "@/app/(app)/characters/[id]/builder/class/class-step-client";
import { StatPreview } from "@/components/builder/stat-preview";
import { RaceAbilityNotice } from "@/components/builder/race-ability-notice";
import { transformRaceEntry } from "@/scripts/transformers/races";
import { parseContentDefinition, parseContentVersionSnapshot, type ParsedContentDefinition } from "@/lib/supabase/content-definitions-parser";
import { systemSchemaDefinitionSchema } from "@/lib/schemas/system";
import { evaluate } from "@/lib/engine/evaluator";
import { buildCharacterStructuredSources } from "@/lib/character/structured-sources";
import type { Effect } from "@/lib/types/effects";
import type { CharacterChoices } from "@/lib/types/character";

export const scenarios = ["imported", "legacy", "scores-only", "manual", "conditional-inactive", "conditional-active", "formula", "zero", "asi", "raw-subrace"] as const;
type Scenario = typeof scenarios[number];
type View = "Race" | "Abilities" | "Class" | "Sheet notice";
const base = { strength: 10, dexterity: 10, constitution: 12, intelligence: 10, wisdom: 10, charisma: 10,
  level: 3, hit_die_total: 18, spellcasting_ability: 10 };
const api = { index: "r06-synthetic-lantern-kin", name: "Synthetic Lantern Kin", speed: 35,
  ability_bonuses: [{ ability_score: { index: "str", name: "STR" }, bonus: 2 }, { ability_score: { index: "con", name: "CON" }, bonus: 2 }],
  size: "Medium", size_description: "Original synthetic size notes.", age: "Original synthetic age notes.",
  alignment: "Original synthetic alignment notes.", language_desc: "Original synthetic language notes.",
  languages: [], traits: [], subraces: [], starting_proficiencies: [],
};
const envelope = { id: "11111111-1111-4111-8111-111111111111", system_id: "22222222-2222-4222-8222-222222222222",
  content_type: "race", slug: api.index, name: api.name, version: 1, source: "srd", scope: "platform", owner_id: null };
// Explicit frozen pre-repair output, not regenerated from the new transformer.
const legacyData = { size: "Medium", speed: 35, speed_detail: { walk: 35 }, scores: [2, 0, 2, 0, 0, 0],
  age_description: api.age, alignment_description: api.alignment, size_description: api.size_description,
  language_description: api.language_desc, traits: [], subraces: [], languages: [], weaponProfs: [], armorProfs: [], toolProfs: [] };
const legacyEffects: Effect[] = [{ type: "mechanical", stat: "strength", op: "add", value: 2 },
  { type: "mechanical", stat: "constitution", op: "add", value: 2 },
  { type: "mechanical", stat: "movement_speed", op: "set", value: 35 }, { type: "mechanical", stat: "size", op: "set", value: "Medium" }];
function actualPin(raw: typeof envelope & { data: Record<string, unknown>; effects: Effect[] }) {
  const definition = parseContentDefinition(raw);
  const snapshot = { content_id: raw.id, version: raw.version, system_id_snapshot: raw.system_id, content_type_snapshot: raw.content_type,
    slug_snapshot: raw.slug, name_snapshot: raw.name, data_snapshot: raw.data, effects_snapshot: raw.effects,
    source_snapshot: raw.source, scope_snapshot: raw.scope, owner_id_snapshot: raw.owner_id };
  const pin = parseContentVersionSnapshot(snapshot);
  if (!definition || !pin) throw Error("Actual canonical definition/snapshot parser rejected the original synthetic fixture.");
  return { pin, snapshot };
}
function ref(pin: ParsedContentDefinition, suffix = "1") {
  return { id: `offline-ref-${suffix}`, content_id: pin.id, content_version: pin.version, context: { source: pin.content_type }, choice_source: null, content_definitions: pin };
}
function classEntry(slug: string, id: string) {
  const entry = parseContentDefinition({ ...envelope, id, slug, name: `Synthetic ${slug}`, content_type: "class", effects: [],
    data: { hit_die: 8, spellcasting: null, multiclass: { prerequisites: [], proficiencies_gained: [] }, saving_throws: [], starting_proficiencies: [],
      levels: [1, 2, 3].map(level => ({ level, features: [] })) } });
  if (!entry) throw Error("Synthetic class must pass canonical parser.");
  return entry;
}
export function scenarioModel(scenario: Scenario) {
  const imported = transformRaceEntry(api);
  let data: Record<string, unknown> = scenario === "imported" || scenario === "asi" || scenario === "raw-subrace" ? { ...imported.data } : structuredClone(legacyData);
  let effects = scenario === "imported" || scenario === "asi" || scenario === "raw-subrace" ? [...imported.effects] : structuredClone(legacyEffects);
  if (["scores-only", "manual", "conditional-inactive", "conditional-active", "formula"].includes(scenario)) {
    effects = effects.filter(effect => !(effect.type === "mechanical" && ["strength", "constitution"].includes(effect.stat)));
  }
  if (["manual", "conditional-inactive", "conditional-active", "formula"].includes(scenario)) data.ability_score_representation = { version: 1, mode: "scores" };
  if (scenario === "manual") effects.push({ type: "mechanical", stat: "strength", op: "add", value: 2 });
  if (scenario.startsWith("conditional-")) effects.push({ type: "mechanical", stat: "strength", op: "add", value: 2, condition: { field: "rage_active", op: "eq", value: true } });
  if (scenario === "formula") effects.push({ type: "mechanical", stat: "strength", op: "formula", expr: "strength + 2" });
  if (scenario === "zero") data = { ...data, scores: [0, 0, 0, 0, 0, 0] };
  const parsed = actualPin({ ...envelope, data, effects });
  const refs = [ref(parsed.pin)];
  let canonicalSubraceScoresMissing: boolean | null = null;
  if (scenario === "raw-subrace") {
    const child = actualPin({ ...envelope, id: "77777777-7777-4777-8777-777777777777", content_type: "subrace",
      slug: "synthetic-score-child", name: "Synthetic Score Child", data: { parent_race: parsed.pin.slug, scores: [0, 0, 0, 0, 0, 2] }, effects: [] });
    canonicalSubraceScoresMissing = child.pin.data.scores === undefined;
    // Explicit raw-only component compatibility projection; not a canonical pin.
    refs.push(ref({ ...child.pin, data: { ...child.pin.data, scores: [0, 0, 0, 0, 0, 2] } }, "2"));
  }
  const choices: CharacterChoices = { race: parsed.pin.slug, ability_method: "manual" };
  if (scenario === "asi") choices.asi_choices = { "synthetic-asi": { mode: "asi", allocations: [{ ability: "strength", amount: 2 }] } };
  const state = { rage_active: scenario === "conditional-active" };
  return { ...parsed, refs, choices, state, canonicalSubraceScoresMissing,
    pinBaseline: JSON.stringify(parsed.pin), snapshotBaseline: JSON.stringify(parsed.snapshot) };
}

declare global {
  interface Window {
    raceParitySchema: unknown;
    fixture: { writes: unknown[]; navigation: string[]; model?: ReturnType<typeof scenarioModel>; proof?: Record<string, unknown>; pinBaseline?: string; snapshotBaseline?: string };
  }
}
window.fixture = { writes: [], navigation: [] };
const schema = systemSchemaDefinitionSchema.parse(window.raceParitySchema);
const fighter = classEntry("fighter", "55555555-5555-4555-8555-555555555555");
const barbarian = classEntry("barbarian", "66666666-6666-4666-8666-666666666666");
function App() {
  const [scenario, setScenario] = useState<Scenario>("imported");
  const [view, setView] = useState<View>("Race");
  const model = useMemo(() => scenarioModel(scenario), [scenario]);
  const sources = buildCharacterStructuredSources(model.refs, 3);
  const live = evaluate(base, model.refs.flatMap(item => item.content_definitions.effects), schema, sources, model.state);
  const character = { id: "offline-character", name: "Synthetic Character", level: 3, base_stats: base, choices: model.choices, state: model.state };
  const { strength, constitution, charisma } = live.stats;
  // Synchronize only the external test observer after the real clients commit.
  useEffect(() => {
    window.fixture.model = model;
    window.fixture.pinBaseline = model.pinBaseline;
    window.fixture.snapshotBaseline = model.snapshotBaseline;
    window.fixture.proof = { scenario, view, strength, constitution, charisma,
      canonicalPin: true, version: model.pin.version, snapshotUnchanged: JSON.stringify(model.snapshot) === model.snapshotBaseline,
      metadataScores: model.pin.data.scores, declaration: model.pin.data.ability_score_representation,
      canonicalSubraceScoresMissing: model.canonicalSubraceScoresMissing, rawSubraceProjection: scenario === "raw-subrace" };
  }, [model, scenario, view, strength, constitution, charisma]);
  return <main className="mx-auto w-full max-w-[1440px] p-4 space-y-4">
    <h1 className="j-display text-2xl">Offline race calculation acceptance</h1>
    <p>Original synthetic pins and real builder components. Navigation, ability drafts and persistence are stubbed; writes are prohibited.</p>
    <div className="grid gap-3 sm:grid-cols-2"><label>Fixture scenario<select className="block w-full border rounded bg-background p-2" value={scenario} onChange={event => setScenario(event.target.value as Scenario)}>
      {scenarios.map(name => <option key={name}>{name}</option>)}</select></label>
      <label>Fixture view<select className="block w-full border rounded bg-background p-2" value={view} onChange={event => setView(event.target.value as View)}>
        {["Race", "Abilities", "Class", "Sheet notice"].map(name => <option key={name}>{name}</option>)}</select></label></div>
    <p data-testid="live-reference">Parsed-pin live reference: STR {live.stats.strength}, CON {live.stats.constitution}, CHA {live.stats.charisma}.</p>
    {scenario === "raw-subrace" && <p data-testid="raw-disclosure">Raw-only subrace component compatibility; actual canonical parsing omits its scores. This is not hosted data or a new live scoring mode.</p>}
    <section aria-label={`Actual ${view}`} key={`${scenario}:${view}`} className="min-w-0">
      {view === "Race" && <RaceStepClient characterId={character.id} character={character} races={[model.pin]} subraces={[]} traits={[]} contentRefs={model.refs} schema={schema} />}
      {view === "Abilities" && <AbilitiesStepClient ownerId="offline-owner" characterId={character.id} character={character} contentRefs={model.refs} schema={schema} />}
      {view === "Class" && <ClassStepClient characterId={character.id} character={{ ...character, choices: { ...model.choices, classes: [{ slug: "fighter", level: 3 }] } }}
        classes={[fighter, barbarian]} subclasses={[]} features={[]} feats={[]} spells={[]}
        contentRefs={[...model.refs, ref(fighter, "3")]} schema={schema} />}
      {view === "Sheet notice" && <><h2 className="text-xl">Shared sheet notice component</h2><RaceAbilityNotice contentRefs={model.refs} />
        <StatPreview baseStats={base} effects={model.refs.flatMap(item => item.content_definitions.effects)} schema={schema} level={3} sources={sources} state={model.state} /></>}
    </section>
  </main>;
}
createRoot(document.getElementById("root")!).render(<App />);
