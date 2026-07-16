"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Brain, Sparkles, TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/lib/builder/use-is-mobile";
import {
  useCharacter,
  useRolls,
  useSpells,
} from "@/lib/character/character-context";
import type { CharacterSpell } from "@/lib/types/spells";
import type { RollRequest, RollResult } from "@/lib/dice/types";
import {
  getEligibleSlotOptions,
  getDefaultSlotOption,
  isRitualEligible,
  resolveAtSlotLevel,
  resolveCantripDie,
  type CastChoice,
  type CastOutcome,
  type CastSpellData,
  type SlotOption,
} from "@/lib/spells/casting";

interface CastDialogProps {
  spell: CharacterSpell;
  /** "ritual-only": unprepared wizard-spellbook row — the ritual path is the
   *  only legal cast (design §4.2, wizard RAW nuance). */
  castability: "full" | "ritual-only";
  open: boolean;
  onClose: () => void;
}

function ordinal(level: number): string {
  if (level === 1) return "1st";
  if (level === 2) return "2nd";
  if (level === 3) return "3rd";
  return `${level}th`;
}

function slotOptionLabel(option: SlotOption): string {
  return option.isPact
    ? `Pact ${ordinal(option.castLevel)}`
    : ordinal(option.castLevel);
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/** ●●○ free/used dots for a slot-picker button. */
function SlotDots({ total, free }: { total: number; free: number }) {
  return (
    <span aria-hidden className="flex gap-0.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "inline-block size-1.5 rounded-full",
            i < free
              ? "bg-character-fg"
              : "border border-character-border bg-transparent",
          )}
        />
      ))}
    </span>
  );
}

/**
 * Cast dialog (design §4.2–4.4): slot picker with upcast preview and
 * first-class pact slots, ritual path, cantrip tier scaling, concentration
 * replace warning, atomic cast execution, and a post-cast result pane
 * offering the spell's rolls (attack → damage crit chain included).
 *
 * Dialog on desktop, Vaul bottom sheet on mobile. Everything rendered derives
 * from the spell's schema-validated `data` — no per-spell logic.
 */
export function CastDialog({ spell, castability, open, onClose }: CastDialogProps) {
  const isMobile = useIsMobile();
  const { character } = useCharacter();
  const {
    maxSlots,
    slotState,
    pactSlotLevel,
    casterInfo,
    concentration,
    castSpell,
  } = useSpells();
  const { roll } = useRolls();

  const data = (spell.content_definitions?.data ?? {}) as CastSpellData;
  const spellLevel = data.level ?? 0;
  const isCantrip = spellLevel === 0;

  const slotOptions = useMemo(
    () =>
      isCantrip
        ? []
        : getEligibleSlotOptions(spellLevel, maxSlots, slotState, pactSlotLevel),
    [isCantrip, spellLevel, maxSlots, slotState, pactSlotLevel],
  );

  const ritualEligible =
    castability === "ritual-only" || isRitualEligible(spell, casterInfo);

  const [selectedKey, setSelectedKey] = useState<string | null>(
    () => getDefaultSlotOption(slotOptions)?.key ?? null,
  );
  const [ritual, setRitual] = useState(castability === "ritual-only");
  const [casting, setCasting] = useState(false);
  const [outcome, setOutcome] = useState<CastOutcome | null>(null);
  const [results, setResults] = useState<Record<number, RollResult>>({});
  const [critArmed, setCritArmed] = useState(false);

  const selectedOption =
    slotOptions.find((o) => o.key === selectedKey && o.free > 0) ?? null;
  const noSlotsAvailable = !isCantrip && !slotOptions.some((o) => o.free > 0);
  const canCast =
    isCantrip || ritual || (selectedOption !== null && !noSlotsAvailable);

  // --- Preview at the currently-selected cast level ---
  const previewLevel = isCantrip
    ? character.level
    : ritual
      ? spellLevel
      : (selectedOption?.castLevel ?? spellLevel);
  const previewDamage =
    resolveAtSlotLevel(data.damage?.dice_at_slot_level, previewLevel) ??
    (isCantrip
      ? resolveCantripDie(data.descriptionCantripDie, character.level)
      : null);
  const previewHeal = isCantrip
    ? null
    : resolveAtSlotLevel(data.heal_at_slot_level, previewLevel);

  const replacesConcentration =
    data.concentration === true && concentration !== null;

  const metaLine = [
    isCantrip ? `${capitalize(data.school ?? "")} cantrip` : `${ordinal(spellLevel)}-level ${data.school ?? ""}`,
    data.components?.join(", "),
    data.range,
    data.casting_time,
  ]
    .filter(Boolean)
    .join(" · ");

  const onCast = async () => {
    if (!canCast || casting) return;
    const choice: CastChoice = isCantrip
      ? { type: "cantrip" }
      : ritual
        ? { type: "ritual" }
        : selectedOption!.isPact
          ? { type: "pact", level: selectedOption!.castLevel }
          : { type: "slot", level: selectedOption!.castLevel };
    setCasting(true);
    try {
      const result = await castSpell(spell, choice);
      setOutcome(result);
    } finally {
      setCasting(false);
    }
  };

  const executeRoll = (index: number, request: RollRequest, mode?: RollRequest["mode"]) => {
    const finalRequest: RollRequest = {
      ...request,
      ...(mode ? { mode } : {}),
      ...(request.kind === "damage" && critArmed ? { crit: true } : {}),
    };
    const result = roll(finalRequest);
    setResults((prev) => ({ ...prev, [index]: result }));
    if (request.kind === "attack" && result.natural === 20) {
      setCritArmed(true);
    }
    return result;
  };

  const body: ReactNode = outcome === null ? (
    /* ---------------- Configure pane ---------------- */
    <div className="space-y-4 text-sm">
      <p className="text-xs text-muted-foreground">{metaLine}</p>

      {isCantrip ? (
        <p className="text-xs text-muted-foreground">
          Cantrip — no spell slot required.
          {previewDamage && (
            <> Scales with character level (currently level {character.level}).</>
          )}
        </p>
      ) : (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Cast with slot
          </p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Spell slot level">
            {slotOptions.map((option) => {
              const selected = !ritual && option.key === selectedKey;
              return (
                <button
                  key={option.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={option.free === 0 || ritual}
                  onClick={() => setSelectedKey(option.key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors",
                    selected
                      ? "border-character-border bg-character-bg text-character-fg"
                      : "border-border hover:border-muted-foreground/50",
                    (option.free === 0 || ritual) &&
                      "opacity-40 cursor-not-allowed hover:border-border",
                  )}
                >
                  <span>{slotOptionLabel(option)}</span>
                  <SlotDots total={option.total} free={option.free} />
                </button>
              );
            })}
            {slotOptions.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                No slots of {ordinal(spellLevel)} level or higher.
              </p>
            )}
          </div>
          {noSlotsAvailable && !ritual && (
            <p className="text-xs text-destructive">
              No available slots — take a rest.
            </p>
          )}
        </div>
      )}

      {ritualEligible && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={ritual}
            disabled={castability === "ritual-only"}
            onChange={(e) => setRitual(e.target.checked)}
            className="size-4 accent-character-fg"
          />
          <span>Cast as ritual (+10 min, no slot)</span>
        </label>
      )}
      {castability === "ritual-only" && (
        <p className="text-xs text-muted-foreground">
          Not prepared — castable only as a ritual from the spellbook.
        </p>
      )}

      {/* On-cast preview */}
      {(previewDamage || previewHeal || data.dc?.type || data.attack_type) && (
        <div className="rounded-md border border-border bg-card/50 px-3 py-2 space-y-0.5 text-xs">
          <p className="font-medium text-muted-foreground uppercase tracking-wide text-[10px]">
            On cast
          </p>
          {data.attack_type && (
            <p>
              {capitalize(data.attack_type)} spell attack{" "}
              {casterInfo.spellAttackBonus >= 0 ? "+" : ""}
              {casterInfo.spellAttackBonus}
            </p>
          )}
          {previewDamage && (
            <p>
              {previewDamage}
              {data.damage?.type ? ` ${data.damage.type}` : ""} damage
            </p>
          )}
          {previewHeal && <p>Heals {previewHeal.replace(/MOD/gi, "spellcasting mod")}</p>}
          {data.dc?.type && (
            <p>
              {capitalize(data.dc.type)} save DC {casterInfo.spellDc}
              {data.dc.success === "half" && " · half on success"}
              {data.dc.success === "none" && " · no effect on success"}
            </p>
          )}
        </div>
      )}

      {replacesConcentration && (
        <p className="flex items-start gap-1.5 text-xs text-amber-500">
          <TriangleAlert className="size-3.5 shrink-0 mt-0.5" aria-hidden />
          <span>
            Requires concentration — casting will end{" "}
            <span className="font-medium">{concentration?.spell_name}</span>.
          </span>
        </p>
      )}
      {data.concentration === true && !replacesConcentration && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Brain className="size-3.5" aria-hidden /> Requires concentration.
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={onCast} disabled={!canCast || casting}>
          Cast
        </Button>
      </div>
    </div>
  ) : (
    /* ---------------- Result pane ---------------- */
    <div className="space-y-4 text-sm">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles className="size-3.5 text-character-fg" aria-hidden />
        {spell.name} cast
        {outcome.castLevel > 0 && <> at {ordinal(outcome.castLevel)} level</>}
        {!isCantrip && ritual && <> as a ritual</>}.
      </p>

      {outcome.rollRequests.length === 0 && !outcome.dcInfo && (
        <p className="text-xs text-muted-foreground italic">
          Nothing to roll — apply the spell&apos;s effects at the table.
        </p>
      )}

      {outcome.rollRequests.map((request, index) => {
        const result = results[index];
        if (request.kind === "attack") {
          return (
            <div key={index} className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Button size="sm" onClick={() => executeRoll(index, request)}>
                  Roll Attack ({request.expression.replace("1d20", "") || "+0"})
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => executeRoll(index, request, "advantage")}
                >
                  Advantage
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => executeRoll(index, request, "disadvantage")}
                >
                  Disadvantage
                </Button>
                {result && (
                  <span className="text-sm font-semibold tabular-nums">
                    → {result.total}
                  </span>
                )}
              </div>
              {result?.natural === 20 && (
                <p className="text-xs font-medium text-character-fg">
                  Natural 20 — critical hit! Damage dice doubled.
                </p>
              )}
              {result?.natural === 1 && (
                <p className="text-xs font-medium text-destructive">
                  Natural 1 — automatic miss.
                </p>
              )}
            </div>
          );
        }
        return (
          <div key={index} className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant={request.kind === "heal" ? "outline" : "default"}
              onClick={() => executeRoll(index, request)}
            >
              {request.kind === "heal" ? "Roll Healing" : "Roll Damage"} (
              {request.expression}
              {request.kind === "damage" && critArmed ? " · crit" : ""})
            </Button>
            {result && (
              <span className="text-sm font-semibold tabular-nums">
                → {result.total}
              </span>
            )}
          </div>
        );
      })}

      {outcome.dcInfo && (
        <p className="text-xs text-muted-foreground">
          Target rolls: {capitalize(outcome.dcInfo.ability)} save DC{" "}
          {outcome.dcInfo.dc}
          {outcome.dcInfo.success === "half" && " · half damage on success"}
          {outcome.dcInfo.success === "none" && " · no effect on success"}
        </p>
      )}

      {outcome.activeEffect && (
        <p className="text-xs text-muted-foreground">
          {outcome.activeEffect.name} added to Active Effects
          {outcome.activeEffect.concentration && " (concentration)"}.
        </p>
      )}

      <div className="flex justify-end pt-1">
        <Button size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );

  const title = `Cast: ${spell.name}`;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
        <DrawerContent>
          <DrawerHeader className="pb-2">
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 overflow-y-auto">{body}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
