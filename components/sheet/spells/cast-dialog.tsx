"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
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
import { CharacterStateReloadError } from "@/lib/character/state-save-error";
import { useDialogAction } from "@/lib/character/use-dialog-action";
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
  substituteMod,
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
  if (total > 12) return <span className="tabular-nums text-muted-foreground">{free}/{total}</span>;
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
  return open ? <CastDialogSession key={spell.id} spell={spell} castability={castability} open onClose={onClose} /> : null;
}

function CastDialogSession({ spell, castability, open, onClose }: CastDialogProps) {
  const isMobile = useIsMobile();
  const { character, isOwner } = useCharacter();
  const {
    maxSlots,
    slotResolution,
    slotState,
    pactSlotLevel,
    casterInfo,
    concentration,
    castSpell,
    getCastingAbility,
  } = useSpells();
  const { roll, assertMechanics } = useRolls();

  const sourceResolution = getCastingAbility(spell);
  const profile = sourceResolution.status === "available" ? sourceResolution.profile : null;
  const earnedRacial = sourceResolution.status === "available" ? sourceResolution.earnedRacial : undefined;
  const resolvedSpell = sourceResolution.status === "available" ? sourceResolution.spell : spell;
  const data = (resolvedSpell.content_definitions?.data ?? {}) as CastSpellData;
  const spellLevel = data.level ?? 0;
  const isCantrip = spellLevel === 0;

  const slotOptions = earnedRacial || isCantrip || slotResolution?.status !== "available"
    ? []
    : getEligibleSlotOptions(spellLevel, maxSlots, slotState, pactSlotLevel);

  const ritualEligible =
    !earnedRacial && (castability === "ritual-only" || isRitualEligible(resolvedSpell, casterInfo));

  const [selectedKey, setSelectedKey] = useState<string | null>(
    () => getDefaultSlotOption(slotOptions)?.key ?? null,
  );
  const [ritual, setRitual] = useState(castability === "ritual-only");
  const { pending: casting, run, canDismiss } = useDialogAction();
  const [castError, setCastError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<CastOutcome | null>(null);
  // Bind once to the post-cast committed render, never refresh an old outcome
  // onto a later spell/ability/grant snapshot merely because props rerender.
  const outcomeGuard = useRef<{ outcome: CastOutcome; check: () => void } | null>(null);
  useLayoutEffect(() => {
    if (!outcome) { outcomeGuard.current = null; return; }
    if (outcomeGuard.current?.outcome !== outcome) outcomeGuard.current = { outcome, check: () => assertMechanics() };
  }, [outcome, assertMechanics]);
  const [results, setResults] = useState<Record<number, RollResult>>({});
  const [critArmed, setCritArmed] = useState(false);

  const selectedOption =
    slotOptions.find((o) => o.key === selectedKey && o.free > 0) ?? null;
  const noSlotsAvailable = !isCantrip && !slotOptions.some((o) => o.free > 0);
  const canCast =
    isOwner && !earnedRacial && profile !== null && slotResolution?.status === "available" && (isCantrip || ritual || (selectedOption !== null && !noSlotsAvailable));

  // --- Preview at the currently-selected cast level ---
  const previewLevel = earnedRacial ? earnedRacial.castLevel : isCantrip
    ? character.level
    : ritual
      ? spellLevel
      : (selectedOption?.castLevel ?? spellLevel);
  const previewDamageBase =
    resolveAtSlotLevel(data.damage?.dice_at_slot_level, previewLevel) ??
    (isCantrip
      ? resolveCantripDie(data.descriptionCantripDie, character.level)
      : null);
  const previewDamage = previewDamageBase && profile ? substituteMod(previewDamageBase, profile.abilityModifier) : previewDamageBase;
  const previewHealBase = isCantrip
    ? null
    : resolveAtSlotLevel(data.heal_at_slot_level, previewLevel);

  const previewHeal = previewHealBase && profile ? substituteMod(previewHealBase, profile.abilityModifier) : previewHealBase;

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
    if (!canCast || !canDismiss()) return;
    const choice: CastChoice = isCantrip
      ? { type: "cantrip" }
      : ritual
        ? { type: "ritual" }
        : selectedOption!.isPact
          ? { type: "pact", level: selectedOption!.castLevel }
          : { type: "slot", level: selectedOption!.castLevel };
    setCastError(null);
    await run(() => castSpell(spell, choice), setOutcome, (error) => {
      setCastError(error instanceof CharacterStateReloadError
        ? error.message
        : "The spell could not be saved. Wait for any pending character save to finish, then try casting again.");
    });
  };

  const executeRoll = (index: number, request: RollRequest, mode?: RollRequest["mode"]) => {
    try {
    if (!outcome || outcomeGuard.current?.outcome !== outcome) throw new Error("The saved cast result is unavailable.");
    outcomeGuard.current.check();
    if (!profile) throw new Error("The saved casting profile is unavailable.");
    const requirement = { abilities: [profile.ability], computed: ["proficiency_bonus"], values: [profile.abilityModifier, profile.spellDc, profile.spellAttackBonus] };
    assertMechanics(requirement);
    const finalRequest: RollRequest = {
      ...request,
      ...(mode ? { mode } : {}),
      ...(request.kind === "damage" && critArmed ? { crit: true } : {}),
    };
    const result = roll(finalRequest, requirement);
    setResults((prev) => ({ ...prev, [index]: result }));
    if (request.kind === "attack" && result.natural === 20) {
      setCritArmed(true);
    }
    return result;
    } catch (cause) { setCastError(cause instanceof Error ? cause.message : "Reload before rolling this saved cast result."); }
  };

  const body: ReactNode = outcome === null ? (
    /* ---------------- Configure pane ---------------- */
    <div className="space-y-4 text-sm">
      {slotResolution?.status !== "available" && <p role="status" className="text-sm text-muted-foreground">Spell slots are unavailable. Reload the character or restore its saved class content before casting.</p>}
      {!isOwner && <p role="status" className="text-muted-foreground">This character is read-only. Only its owner can cast spells.</p>}
      {sourceResolution.status !== "available" ? <p role="status" className="text-muted-foreground">{sourceResolution.reason}</p> : <p className="text-muted-foreground">Cast as {profile!.classSlug.startsWith("race:") ? `${capitalize(profile!.classSlug.slice(5).replace(/-/g, " "))} trait` : capitalize(profile!.classSlug.replace(/-/g, " "))} ({capitalize(profile!.ability)}).</p>}
      {castError && <p role="alert" className="text-destructive">{castError}</p>}
      <p className="text-xs text-muted-foreground">{metaLine}</p>

      {isCantrip ? (
        <p className="text-xs text-muted-foreground">
          Cantrip — no spell slot required.
          {previewDamage && (
            <> Scales with character level (currently level {character.level}).</>
          )}
        </p>
      ) : earnedRacial ? (
        <p role="status" className="text-xs text-muted-foreground">Racial trait · cast at 2nd level · once per long rest. Casting and use tracking are not available in this dialog.</p>
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
                  disabled={casting || option.free === 0 || ritual}
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
            disabled={casting || castability === "ritual-only"}
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
      {profile && (previewDamage || previewHeal || data.dc?.type || data.attack_type) && (
        <div className="rounded-md border border-border bg-card/50 px-3 py-2 space-y-0.5 text-xs">
          <p className="font-medium text-muted-foreground uppercase tracking-wide text-[10px]">
            On cast
          </p>
          {data.attack_type && (
            <p>
              {capitalize(data.attack_type)} spell attack{" "}
              {profile.spellAttackBonus >= 0 ? "+" : ""}
              {profile.spellAttackBonus}
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
              {capitalize(data.dc.type)} save DC {profile.spellDc}
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
        <Button variant="outline" size="sm" disabled={casting} onClick={() => canDismiss() && onClose()}>
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
      {castError && <p role="alert" className="text-destructive">{castError}</p>}
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
      <Drawer open={open} dismissible={!casting} onOpenChange={(o) => !o && canDismiss() && onClose()}>
        <DrawerContent aria-busy={casting}>
          <DrawerHeader className="pb-2">
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 overflow-y-auto">
            {casting && <p role="status" className="mb-3 text-sm text-muted-foreground">Saving this cast. Please wait.</p>}
            {body}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && canDismiss() && onClose()}>
      <DialogContent className="sm:max-w-md" showCloseButton={!casting} aria-busy={casting}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {casting && <p role="status" className="text-sm text-muted-foreground">Saving this cast. Please wait.</p>}
        {body}
      </DialogContent>
    </Dialog>
  );
}
