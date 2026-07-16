"use client";

import { useRef, useState, useCallback, useMemo } from "react";
import type { CharacterWithSystem, CharacterState } from "@/lib/types/character";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { EvaluationResult } from "@/lib/engine/evaluator";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import type { HitDicePool } from "@/lib/hit-dice/helpers";
import { AbilityCard } from "@/components/sheet/ability-card";
import { CombatStats } from "@/components/sheet/combat-stats";
import { HPTracker, type HPConcentrationProps } from "@/components/sheet/hp-tracker";
import { RestButton } from "@/components/sheet/rest-button";
import { SavingThrows } from "@/components/sheet/saving-throws";
import { PassiveSenses } from "@/components/sheet/passive-senses";
import { Defenses } from "@/components/sheet/defenses";
import { ResourcesWidget } from "@/components/sheet/resources-widget";
import { ActiveEffectsWidget } from "@/components/sheet/active-effects-widget";
import { Conditions } from "@/components/sheet/conditions";
import { DeathSaves } from "@/components/sheet/death-saves";
import { QuickNotes } from "@/components/sheet/quick-notes";
import { Proficiencies } from "@/components/sheet/proficiencies";
import { ActivationToggles } from "@/components/sheet/activation-toggles";
import { SkillsList } from "@/components/sheet/skills-list";
import { ContentTabs } from "@/components/sheet/content-tabs";

const TABS = [
  { id: "stats", label: "Stats" },
  { id: "skills", label: "Skills" },
  { id: "actions", label: "Actions" },
  { id: "spells", label: "Spells" },
  { id: "inventory", label: "Inventory" },
  { id: "features", label: "Features" },
  { id: "notes", label: "Notes" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ContentTabs only supports these IDs — used for the right-column tabs
type ContentTabId = "actions" | "spells" | "inventory" | "features" | "notes";

interface MobileSheetProps {
  character: CharacterWithSystem;
  schema: SystemSchemaDefinition;
  evalResult: EvaluationResult;
  contentRefs: ContentRefWithContent[];
  state: CharacterState;
  patchState: (patch: Partial<CharacterState>) => Promise<void>;
  maxHp: number;
  /** Read-only hit-dice pools threaded into the HP tracker popover. */
  hitDicePools?: HitDicePool[];
  /** Concentration wiring threaded into the HP tracker damage path (T7). */
  concentration?: HPConcentrationProps;
}

export function MobileSheet({
  character,
  schema,
  evalResult,
  contentRefs,
  state,
  patchState,
  maxHp,
  hitDicePools,
  concentration,
}: MobileSheetProps) {
  const [activeTab, setActiveTab] = useState<TabId>("stats");
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const sectionWidth = container.clientWidth;
    const scrollLeft = container.scrollLeft;
    const index = Math.round(scrollLeft / sectionWidth);
    const tab = TABS[index];
    if (tab && tab.id !== activeTab) {
      setActiveTab(tab.id);
    }
  }, [activeTab]);

  const scrollToTab = useCallback((tabId: TabId) => {
    const container = scrollRef.current;
    if (!container) return;
    const index = TABS.findIndex((t) => t.id === tabId);
    if (index === -1) return;
    container.scrollTo({ left: index * container.clientWidth, behavior: "smooth" });
    setActiveTab(tabId);
  }, []);

  // Derive activation toggles from character class choices
  const availableToggles = useMemo(() => {
    const toggles: Array<{ key: string; label: string; active: boolean }> = [];
    const hasBarbarian = character.choices?.classes?.some(
      (c: { slug: string }) => c.slug === "barbarian",
    );
    if (hasBarbarian) {
      toggles.push({
        key: "rage_active",
        label: "Rage",
        active: (state.rage_active as boolean) ?? false,
      });
    }
    return toggles;
  }, [character.choices, state]);

  const { stats, computed } = evalResult;
  const proficiencyBonus = computed.proficiency_bonus ?? 2;
  const armorClass = computed.armor_class ?? computed.ac ?? 10;
  const initiative =
    computed.initiative ?? Math.floor(((stats.dexterity ?? 10) - 10) / 2);
  const speed = computed.speed ?? computed.movement_speed ?? 30;

  return (
    <div className="flex flex-col flex-1 md:hidden">
      {/* Fixed tab bar */}
      <nav className="sticky top-0 z-10 bg-background border-b border-border overflow-x-auto">
        <div className="flex whitespace-nowrap">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => scrollToTab(tab.id)}
              className={`px-4 py-2 text-sm shrink-0 transition-colors ${
                activeTab === tab.id
                  ? "text-character-fg border-b-2 border-character-fg font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Scroll-snap section container */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto snap-x snap-mandatory flex-1"
        onScroll={handleScroll}
        style={{ scrollbarWidth: "none" }}
      >
        {/* Stats section */}
        <section className="snap-start w-full shrink-0 min-h-screen p-4 space-y-4">
          {/* Ability scores 3x2 grid */}
          <div className="rounded-lg border border-border bg-card p-3">
            <h3 className="text-accent font-semibold text-sm uppercase tracking-wide mb-2">
              Ability Scores
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {schema.ability_scores.map((ability) => {
                const score = stats[ability.slug] ?? 10;
                const modifier = Math.floor((score - 10) / 2);
                return (
                  <AbilityCard
                    key={ability.slug}
                    name={ability.abbr}
                    score={score}
                    modifier={modifier}
                    rollLabel={ability.name}
                  />
                );
              })}
            </div>
          </div>

          {/* Combat stats */}
          <div className="rounded-lg border border-border bg-card p-3">
            <h3 className="text-accent font-semibold text-sm uppercase tracking-wide mb-2">
              Combat
            </h3>
            <CombatStats
              proficiencyBonus={proficiencyBonus}
              armorClass={armorClass}
              initiative={initiative}
              speed={speed}
              speedDetail={evalResult.speed}
              rollable
            />
          </div>

          {/* HP Tracker */}
          <div className="rounded-lg border border-border bg-card p-3">
            <h3 className="text-accent font-semibold text-sm uppercase tracking-wide mb-2">
              Hit Points
            </h3>
            <div className="space-y-3">
              <HPTracker
                currentHp={state.current_hp ?? maxHp}
                maxHp={maxHp}
                tempHp={state.temp_hp ?? 0}
                patchState={patchState}
                hitDicePools={hitDicePools}
                concentration={concentration}
              />
              {/* Death saves — returns null when HP > 0, so this slot stays hidden
                  during normal play. */}
              <DeathSaves
                currentHp={state.current_hp ?? maxHp}
                deathSaves={state.death_saves ?? { successes: 0, failures: 0 }}
                patchState={patchState}
              />
              <div className="pt-2 border-t border-border">
                <RestButton />
              </div>
            </div>
          </div>

          {/* Saving throws */}
          <SavingThrows schema={schema} evalResult={evalResult} />

          {/* Passive senses */}
          <PassiveSenses schema={schema} evalResult={evalResult} />

          {/* Defenses */}
          <Defenses evalResult={evalResult} />

          {/* Feature Resources */}
          <ResourcesWidget />

          {/* Active effects (runtime buffs with durations) */}
          <ActiveEffectsWidget />

          {/* Activation toggles (e.g. Rage) */}
          <ActivationToggles
            toggles={availableToggles}
            onToggle={(key, active) => patchState({ [key]: active })}
          />

          {/* Conditions */}
          <Conditions
            conditions={state.conditions ?? []}
            exhaustion={(state.exhaustion as number | undefined) ?? 0}
            patchState={patchState}
          />

          {/* Quick notes */}
          <QuickNotes state={state} patchState={patchState} />

          {/* Proficiencies */}
          <Proficiencies grants={evalResult.grants} contentRefs={contentRefs} />
        </section>

        {/* Skills section */}
        <section className="snap-start w-full shrink-0 min-h-screen p-4">
          <SkillsList schema={schema} evalResult={evalResult} />
        </section>

        {/* Actions / Spells / Inventory / Features / Notes sections */}
        {(["actions", "spells", "inventory", "features", "notes"] as ContentTabId[]).map(
          (tabId) => (
            <section key={tabId} className="snap-start w-full shrink-0 min-h-screen p-4">
              <div className="rounded-lg border border-border bg-card overflow-hidden h-full">
                <ContentTabs
                  character={character}
                  schema={schema}
                  evalResult={evalResult}
                  contentRefs={contentRefs}
                  state={state}
                  patchState={patchState}
                  initialTab={tabId}
                />
              </div>
            </section>
          ),
        )}
      </div>
    </div>
  );
}
