"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  createHomebrewSpell,
  updateHomebrewSpell,
  type HomebrewSpellActionState,
} from "@/app/(app)/library/spells/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SpellData } from "@/lib/schemas/content-types/spell";
import { DAMAGE_TYPES, MAGIC_SCHOOLS } from "@/lib/types/taxonomies";

interface SpellFormInitialValue {
  id: string;
  name: string;
  version: number;
  data: SpellData;
}

interface SpellFormProps {
  mode: "create" | "edit";
  classes: Array<{ slug: string; name: string }>;
  initialValue?: SpellFormInitialValue;
}

const emptyState: HomebrewSpellActionState = { status: "idle", message: "" };
const fieldClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const textareaClassName =
  "w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function firstExpression(table: Record<string, string> | null | undefined): string {
  if (!table) return "";
  return Object.entries(table).sort(([a], [b]) => Number(a) - Number(b))[0]?.[1] ?? "";
}

function FieldErrors({ state, name }: { state: HomebrewSpellActionState; name: string }) {
  const errors = state.fieldErrors?.[name];
  if (!errors?.length) return null;
  return <p className="text-xs text-destructive">{errors.join(" ")}</p>;
}

export function SpellForm({ mode, classes, initialValue }: SpellFormProps) {
  const action = mode === "create" ? createHomebrewSpell : updateHomebrewSpell;
  const [state, formAction, pending] = useActionState(action, emptyState);
  const data = initialValue?.data;
  const [hasMaterial, setHasMaterial] = useState(data?.components.includes("M") ?? false);

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
          <Label htmlFor="spell-name">Name</Label>
          <Input id="spell-name" name="name" defaultValue={initialValue?.name} maxLength={100} required />
          <FieldErrors state={state} name="name" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="spell-level">Level</Label>
            <select id="spell-level" name="level" defaultValue={String(data?.level ?? 0)} className={fieldClassName}>
              <option value="0">Cantrip</option>
              {Array.from({ length: 9 }, (_, index) => index + 1).map((level) => (
                <option key={level} value={level}>Level {level}</option>
              ))}
            </select>
            <FieldErrors state={state} name="level" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="spell-school">School</Label>
            <select id="spell-school" name="school" defaultValue={data?.school ?? "evocation"} className={fieldClassName}>
              {MAGIC_SCHOOLS.map((school) => (
                <option key={school} value={school}>{school[0].toUpperCase() + school.slice(1)}</option>
              ))}
            </select>
            <FieldErrors state={state} name="school" />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t border-border pt-6">
        <legend className="j-folio mb-3">Casting</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="spell-casting-time">Casting time</Label>
            <Input id="spell-casting-time" name="casting_time" defaultValue={data?.casting_time} maxLength={120} required />
            <FieldErrors state={state} name="casting_time" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="spell-range">Range</Label>
            <Input id="spell-range" name="range" defaultValue={data?.range} maxLength={120} required />
            <FieldErrors state={state} name="range" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="spell-duration">Duration</Label>
            <Input id="spell-duration" name="duration" defaultValue={data?.duration} maxLength={120} required />
            <FieldErrors state={state} name="duration" />
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium">Components</span>
          <div className="flex flex-wrap gap-5">
            {(["V", "S", "M"] as const).map((component) => (
              <label key={component} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="components"
                  value={component}
                  defaultChecked={data?.components.includes(component) ?? component !== "M"}
                  onChange={component === "M" ? (event) => setHasMaterial(event.target.checked) : undefined}
                />
                {component}
              </label>
            ))}
          </div>
          <FieldErrors state={state} name="components" />
        </div>

        {hasMaterial && (
          <div className="space-y-2">
            <Label htmlFor="spell-material">Material</Label>
            <Input id="spell-material" name="material" defaultValue={data?.material} maxLength={500} required />
            <FieldErrors state={state} name="material" />
          </div>
        )}

        <div className="flex flex-wrap gap-5">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="concentration" defaultChecked={data?.concentration} />
            Concentration
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="ritual" defaultChecked={data?.ritual} />
            Ritual
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t border-border pt-6">
        <legend className="j-folio mb-3">Description</legend>
        <div className="space-y-2">
          <Label htmlFor="spell-description">Spell description</Label>
          <textarea id="spell-description" name="description" defaultValue={data?.description} rows={8} maxLength={20000} className={textareaClassName} required />
          <FieldErrors state={state} name="description" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="spell-higher-level">At higher levels</Label>
          <textarea id="spell-higher-level" name="higher_level" defaultValue={data?.higher_level} rows={4} maxLength={10000} className={textareaClassName} />
          <FieldErrors state={state} name="higher_level" />
        </div>
      </fieldset>

      <fieldset className="space-y-3 border-t border-border pt-6">
        <legend className="j-folio mb-3">Classes</legend>
        <p className="text-sm text-muted-foreground">Choose each class that can discover this spell.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {classes.map((classOption) => (
            <label key={classOption.slug} className="flex items-center gap-2 rounded-md border border-border/70 px-3 py-2 text-sm">
              <input type="checkbox" name="classes" value={classOption.slug} defaultChecked={data?.classes.includes(classOption.slug)} />
              {classOption.name}
            </label>
          ))}
        </div>
        <FieldErrors state={state} name="classes" />
      </fieldset>

      <details className="border-t border-border pt-6">
        <summary className="j-folio cursor-pointer select-none">Optional automation</summary>
        <p className="mt-2 text-sm text-muted-foreground">
          Add structured rolls and saves so the existing cast dialog can automate this spell.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="spell-attack-type">Spell attack</Label>
            <select id="spell-attack-type" name="attack_type" defaultValue={data?.attack_type ?? ""} className={fieldClassName}>
              <option value="">No spell attack</option>
              <option value="melee">Melee spell attack</option>
              <option value="ranged">Ranged spell attack</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="spell-damage-type">Damage type</Label>
            <select id="spell-damage-type" name="damage_type" defaultValue={data?.damage?.type ?? ""} className={fieldClassName}>
              <option value="">Varies / unspecified</option>
              {DAMAGE_TYPES.map((damageType) => <option key={damageType} value={damageType}>{damageType}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="spell-damage-dice">Damage dice</Label>
            <Input id="spell-damage-dice" name="damage_dice" defaultValue={firstExpression(data?.damage?.dice_at_slot_level)} placeholder="2d6+3" />
            <FieldErrors state={state} name="damage_dice" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="spell-healing-dice">Healing dice</Label>
            <Input id="spell-healing-dice" name="healing_dice" defaultValue={firstExpression(data?.heal_at_slot_level)} placeholder="1d8+MOD" />
            <FieldErrors state={state} name="healing_dice" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="spell-save-type">Saving throw ability</Label>
            <Input id="spell-save-type" name="save_type" defaultValue={data?.dc?.type} placeholder="dexterity" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="spell-save-success">On a successful save</Label>
            <select id="spell-save-success" name="save_success" defaultValue={data?.dc?.success ?? "none"} className={fieldClassName}>
              <option value="none">No effect</option>
              <option value="half">Half effect</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="spell-area-type">Area shape</Label>
            <select id="spell-area-type" name="area_type" defaultValue={data?.area_of_effect?.type ?? ""} className={fieldClassName}>
              <option value="">No area</option>
              {(["sphere", "cone", "cylinder", "line", "cube"] as const).map((shape) => (
                <option key={shape} value={shape}>{shape}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="spell-area-size">Area size in feet</Label>
            <Input id="spell-area-size" name="area_size" type="number" min="1" step="1" defaultValue={data?.area_of_effect?.size} />
          </div>
        </div>
      </details>

      <div className="space-y-3 border-t border-border pt-5">
        {mode === "edit" && (
          <p className="text-sm text-muted-foreground">
            Saving creates version {(initialValue?.version ?? 0) + 1}. Characters already using this spell keep their pinned version.
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
            {pending ? "Saving..." : mode === "create" ? "Create private spell" : "Save new version"}
          </Button>
        </div>
      </div>
    </form>
  );
}
