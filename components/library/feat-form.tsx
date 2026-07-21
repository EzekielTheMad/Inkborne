"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  createHomebrewFeat,
  updateHomebrewFeat,
  type HomebrewFeatActionState,
} from "@/app/(app)/library/feats/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FeatData } from "@/lib/schemas/content-types/feat";

interface FeatFormInitialValue {
  id: string;
  name: string;
  version: number;
  data: FeatData;
}

interface FeatFormProps {
  mode: "create" | "edit";
  initialValue?: FeatFormInitialValue;
}

const ABILITIES = [
  ["strength", "Strength", "STR"],
  ["dexterity", "Dexterity", "DEX"],
  ["constitution", "Constitution", "CON"],
  ["intelligence", "Intelligence", "INT"],
  ["wisdom", "Wisdom", "WIS"],
  ["charisma", "Charisma", "CHA"],
] as const;

const emptyState: HomebrewFeatActionState = { status: "idle", message: "" };
const fieldClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const textareaClassName =
  "w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function FieldErrors({ state, name }: { state: HomebrewFeatActionState; name: string }) {
  const errors = state.fieldErrors?.[name];
  if (!errors?.length) return null;
  return <p id={`feat-${name}-error`} className="text-xs text-destructive">{errors.join(" ")}</p>;
}

function errorAttributes(state: HomebrewFeatActionState, name: string) {
  const invalid = Boolean(state.fieldErrors?.[name]?.length);
  return {
    "aria-invalid": invalid || undefined,
    "aria-describedby": invalid ? `feat-${name}-error` : undefined,
  } as const;
}

export function FeatForm({ mode, initialValue }: FeatFormProps) {
  const action = mode === "create" ? createHomebrewFeat : updateHomebrewFeat;
  const [state, formAction, pending] = useActionState(action, emptyState);
  const data = initialValue?.data;
  const prerequisite = data?.prerequisites[0];
  const prerequisiteAbility = ABILITIES.some(([ability]) => ability === prerequisite?.stat)
    ? prerequisite?.stat
    : "";

  return (
    <form action={formAction} className="j-card-paper space-y-7 p-5 sm:p-7">
      {initialValue && (
        <>
          <input type="hidden" name="id" value={initialValue.id} />
          <input type="hidden" name="expected_version" value={initialValue.version} />
        </>
      )}

      <fieldset className="space-y-4">
        <legend className="j-folio mb-3">Basics</legend>
        <div className="space-y-2">
          <Label htmlFor="feat-name">Name</Label>
          <Input id="feat-name" name="name" defaultValue={initialValue?.name} maxLength={100} required {...errorAttributes(state, "name")} />
          <FieldErrors state={state} name="name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="feat-description">Feat description</Label>
          <textarea id="feat-description" name="description" defaultValue={data?.description} rows={9} maxLength={20000} className={textareaClassName} required {...errorAttributes(state, "description")} />
          <FieldErrors state={state} name="description" />
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t border-border pt-6">
        <legend className="j-folio mb-3">Prerequisite</legend>
        <p className="text-sm text-muted-foreground">Optional. This first version supports one ability-score minimum.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="feat-prerequisite-ability">Ability</Label>
            <select id="feat-prerequisite-ability" name="prerequisite_ability" defaultValue={prerequisiteAbility} className={fieldClassName} {...errorAttributes(state, "prerequisite_ability")}>
              <option value="">No prerequisite</option>
              {ABILITIES.map(([ability, label]) => <option key={ability} value={ability}>{label}</option>)}
            </select>
            <FieldErrors state={state} name="prerequisite_ability" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="feat-prerequisite-minimum">Minimum score</Label>
            <Input id="feat-prerequisite-minimum" name="prerequisite_minimum" type="number" min="1" max="30" step="1" defaultValue={prerequisiteAbility ? prerequisite?.value : ""} {...errorAttributes(state, "prerequisite_minimum")} />
            <FieldErrors state={state} name="prerequisite_minimum" />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t border-border pt-6">
        <legend className="j-folio mb-3">Ability score increases</legend>
        <p className="text-sm text-muted-foreground">Leave a score at 0 when this feat does not change it.</p>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
          {ABILITIES.map(([ability, label, abbreviation], index) => (
            <div key={ability} className="space-y-2">
              <Label htmlFor={`feat-ability-${ability}`}>{label} ({abbreviation})</Label>
              <Input id={`feat-ability-${ability}`} name={`ability_${ability}`} type="number" min="0" max="5" step="1" defaultValue={data?.scores?.[index] ?? 0} {...errorAttributes(state, `ability_${ability}`)} />
              <FieldErrors state={state} name={`ability_${ability}`} />
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t border-border pt-6">
        <legend className="j-folio mb-3">Optional automation</legend>
        <p className="text-sm text-muted-foreground">These values add only the safe, structured effects supported by the sheet.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="feat-action">Action economy</Label>
            <select id="feat-action" name="action" defaultValue={data?.action ?? ""} className={fieldClassName} {...errorAttributes(state, "action")}>
              <option value="">No action tracked</option>
              <option value="action">Action</option>
              <option value="bonus action">Bonus action</option>
              <option value="reaction">Reaction</option>
              <option value="free">Free</option>
            </select>
            <FieldErrors state={state} name="action" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="feat-extra-ac">Flat AC bonus</Label>
            <Input id="feat-extra-ac" name="extra_ac" type="number" min="-10" max="10" step="1" defaultValue={data?.extraAC ?? 0} {...errorAttributes(state, "extra_ac")} />
            <FieldErrors state={state} name="extra_ac" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="feat-usages">Uses</Label>
            <Input id="feat-usages" name="usages" type="number" min="1" step="1" defaultValue={typeof data?.usages === "number" ? data.usages : ""} {...errorAttributes(state, "usages")} />
            <FieldErrors state={state} name="usages" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="feat-recovery">Recovery</Label>
            <select id="feat-recovery" name="recovery" defaultValue={data?.recovery ?? ""} className={fieldClassName} {...errorAttributes(state, "recovery")}>
              <option value="">No tracked uses</option>
              <option value="short rest">Short rest</option>
              <option value="long rest">Long rest</option>
              <option value="dawn">Dawn</option>
              <option value="day">Day</option>
            </select>
            <FieldErrors state={state} name="recovery" />
          </div>
        </div>
      </fieldset>

      <div className="space-y-3 border-t border-border pt-5">
        {mode === "edit" && (
          <p className="text-sm text-muted-foreground">
            Changes create a new immutable version. Characters already using this feat keep their pinned version.
          </p>
        )}
        {state.status !== "idle" && state.message && (
          <p role="alert" className="text-sm text-destructive">{state.message}</p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link href="/library" className={buttonVariants({ variant: "outline" })}>Cancel</Link>
          {state.status === "conflict" && (
            <Button type="button" variant="outline" onClick={() => window.location.reload()}>Reload latest</Button>
          )}
          <Button type="submit" variant="gold" disabled={pending || state.status === "conflict"}>
            {pending ? "Saving..." : mode === "create" ? "Create private feat" : "Save new version"}
          </Button>
        </div>
      </div>
    </form>
  );
}
