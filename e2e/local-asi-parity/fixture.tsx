import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { AbilitiesStepClient } from "@/app/(app)/characters/[id]/builder/abilities/abilities-step-client";
import { ClassStepClient } from "@/app/(app)/characters/[id]/builder/class/class-step-client";
import { RaceStepClient } from "@/app/(app)/characters/[id]/builder/race/race-step-client";
import { BackgroundStepClient } from "@/app/(app)/characters/[id]/builder/background/background-step-client";
import { StatPreview } from "@/components/builder/stat-preview";
import { SheetPanel } from "@/components/character/sheet-panel";
import { CharacterProvider, useCharacter, useCharacterState, useRest, useRolls } from "@/lib/character/character-context";
import { buildCharacterStructuredSources } from "@/lib/character/structured-sources";
import { evaluate } from "@/lib/engine/evaluator";
import { computeMaxHp } from "@/lib/character/max-hp";
import { resolveCharacterAsiContributions } from "@/lib/character/asi-contributions";
import type { AsiEvidence } from "@/lib/character/asi-contributions";
import type { CharacterSpell } from "@/lib/types/spells";
import { parseContentVersionSnapshot } from "@/lib/supabase/content-definitions-parser";
import { originalAsiFixture, originalAsiPin, originalSubclassData, asiId, asiSchema } from "./canonical-fixtures";
import { syntheticRacePin } from "./race-fixtures";

export const scenarioNames = ["builder-strength", "con-baseline", "con-temporary", "denial-unearned", "denial-foreign", "denial-missing", "denial-duplicate", "denial-raw-metadata", "cap-warning", "background-state", "background-reject", "weapon-crit", "cast-prep", "rest-hitdie", "retained-cast", "retained-crit", "retained-print", "retained-rest", "ability-draft", "independent-actions", "feat-choice", "legacy-dual"] as const;
type Scenario = typeof scenarioNames[number];
const requested = new URLSearchParams(location.search).get("case");
if (!scenarioNames.includes(requested as Scenario)) throw Error("Unknown finite ASI scenario");
const scenario = requested as Scenario;
type Model = ReturnType<typeof originalAsiFixture> & { spells: CharacterSpell[]; candidateBackground: ReturnType<typeof originalAsiPin> };
type Journal = { rngAttempts: unknown[]; rollResults: unknown[]; persistedRolls: unknown[]; stateWrites: Array<{ characterId: string; patch: Record<string, unknown>; expected: unknown }>; spellWrites: unknown[]; printCalls: unknown[];
  probeResults: Array<{ action: string; outcome: "returned" | "refused" | "threw"; value?: unknown; error?: string }> };
interface Harness {
  scenario: Scenario; calls: Array<{ name: string; args: unknown }>; navigation: unknown[]; unexpectedCalls: unknown[]; journal: Journal;
  snapshot?: Record<string, unknown>; projection?: unknown; initialProjection?: unknown; abilitySaved?: unknown;
  releaseAbility?: () => void; rejectAbility?: () => void; rejectBackground?: () => void;
}
declare global { interface Window { asiHarness: Harness } }
window.asiHarness = { scenario, calls: [], navigation: [], unexpectedCalls: [], journal: { rngAttempts: [], rollResults: [], persistedRolls: [], stateWrites: [], spellWrites: [], printCalls: [], probeResults: [] } };
// Print is an explicit invocation boundary; the actual captured guard runs before it.
window.print = () => { window.asiHarness.journal.printCalls.push({ at: new Date().toISOString(), simulatedPrintInvocation: true }); };

function canonicalModel(): Model {
  const isCon = ["con-temporary", "rest-hitdie"].includes(scenario);
  const isCasting = ["cast-prep", "retained-cast"].includes(scenario);
  const f = originalAsiFixture({ mode: "asi", allocations: [{ ability: isCon ? "constitution" : isCasting ? "intelligence" : "strength", amount: 2 }] });
  if (isCasting) {
    const oldSlug = f.cls.slug;
    const cls = originalAsiPin("class", "warden", { ...f.cls.data, description: "Original bounded ASI casting parent." }, f.cls.id);
    const feature = originalAsiPin("feature", f.feature.slug, { ...f.feature.data, class: cls.slug }, f.feature.id);
    f.cls = cls; f.feature = feature; f.refs[0].content_definitions = cls; f.refs[1].content_definitions = feature;
    f.grant.controller_slug = cls.slug; f.refs[1].context.controller_slug = cls.slug;
    f.character.choices.classes![0] = { slug: cls.slug, level: 4, subclass: "lumen-adept" };
    f.character.choices.hp_rolls = Object.fromEntries(Object.entries(f.character.choices.hp_rolls!).map(([key, value]) => [key.replace(oldSlug, cls.slug), value]));
    f.character.state.hit_dice_spent = { [cls.slug]: 0 };
    f.character.base_stats.intelligence = 12;
    const sub = originalAsiPin("subclass", "lumen-adept", originalSubclassData(true), asiId(70));
    f.refs.push(f.ref(sub, asiId(71)));
  }
  if (scenario === "feat-choice") {
    const feat = originalAsiPin("feat", "original-asi-clear-mind", { description: "Original exact chosen feat control." }, asiId(93), [{ type: "mechanical", stat: "wisdom", op: "add", value: 2 }]);
    f.character.choices.asi_choices![f.feature.slug] = { mode: "feat", featId: feat.id, featVersion: feat.version, featName: feat.name };
    f.refs.push(f.ref(feat, asiId(94), null, `choice:asi:${f.grant.id}`));
  }
  if (scenario === "legacy-dual") {
    const legacy = { ...syntheticRacePin("dual").pin, system_id: f.character.system_id };
    f.race = legacy; f.refs[2].content_definitions = legacy; f.refs[2].content_id = legacy.id; f.refs[2].content_version = legacy.version;
    f.character.choices.race = legacy.slug;
  }
  const weapon = originalAsiPin("weapon", "original-asi-mallet", { weapon_category: "Simple", weapon_range: "Melee", damage: { dice: "1d6", type: "bludgeoning" }, range: { normal: 5 }, properties: [] }, asiId(80));
  f.refs.push(f.ref(weapon, asiId(81)));
  const background = originalAsiPin("background", "original-watch", { feature: { name: "Original watch", description: "An original synthetic conditional watch." } }, asiId(82), [
    { type: "mechanical", stat: "strength", op: "add", value: 3, condition: { field: "original_boon", op: "eq", value: true } },
  ]);
  if (scenario.startsWith("background")) { f.refs.push(f.ref(background, asiId(83))); f.character.choices.background = background.slug; f.character.state.original_boon = true; }
  if (scenario === "con-temporary") f.character.state.active_effects = [{ id: asiId(84), name: "Original temporary CON", slug: "original-con", source: "custom", content_id: null,
    effects: [{ type: "mechanical", stat: "constitution", op: "add", value: 2 }], duration: { type: "special" }, concentration: false, applied_at: "2026-10-12T16:00:00.000Z", expires_at: null }];
  if (scenario === "cap-warning") f.character.base_stats.strength = 20;
  if (scenario === "rest-hitdie" || scenario === "retained-rest") f.character.state = { ...f.character.state, current_hp: 1, temp_hp: 3, exhaustion: 2,
    hit_dice_spent: { [f.cls.slug]: 1 }, spell_slots_used: { "1": 1 }, death_saves: { successes: 1, failures: 1 } };
  const spells: CharacterSpell[] = [];
  if (isCasting) {
    const spell = originalAsiPin("spell", "original-prism", { level: 1, school: "illusion", casting_time: "1 action", range: "30 feet", components: ["V"],
      description: "Original rights-safe ASI casting control.", duration: "1 minute", concentration: false, ritual: false, attack_type: "ranged",
      damage: { type: "radiant", dice_at_slot_level: { "1": "1d8 + MOD", "2": "2d8 + MOD" } }, classes: ["original-scholar"] }, asiId(86));
    spells.push({ id: asiId(87), character_id: f.character.id, content_id: spell.id, content_version: spell.version, class_slug: f.cls.slug, name: spell.name,
      is_known: true, is_prepared: true, always_prepared: false, in_spellbook: false, source: "selection", custom_data: null, created_at: f.character.created_at, content_definitions: spell });
  }
  return { ...f, spells, candidateBackground: originalAsiPin("background", "original-courier", { feature: { name: "Original courier", description: "Original replacement candidate." } }, asiId(88)) };
}
function projection(f: Model, presented?: AsiEvidence) {
  const rows = f.refs.map(ref => {
    const pin = ref.content_definitions;
    const content_versions = { content_id: pin.id, version: pin.version, system_id_snapshot: pin.system_id, content_type_snapshot: pin.content_type,
      slug_snapshot: pin.slug, name_snapshot: pin.name, data_snapshot: pin.data, effects_snapshot: pin.effects, source_snapshot: pin.source,
      scope_snapshot: pin.scope, owner_id_snapshot: pin.owner_id, created_at: ref.created_at };
    const parsed = parseContentVersionSnapshot(content_versions);
    if (!parsed || parsed.id !== ref.content_id || parsed.version !== ref.content_version) throw Error("Original canonical browser pin failed actual immutable parser");
    return { ...ref, content_definitions: parsed, content_versions };
  });
  return { characterSnapshot: { id: f.character.id, system_id: f.character.system_id, base_stats: structuredClone(f.character.base_stats), choices: structuredClone(f.character.choices), state: structuredClone(f.character.state) }, characterId: f.character.id, systemId: f.character.system_id, rawRefs: rows, refCount: rows.length, rawGrants: presented?.status === "unavailable" ? null : structuredClone(presented?.grants ?? f.evidence.grants), grantCount: presented?.status === "unavailable" ? null : (presented?.grants ?? f.evidence.grants).length,
    boundary: "Modeled read/count DTO (explicit unavailable grants when read fails); no PostgREST/Auth/RLS proof" };
}
function denied(f: Model): AsiEvidence {
  if (scenario === "denial-missing" || scenario === "independent-actions") return { status: "unavailable", reason: "incomplete_evidence" };
  const grants = structuredClone(f.evidence.grants);
  if (scenario === "denial-unearned") grants[0].unlock_level = 5;
  if (scenario === "denial-foreign") grants[0].character_id = asiId(99);
  if (scenario === "denial-duplicate") grants.push({ ...grants[0], id: asiId(99) });
  if (scenario === "denial-raw-metadata") f.refs[1].context = { ...f.refs[1].context, browser_authority: true };
  return { ...f.evidence, refs: f.refs, grants };
}
function Probe() {
  const ctx = useCharacter(), state = useCharacterState(), rest = useRest(), rolls = useRolls();
  const retained = useRef<typeof rest.longRest | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { window.asiHarness.snapshot = { stats: ctx.evalResult.stats, computed: ctx.evalResult.computed, mechanics: ctx.mechanics, maxHp: ctx.maxHp, state: state.state,
    source: "Actual mounted CharacterProvider result; persistence simulated" }; });
  const attempt = async (action: string, fn: () => unknown) => {
    try {
      const value = await fn();
      // Preserve the actual callback result. A false ordinary refusal is not
      // success or a manufactured exception/alert in this fixture.
      window.asiHarness.journal.probeResults.push({ action, outcome: value === false ? "refused" : "returned", value: structuredClone(value) });
      setError(null);
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : "Unconfirmed action refused";
      window.asiHarness.journal.probeResults.push({ action, outcome: "threw", error });
      setError(error);
    }
  };
  return <aside className="space-y-2 border p-3" aria-label="Fixture controls">
    <p>Fixture probes call the actual provider callbacks; they are not new product actions.</p>
    <div className="flex flex-wrap gap-2">
      <button onClick={() => { retained.current = rest.longRest; }}>Capture long-rest callback</button>
      <button onClick={() => void attempt("Invoke retained long rest", () => { if (!retained.current) throw Error("Capture callback first"); return retained.current(); })}>Invoke retained long rest</button>
      <button onClick={() => void attempt("Dependent relative HP probe", () => state.patchActionState({ current_hp: 2 }))}>Dependent relative HP probe</button>
      <button onClick={() => void attempt("Dependent roll probe", () => rolls.roll({ kind: "check", label: "Original dependent probe", expression: "1d20+2" }, { abilities: ["strength"] }))}>Dependent roll probe</button>
      <button onClick={() => void attempt("Dependent whole-rest probe", () => rest.longRest())}>Dependent whole-rest probe</button>
      <button onClick={() => void attempt("Independent native die", () => rolls.roll({ kind: "custom", label: "Independent native die", expression: "1d6" }))}>Independent native die</button>
      <button onClick={() => void attempt("Independent toggle", () => state.patchConditionalState({ original_independent_toggle: true }))}>Independent toggle</button>
    </div>
    {error ? <p role="alert">{error}</p> : null}
    <output aria-label="Actual live Strength">{ctx.evalResult.stats.strength}</output>{" "}
    <output aria-label="Actual live Constitution">{ctx.evalResult.stats.constitution}</output>{" "}
    <output aria-label="Actual permanent max HP">{ctx.maxHp}</output>
  </aside>;
}
function App() {
  const [model] = useState(canonicalModel);
  const [evidence, setEvidence] = useState<AsiEvidence>(() => denied(model));
  const [view, setView] = useState("sheet");
  useEffect(() => { const change = () => setEvidence({ status: "unavailable", reason: "incomplete_evidence" });
    window.addEventListener("asi-fixture-evidence-change", change); return () => window.removeEventListener("asi-fixture-evidence-change", change); }, []);
  const [draftMounted, setDraftMounted] = useState(true);
  const allEffects = model.refs.flatMap(ref => ref.content_definitions.effects);
  const sources = buildCharacterStructuredSources(model.refs, model.character.level, { character: model.character, evidence });
  const permanent = evaluate(model.character.base_stats, allEffects, asiSchema, sources);
  const maxHp = computeMaxHp(model.character.choices.classes!, { [model.cls.slug]: { slug: model.cls.slug, data: model.cls.data } }, permanent.stats.constitution, model.character.choices.hp_rolls!, "free_choice");
  const refsWithoutRace = model.refs.filter(ref => ref.content_definitions.content_type !== "race");
  const orderedEvidence: AsiEvidence = { ...model.evidence, refs: refsWithoutRace };
  const orderedSources = buildCharacterStructuredSources(refsWithoutRace, 4, { character: model.character, evidence: orderedEvidence });
  const ordering = { staticMultiply: evaluate(model.character.base_stats, [...refsWithoutRace.flatMap(ref => ref.content_definitions.effects), { type: "mechanical", stat: "strength", op: "multiply", value: 2 }], asiSchema, orderedSources).stats.strength,
    formula: evaluate(model.character.base_stats, [...refsWithoutRace.flatMap(ref => ref.content_definitions.effects), { type: "mechanical", stat: "strength", op: "formula", expr: "strength * 2" }], asiSchema, orderedSources).stats.strength,
    independentSameAdd: evaluate(model.character.base_stats, [...allEffects, { type: "mechanical", stat: "strength", op: "add", value: 2 }], asiSchema, sources).stats.strength };
  useEffect(() => { window.asiHarness.projection = { ...projection(model, evidence), presentedEvidence: evidence, presentedGrantCount: evidence.status === "complete" ? evidence.grants.length : null }; window.asiHarness.initialProjection ??= projection(model);
    window.asiHarness.abilitySaved ??= { method: "manual", scores: model.character.base_stats }; }, [model, evidence]);
  const barbarian = originalAsiPin("class", "barbarian", model.cls.data, asiId(90));
  return <main className="mx-auto w-full max-w-7xl min-w-0 space-y-4 p-4 sm:p-6">
    <h1 className="j-display text-3xl">Offline earned ASI parity</h1>
    <p className="text-sm">Actual consumers, canonical original pins and native RNG. Auth, counts, writes, navigation and print invocation simulated. Critical accepted results are expressly modeled after native rolls. No hosted/SQL authority.</p>
    <p>Scenario: {scenario}. Existing R03 class role/save-prefix and SQL/subrace gaps remain open.</p>
    <nav aria-label="Fixture component selection" className="flex flex-wrap gap-3">{["sheet", "abilities", "class", "race", "background", "preview"].map(name => <button key={name} onClick={() => setView(name)}>View {name}</button>)}</nav>
    <button onClick={() => setEvidence({ status: "unavailable", reason: "incomplete_evidence" })}>Change only evidence</button>
    <p><output aria-label="Static multiply ordering">{ordering.staticMultiply}</output>{" "}<output aria-label="Formula ordering">{ordering.formula}</output>{" "}<output aria-label="Independent same-number add">{ordering.independentSameAdd}</output></p>
    <p data-fixture-asi-status>{resolveCharacterAsiContributions(model.character, evidence).status}</p>
    {view === "abilities" ? <><button onClick={() => setDraftMounted(value => !value)}>{draftMounted ? "Unmount ability editor" : "Remount ability editor"}</button>
      {draftMounted ? <AbilitiesStepClient ownerId={model.character.user_id} characterId={model.character.id} character={model.character} contentRefs={model.refs} asiEvidence={evidence} schema={asiSchema} /> : <p>Editor unmounted; browser-memory draft remains local.</p>}</> : null}
    {view === "class" ? <ClassStepClient characterId={model.character.id} character={model.character} classes={[model.cls, barbarian]} subclasses={[]} features={[model.feature]} feats={[]} spells={[]} contentRefs={model.refs} asiEvidence={evidence} schema={asiSchema} /> : null}
    {view === "race" ? <RaceStepClient characterId={model.character.id} character={model.character} races={[model.race]} subraces={[]} traits={[]} contentRefs={model.refs} asiEvidence={evidence} schema={asiSchema} /> : null}
    {view === "background" ? <BackgroundStepClient characterId={model.character.id} character={model.character} backgrounds={[model.candidateBackground]} contentRefs={model.refs} asiEvidence={evidence} schema={asiSchema} /> : null}
    {view === "preview" ? <StatPreview baseStats={model.character.base_stats} effects={allEffects} schema={asiSchema} level={4} sources={sources} state={model.character.state} /> : null}
    {/* Same mounted provider is retained across only-evidence changes; original raw state/pins are untouched. */}
    <div hidden={view !== "sheet"}>
      <CharacterProvider character={model.character} schema={asiSchema} contentRefs={model.refs} contentSnapshotsComplete
        initialState={model.character.state} initialInventory={[]} initialSpells={model.spells} classData={{ [model.cls.slug]: { slug: model.cls.slug, data: model.cls.data } }}
        allEffects={allEffects} baseStatsWithLevel={model.character.base_stats} structuredSources={sources} isOwner isDm={false} hasSheet maxHp={maxHp} primaryColor={null} onPrimaryColorChange={() => {}}>
        <Probe /><SheetPanel />
      </CharacterProvider>
    </div>
  </main>;
}
createRoot(document.getElementById("root")!).render(<App />);
