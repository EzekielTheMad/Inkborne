"use client";

import Link from "next/link";
import { Save, WandSparkles } from "lucide-react";
import { useActionState } from "react";

import {
  repairMpmbImportSpell,
  type MpmbSpellRepairActionState,
} from "@/app/(app)/homebrew/import/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface MpmbImportSpellRepairFormProps {
  importId: string;
  itemId: string;
  revision: number;
  candidateName: string;
  repairFields: {
    material: boolean;
    dc: boolean;
    concentration: boolean;
    ritual: boolean;
  };
  initialMaterial?: string;
  initialSaveAbility?: string;
  initialSaveSuccess?: string;
}

const initialState: MpmbSpellRepairActionState = {
  status: "idle",
  message: "",
};

const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const saveAbilities = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
] as const;

function FieldErrors({
  state,
  name,
}: {
  state: MpmbSpellRepairActionState;
  name: string;
}) {
  const errors = state.fieldErrors?.[name];
  if (!errors?.length) return null;
  return (
    <p id={`spell-repair-${name}-error`} className="text-xs text-destructive">
      {errors.join(" ")}
    </p>
  );
}

function errorAttributes(
  state: MpmbSpellRepairActionState,
  name: string,
  helpId?: string,
) {
  const invalid = Boolean(state.fieldErrors?.[name]?.length);
  const errorId = invalid ? `spell-repair-${name}-error` : undefined;
  return {
    "aria-invalid": invalid || undefined,
    "aria-describedby": [helpId, errorId].filter(Boolean).join(" ") || undefined,
  } as const;
}

export function MpmbImportSpellRepairForm({
  importId,
  itemId,
  revision,
  candidateName,
  repairFields,
  initialMaterial,
  initialSaveAbility,
  initialSaveSuccess,
}: MpmbImportSpellRepairFormProps) {
  const [state, formAction, pending] = useActionState(
    repairMpmbImportSpell,
    initialState,
  );

  return (
    <form action={formAction} className="j-card-paper space-y-6 p-5 sm:p-7">
      <input type="hidden" name="import_id" value={importId} />
      <input type="hidden" name="item_id" value={itemId} />
      <input type="hidden" name="expected_revision" value={revision} />
      {repairFields.material && (
        <input type="hidden" name="repair_material" value="true" />
      )}
      {repairFields.dc && (
        <input type="hidden" name="repair_dc" value="true" />
      )}
      {repairFields.concentration && (
        <input type="hidden" name="repair_concentration" value="true" />
      )}
      {repairFields.ritual && (
        <input type="hidden" name="repair_ritual" value="true" />
      )}

      <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <WandSparkles className="size-4 text-accent" />
          Repairing {candidateName}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Only the missing fields below will change. All other normalized spell
          data and import provenance stay intact.
        </p>
      </div>

      {repairFields.material && (
        <fieldset className="space-y-3">
          <legend className="j-folio">Material component</legend>
          <div className="space-y-2">
            <Label htmlFor="repair-material">Required material</Label>
            <Input
              id="repair-material"
              name="material"
              defaultValue={initialMaterial}
              maxLength={500}
              placeholder="For example: a pinch of powdered iron"
              required
              {...errorAttributes(state, "material", "repair-material-help")}
            />
            <p id="repair-material-help" className="text-xs text-muted-foreground">
              Copy the component text from a source you are allowed to use.
            </p>
            <FieldErrors state={state} name="material" />
          </div>
        </fieldset>
      )}

      {repairFields.dc && (
        <fieldset className="space-y-4 border-t border-border pt-6">
          <legend className="j-folio">Saving throw</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="repair-save-ability">Save ability</Label>
              <select
                id="repair-save-ability"
                name="save_ability"
                defaultValue={initialSaveAbility ?? ""}
                className={selectClassName}
                required
                {...errorAttributes(state, "save_ability")}
              >
                <option value="" disabled>Choose an ability</option>
                {saveAbilities.map((ability) => (
                  <option key={ability} value={ability}>
                    {ability[0].toUpperCase() + ability.slice(1)}
                  </option>
                ))}
              </select>
              <FieldErrors state={state} name="save_ability" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="repair-save-success">On a successful save</Label>
              <select
                id="repair-save-success"
                name="save_success"
                defaultValue={initialSaveSuccess ?? ""}
                className={selectClassName}
                required
                {...errorAttributes(state, "save_success")}
              >
                <option value="" disabled>Choose an outcome</option>
                <option value="none">No effect</option>
                <option value="half">Half effect or damage</option>
                <option value="other">Other stated outcome</option>
              </select>
              <FieldErrors state={state} name="save_success" />
            </div>
          </div>
        </fieldset>
      )}

      {(repairFields.concentration || repairFields.ritual) && (
        <fieldset className="space-y-4 border-t border-border pt-6">
          <legend className="j-folio">Spell properties</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {repairFields.concentration && (
              <div className="space-y-2">
                <Label htmlFor="repair-concentration">
                  Requires concentration?
                </Label>
                <select
                  id="repair-concentration"
                  name="concentration"
                  defaultValue=""
                  className={selectClassName}
                  required
                  {...errorAttributes(state, "concentration")}
                >
                  <option value="" disabled>Choose Yes or No</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
                <FieldErrors state={state} name="concentration" />
              </div>
            )}
            {repairFields.ritual && (
              <div className="space-y-2">
                <Label htmlFor="repair-ritual">Can be cast as a ritual?</Label>
                <select
                  id="repair-ritual"
                  name="ritual"
                  defaultValue=""
                  className={selectClassName}
                  required
                  {...errorAttributes(state, "ritual")}
                >
                  <option value="" disabled>Choose Yes or No</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
                <FieldErrors state={state} name="ritual" />
              </div>
            )}
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
