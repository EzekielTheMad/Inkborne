"use client";

import { Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildConcentrationSaveRequest } from "@/lib/active-effects/concentration";
import { collectRollModifiers } from "@/lib/active-effects/helpers";
import { rollModifierKindFor } from "@/lib/rolls/requests";
import { formatModifier, getSaveModifier } from "@/lib/sheet/helpers";
import {
  useActiveEffects,
  useCharacter,
  useConcentration,
  useRolls,
} from "@/lib/character/character-context";

/**
 * Damage-triggered concentration check (design §6.6, decision D4).
 *
 * Mounted once in `CharacterShell`; renders nothing until the HP tracker's
 * damage path raises a pending check. Offers:
 * - **Roll CON Save** — dice engine, kind `concentration` (toast/log/persist
 *   automatic; Bless-style `roll_save` modifiers apply). Auto-resolves:
 *   total ≥ DC keeps concentration, otherwise the atomic drop patch applies.
 * - **Keep** / **Drop** — manual overrides for table adjudication (War Caster
 *   advantage, DM rulings). Dismissing the dialog counts as Keep — closing a
 *   prompt must never silently strip the player's buffs.
 */
export function ConcentrationPrompt() {
  const { concentration, pendingCheck, resolveCheck } = useConcentration();
  const { evalResult } = useCharacter();
  const { roll } = useRolls();
  const { activeEffects } = useActiveEffects();

  if (!pendingCheck || !concentration) return null;

  const { grants, stats, computed } = evalResult;
  const conMod =
    stats.constitution_mod ??
    Math.floor(((stats.constitution ?? 10) - 10) / 2);
  const proficiencyBonus = computed.proficiency_bonus ?? 0;
  const saveModifier = getSaveModifier(
    conMod,
    proficiencyBonus,
    grants,
    "saving_throw_constitution",
  );

  function handleRollSave() {
    if (!pendingCheck || !concentration) return;
    const result = roll(
      buildConcentrationSaveRequest(
        concentration.spell_name,
        saveModifier,
        pendingCheck,
        // Bless-style roll_save riders apply — a concentration check IS a
        // CON save (same convention as RollPopover's d20 surfaces).
        collectRollModifiers(activeEffects, rollModifierKindFor("concentration")),
      ),
    );
    void resolveCheck(result.total >= pendingCheck.dc ? "keep" : "drop");
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) void resolveCheck("keep");
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="size-4 text-purple-400" aria-hidden />
            Concentration Check
          </DialogTitle>
          <DialogDescription>
            You took {pendingCheck.damage} damage while concentrating on{" "}
            <span className="font-medium text-foreground">
              {concentration.spell_name}
            </span>
            . Make a Constitution saving throw (DC {pendingCheck.dc}) or lose
            concentration.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => void resolveCheck("keep")}>
            Keep
          </Button>
          <Button variant="outline" onClick={() => void resolveCheck("drop")}>
            Drop
          </Button>
          <Button onClick={handleRollSave}>
            Roll CON Save ({formatModifier(saveModifier)})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
