"use client";

import Link from "next/link";
import { Save, Sparkles } from "lucide-react";
import { useActionState } from "react";

import {
  repairMpmbImportFeat,
  type MpmbFeatRepairActionState,
} from "@/app/(app)/homebrew/import/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface MpmbImportFeatRepairFormProps {
  importId: string;
  itemId: string;
  revision: number;
  candidateName: string;
  repairFields: {
    prerequisites: boolean;
    action: boolean;
    recovery: boolean;
    spellcastingAbility: boolean;
  };
  initialPrerequisiteAbility?: string;
  initialPrerequisiteMinimum?: number;
  initialAction?: string | null;
  initialRecovery?: string | null;
  initialSpellcastingAbility?: string;
}

const initialState: MpmbFeatRepairActionState = {
  status: "idle",
  message: "",
};

const abilities = [
  ["strength", "Strength"],
  ["dexterity", "Dexterity"],
  ["constitution", "Constitution"],
  ["intelligence", "Intelligence"],
  ["wisdom", "Wisdom"],
  ["charisma", "Charisma"],
] as const;

const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function FieldErrors({
  state,
  name,
}: {
  state: MpmbFeatRepairActionState;
  name: string;
}) {
  const errors = state.fieldErrors?.[name];
  if (!errors?.length) return null;
  return (
    <p id={`feat-repair-${name}-error`} className="text-xs text-destructive">
      {errors.join(" ")}
    </p>
  );
}

function errorAttributes(state: MpmbFeatRepairActionState, name: string) {
  const invalid = Boolean(state.fieldErrors?.[name]?.length);
  return {
    "aria-invalid": invalid || undefined,
    "aria-describedby": invalid ? `feat-repair-${name}-error` : undefined,
  } as const;
}

export function MpmbImportFeatRepairForm({
  importId,
  itemId,
  revision,
  candidateName,
  repairFields,
  initialPrerequisiteAbility,
  initialPrerequisiteMinimum,
  initialAction,
  initialRecovery,
  initialSpellcastingAbility,
}: MpmbImportFeatRepairFormProps) {
  const [state, formAction, pending] = useActionState(
    repairMpmbImportFeat,
    initialState,
  );

  return (
    <form action={formAction} className="j-card-paper space-y-6 p-5 sm:p-7">
      <input type="hidden" name="import_id" value={importId} />
      <input type="hidden" name="item_id" value={itemId} />
      <input type="hidden" name="expected_revision" value={revision} />
      {repairFields.prerequisites && (
        <input type="hidden" name="repair_prerequisites" value="true" />
      )}
      {repairFields.action && (
        <input type="hidden" name="repair_action" value="true" />
      )}
      {repairFields.recovery && (
        <input type="hidden" name="repair_recovery" value="true" />
      )}
      {repairFields.spellcastingAbility && (
        <input
          type="hidden"
          name="repair_spellcasting_ability"
          value="true"
        />
      )}

      <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Sparkles className="size-4 text-accent" />
          Repairing {candidateName}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Only the diagnosed fields below will change. All other normalized feat
          data, effects, and import provenance stay intact.
        </p>
      </div>

      {repairFields.prerequisites && (
        <fieldset className="space-y-4">
          <legend className="j-folio">Ability prerequisite</legend>
          <p className="text-sm text-muted-foreground">
            Choose no prerequisite or one exact ability-score minimum.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="repair-prerequisite-ability">Ability</Label>
              <select
                id="repair-prerequisite-ability"
                name="prerequisite_ability"
                defaultValue={initialPrerequisiteAbility ?? ""}
                className={selectClassName}
                {...errorAttributes(state, "prerequisite_ability")}
              >
                <option value="">No prerequisite</option>
                {abilities.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <FieldErrors state={state} name="prerequisite_ability" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="repair-prerequisite-minimum">Minimum score</Label>
              <Input
                id="repair-prerequisite-minimum"
                name="prerequisite_minimum"
                type="number"
                min="1"
                max="30"
                step="1"
                defaultValue={initialPrerequisiteMinimum}
                {...errorAttributes(state, "prerequisite_minimum")}
              />
              <FieldErrors state={state} name="prerequisite_minimum" />
            </div>
          </div>
        </fieldset>
      )}

      {(repairFields.action || repairFields.recovery) && (
        <fieldset className="space-y-4 border-t border-border pt-6">
          <legend className="j-folio">Action and recovery</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {repairFields.action && (
              <div className="space-y-2">
                <Label htmlFor="repair-feat-action">Action economy</Label>
                <select
                  id="repair-feat-action"
                  name="action"
                  defaultValue={initialAction ?? ""}
                  className={selectClassName}
                  {...errorAttributes(state, "action")}
                >
                  <option value="">No tracked action</option>
                  <option value="action">Action</option>
                  <option value="bonus action">Bonus action</option>
                  <option value="reaction">Reaction</option>
                  <option value="free">Free</option>
                </select>
                <FieldErrors state={state} name="action" />
              </div>
            )}
            {repairFields.recovery && (
              <div className="space-y-2">
                <Label htmlFor="repair-feat-recovery">Recovery</Label>
                <select
                  id="repair-feat-recovery"
                  name="recovery"
                  defaultValue={initialRecovery ?? ""}
                  className={selectClassName}
                  {...errorAttributes(state, "recovery")}
                >
                  <option value="">No recovery</option>
                  <option value="short rest">Short rest</option>
                  <option value="long rest">Long rest</option>
                  <option value="dawn">Dawn</option>
                  <option value="day">Day</option>
                </select>
                <FieldErrors state={state} name="recovery" />
              </div>
            )}
          </div>
        </fieldset>
      )}

      {repairFields.spellcastingAbility && (
        <fieldset className="space-y-3 border-t border-border pt-6">
          <legend className="j-folio">Spellcasting ability</legend>
          <div className="space-y-2">
            <Label htmlFor="repair-feat-spellcasting-ability">Ability</Label>
            <select
              id="repair-feat-spellcasting-ability"
              name="spellcasting_ability"
              defaultValue={initialSpellcastingAbility ?? ""}
              className={selectClassName}
              {...errorAttributes(state, "spellcasting_ability")}
            >
              <option value="">No spellcasting ability</option>
              {abilities.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <FieldErrors state={state} name="spellcasting_ability" />
          </div>
        </fieldset>
      )}

      {state.status !== "idle" && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.message}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Link
          href={`/homebrew/import/${importId}`}
          className={buttonVariants({ variant: "outline" })}
        >
          Back to review
        </Link>
        {state.status === "conflict" && (
          <Button
            type="button"
            variant="outline"
            onClick={() => window.location.reload()}
          >
            Reload latest
          </Button>
        )}
        <Button
          type="submit"
          variant="gold"
          disabled={pending || state.status === "conflict"}
        >
          <Save className="size-4" />
          {pending ? "Saving correction..." : "Save missing details"}
        </Button>
      </div>
    </form>
  );
}
