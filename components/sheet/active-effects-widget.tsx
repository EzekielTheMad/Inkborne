"use client";

import { useEffect, useMemo, useState } from "react";
import { Brain, Plus, Sparkle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveEffects, useSpells } from "@/lib/character/character-context";
import type { EffectDuration } from "@/lib/types/active-effects";
import {
  buildActiveEffectFromSpell,
  formatRemaining,
  isExpired,
  type SpellEffectSource,
} from "@/lib/active-effects/helpers";
import { parseSpellDuration } from "@/lib/spells/duration";

/** Curated targets for the custom-entry flat modifier. */
const CUSTOM_STAT_OPTIONS = [
  { value: "", label: "None (display only)" },
  { value: "armor_class", label: "Armor Class" },
  { value: "speed", label: "Speed" },
] as const;

const CUSTOM_DURATION_OPTIONS = [
  { value: "special", label: "Until removed" },
  { value: "rounds", label: "Rounds" },
  { value: "minutes", label: "Minutes" },
  { value: "hours", label: "Hours" },
  { value: "until_rest", label: "Until rest" },
] as const;

type CustomDurationType = (typeof CUSTOM_DURATION_OPTIONS)[number]["value"];

function buildDuration(type: CustomDurationType, value: number): EffectDuration {
  switch (type) {
    case "rounds":
      return { type: "rounds", value: Math.max(1, value) };
    case "minutes":
      return { type: "minutes", value: Math.max(1, value) };
    case "hours":
      return { type: "hours", value: Math.max(1, value) };
    case "until_rest":
      return { type: "until_rest" };
    case "special":
      return { type: "special" };
  }
}

/**
 * Left-column widget listing runtime active effects (design §6.7): remaining
 * duration, expired styling, concentration markers, one-tap removal, and the
 * "+ Add effect" escape hatch (known spells or a custom entry). Renders
 * nothing when the character has no active effects, like Resources.
 */
export function ActiveEffectsWidget() {
  const { activeEffects, applyEffect, removeEffect, addCustomEffect } =
    useActiveEffects();

  // Re-render each minute so real-time countdowns and expiry styling stay
  // honest without any state writes.
  const hasRealTime = activeEffects.some((e) => e.expires_at !== null);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!hasRealTime) return;
    const timer = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(timer);
  }, [hasRealTime]);

  const [adderOpen, setAdderOpen] = useState(false);

  if (activeEffects.length === 0) return null;

  const now = new Date();

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <h3 className="text-accent font-semibold text-sm uppercase tracking-wide">
        Active Effects
      </h3>

      <div className="space-y-1">
        {activeEffects.map((effect) => {
          const expired = isExpired(effect, now);
          const removeLabel = effect.concentration
            ? `Remove ${effect.name} (ends concentration)`
            : `Remove ${effect.name}`;
          return (
            <div
              key={effect.id}
              className={cn(
                "flex items-center gap-1.5 text-xs rounded-md border border-border/60 bg-background/40 px-2 py-1",
                expired && "opacity-50",
              )}
            >
              <Sparkle className="size-3 text-character-fg shrink-0" />
              <span className="font-medium truncate">{effect.name}</span>
              {effect.concentration && (
                <Brain
                  className="size-3 text-purple-400 shrink-0"
                  aria-label="Concentration"
                />
              )}
              <span className="ml-auto text-muted-foreground whitespace-nowrap tabular-nums">
                {formatRemaining(effect, now)}
              </span>
              {expired && (
                <span className="text-[9px] uppercase tracking-wide rounded bg-muted px-1 py-0.5 text-muted-foreground">
                  expired
                </span>
              )}
              <button
                type="button"
                onClick={() => void removeEffect(effect.id)}
                aria-label={removeLabel}
                title={removeLabel}
                className="size-4 inline-flex items-center justify-center rounded text-muted-foreground hover:text-destructive shrink-0"
              >
                <X className="size-3" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setAdderOpen((v) => !v)}
          className="text-xs px-2 py-1 rounded-md border border-dashed border-muted-foreground/40 text-muted-foreground hover:text-foreground hover:border-muted-foreground flex items-center gap-1"
        >
          <Plus className="size-3" />
          Add effect
        </button>

        {adderOpen && (
          <EffectAdder
            onApplySpell={async (source) => {
              setAdderOpen(false);
              await applyEffect(
                buildActiveEffectFromSpell(
                  source,
                  (source.data as { level?: number }).level,
                ),
              );
            }}
            onAddCustom={async (input) => {
              setAdderOpen(false);
              await addCustomEffect(input);
            }}
          />
        )}
      </div>
    </div>
  );
}

interface EffectAdderProps {
  onApplySpell: (source: SpellEffectSource) => Promise<void>;
  onAddCustom: (input: {
    name: string;
    stat?: string;
    value?: number;
    duration: EffectDuration;
  }) => Promise<void>;
}

function EffectAdder({ onApplySpell, onAddCustom }: EffectAdderProps) {
  const { spells } = useSpells();

  // Known spells that produce an ongoing effect (non-instantaneous duration).
  const applicableSpells = useMemo(() => {
    const sources: SpellEffectSource[] = [];
    for (const spell of spells) {
      const content = spell.content_definitions;
      if (!content) continue;
      const data = content.data as {
        duration?: string;
        duration_structured?: EffectDuration;
        concentration?: boolean;
        level?: number;
      };
      const duration =
        data.duration_structured ?? parseSpellDuration(data.duration ?? "");
      if (duration.type === "instantaneous") continue;
      sources.push({
        id: content.id,
        name: content.name,
        slug: content.slug,
        effects: (content.effects ?? []) as unknown as SpellEffectSource["effects"],
        data,
      });
    }
    // Dedupe by slug (multiclass rows) and sort for a stable list.
    const bySlug = new Map(sources.map((s) => [s.slug, s]));
    return Array.from(bySlug.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [spells]);

  const [customName, setCustomName] = useState("");
  const [customStat, setCustomStat] = useState<string>("");
  const [customValue, setCustomValue] = useState(0);
  const [durationType, setDurationType] =
    useState<CustomDurationType>("special");
  const [durationValue, setDurationValue] = useState(1);

  const durationNeedsValue =
    durationType === "rounds" ||
    durationType === "minutes" ||
    durationType === "hours";

  return (
    <div className="absolute z-20 mt-1 w-60 rounded-md border border-border bg-popover p-2 shadow-md space-y-2">
      {applicableSpells.length > 0 && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
            From known spells
          </p>
          <div className="max-h-36 overflow-y-auto">
            {applicableSpells.map((source) => (
              <button
                key={source.slug}
                type="button"
                onClick={() => void onApplySpell(source)}
                className="w-full text-left text-xs px-2 py-1 rounded hover:bg-accent"
              >
                {source.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Custom effect
        </p>
        <input
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="Name (e.g. Half cover)"
          aria-label="Custom effect name"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
        />
        <div className="flex gap-1.5">
          <select
            value={customStat}
            onChange={(e) => setCustomStat(e.target.value)}
            aria-label="Modified stat"
            className="flex-1 min-w-0 rounded border border-border bg-background px-1 py-1 text-xs"
          >
            {CUSTOM_STAT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {customStat && (
            <input
              type="number"
              value={customValue}
              onChange={(e) => setCustomValue(Number(e.target.value))}
              aria-label="Modifier value"
              className="w-14 rounded border border-border bg-background px-1 py-1 text-xs"
            />
          )}
        </div>
        <div className="flex gap-1.5">
          <select
            value={durationType}
            onChange={(e) =>
              setDurationType(e.target.value as CustomDurationType)
            }
            aria-label="Duration type"
            className="flex-1 min-w-0 rounded border border-border bg-background px-1 py-1 text-xs"
          >
            {CUSTOM_DURATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {durationNeedsValue && (
            <input
              type="number"
              min={1}
              value={durationValue}
              onChange={(e) => setDurationValue(Number(e.target.value))}
              aria-label="Duration value"
              className="w-14 rounded border border-border bg-background px-1 py-1 text-xs"
            />
          )}
        </div>
        <button
          type="button"
          disabled={customName.trim().length === 0}
          onClick={() =>
            void onAddCustom({
              name: customName.trim(),
              ...(customStat ? { stat: customStat, value: customValue } : {}),
              duration: buildDuration(durationType, durationValue),
            })
          }
          className="w-full text-xs px-2 py-1 rounded-md border border-border hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add custom effect
        </button>
      </div>
    </div>
  );
}
