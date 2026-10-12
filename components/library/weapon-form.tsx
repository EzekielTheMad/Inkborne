"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { createHomebrewWeapon, updateHomebrewWeapon, type HomebrewWeaponActionState } from "@/app/(app)/homebrew/weapons/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DAMAGE_TYPES, WEAPON_CATEGORIES, WEAPON_PROPERTIES, WEAPON_RANGE_TYPES } from "@/lib/types/taxonomies";
import type { WeaponData } from "@/lib/schemas/content-types/weapon";

interface WeaponFormProps {
  mode: "create" | "edit";
  initialValue?: { id: string; name: string; version: number; data: WeaponData };
}

const emptyState: HomebrewWeaponActionState = { status: "idle", message: "" };
const controls = [
  { key: "name", label: "Name", maxLength: 100, required: true },
  { key: "cost_quantity", label: "Cost quantity", numeric: true },
  { key: "cost_unit", label: "Cost unit", maxLength: 20 },
  { key: "weight", label: "Weight (lb.)", numeric: true },
  { key: "damage_dice", label: "Damage expression", maxLength: 100, required: true },
  { key: "range_normal", label: "Normal range (ft.)", numeric: true },
  { key: "range_long", label: "Long range (ft.)", numeric: true },
  { key: "two_handed_damage_dice", label: "Two-handed damage expression", maxLength: 100 },
] as const;

function errorAttributes(state: HomebrewWeaponActionState, name: string) {
  const invalid = Boolean(state.fieldErrors?.[name]?.length);
  return { "aria-invalid": invalid || undefined, "aria-describedby": invalid ? `weapon-${name}-error` : undefined } as const;
}

function FieldErrors({ state, name }: { state: HomebrewWeaponActionState; name: string }) {
  const errors = state.fieldErrors?.[name];
  return errors?.length ? <p id={`weapon-${name}-error`} className="text-xs text-destructive">{errors.join(" ")}</p> : null;
}

function preserveFormDraft(form: HTMLFormElement | null) {
  if (!form) return;
  // React resets settled action forms during commit. Preserve explicit retry drafts.
  const preventReset = (event: Event) => event.preventDefault();
  form.addEventListener("reset", preventReset);
  return () => form.removeEventListener("reset", preventReset);
}

export function WeaponForm({ mode, initialValue }: WeaponFormProps) {
  const [state, formAction, pending] = useActionState(mode === "create" ? createHomebrewWeapon : updateHomebrewWeapon, emptyState);
  const [fields, setFields] = useState(() => ({
    name: initialValue?.name ?? "",
    weapon_category: initialValue?.data.weapon_category ?? "Simple",
    weapon_range: initialValue?.data.weapon_range ?? "Melee",
    damage_dice: initialValue?.data.damage?.dice ?? "",
    damage_type: initialValue?.data.damage?.type ?? "",
    range_normal: initialValue?.data.range?.normal.toString() ?? "",
    range_long: initialValue?.data.range?.long?.toString() ?? "",
    two_handed_damage_dice: initialValue?.data.two_handed_damage?.dice ?? "",
    two_handed_damage_type: initialValue?.data.two_handed_damage?.type ?? "",
    cost_quantity: initialValue?.data.cost?.quantity.toString() ?? "",
    cost_unit: initialValue?.data.cost?.unit ?? "",
    weight: initialValue?.data.weight?.toString() ?? "",
  }));
  const [properties, setProperties] = useState(() => initialValue?.data.properties.filter((property) => WEAPON_PROPERTIES.some((known) => known === property)) ?? []);
  const selects = [
    { key: "weapon_category", label: "Weapon category", options: WEAPON_CATEGORIES },
    { key: "weapon_range", label: "Weapon range", options: WEAPON_RANGE_TYPES },
    { key: "damage_type", label: "Damage type", options: DAMAGE_TYPES, blank: "Choose a damage type" },
    { key: "two_handed_damage_type", label: "Two-handed damage type", options: DAMAGE_TYPES, blank: "None" },
  ] as const;
  function setField(key: keyof typeof fields, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }
  return (
    <form action={formAction} ref={preserveFormDraft} className="j-card-paper space-y-7 p-5 sm:p-7">
      {initialValue ? <>
        <input type="hidden" name="id" value={initialValue.id} />
        <input type="hidden" name="expected_version" value={initialValue.version} />
      </> : null}
      <fieldset className="space-y-4">
        <legend className="j-folio mb-3">Weapon details</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {selects.map((control) => <div key={control.key} className="space-y-2">
            <Label htmlFor={`weapon-${control.key}`}>{control.label}</Label>
            <select id={`weapon-${control.key}`} name={control.key} value={fields[control.key]}
              onChange={(event) => setField(control.key, event.target.value)}
              required={control.key === "damage_type"}
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              {...errorAttributes(state, control.key)}>
              {"blank" in control ? <option value="">{control.blank}</option> : null}
              {control.options.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <FieldErrors state={state} name={control.key} />
          </div>)}
          {controls.map((control) => <div key={control.key} className="space-y-2">
            <Label htmlFor={`weapon-${control.key}`}>{control.label}</Label>
            <Input id={`weapon-${control.key}`} name={control.key} value={fields[control.key]}
              onChange={(event) => setField(control.key, event.target.value)}
              maxLength={"maxLength" in control ? control.maxLength : 30}
              required={"required" in control && control.required}
              inputMode={"numeric" in control ? "decimal" : undefined}
              {...errorAttributes(state, control.key)} />
            <FieldErrors state={state} name={control.key} />
          </div>)}
        </div>
        <p className="text-xs text-muted-foreground">Cost and weight are optional. Enter both a quantity and unit for cost.</p>
        <p className="text-xs text-muted-foreground">Ranged and thrown weapons need a normal range. Two-handed damage is optional; enter both its expression and type.</p>
        <fieldset className="space-y-3">
          <legend className="j-folio mb-2">Weapon properties</legend>
          <div className="grid gap-3 sm:grid-cols-3" {...errorAttributes(state, "properties")}>
            {WEAPON_PROPERTIES.map((property) => <div key={property} className="flex items-center gap-2">
              <input id={`weapon-property-${property}`} type="checkbox" name="properties" value={property}
                checked={properties.includes(property)}
                onChange={(event) => setProperties((current) => event.target.checked ? [...current, property] : current.filter((value) => value !== property))}
                className="size-4 accent-accent" />
              <Label htmlFor={`weapon-property-${property}`}>{property}</Label>
            </div>)}
          </div>
          <FieldErrors state={state} name="properties" />
        </fieldset>
        <p className="text-xs text-muted-foreground">This form authors core weapon details. Ability overrides, monk weapons, ammunition identifiers, base weapons, source references, and mechanical effects are not created here. Existing extensions and effects are preserved when editing.</p>
        {initialValue?.data.properties.some((property) => !WEAPON_PROPERTIES.some((known) => known === property)) ? (
          <p className="text-xs text-muted-foreground">Additional existing properties are preserved: {initialValue.data.properties.filter((property) => !WEAPON_PROPERTIES.some((known) => known === property)).join(", ")}.</p>
        ) : null}
      </fieldset>
      <div className="space-y-3 border-t border-border pt-5">
        {mode === "edit" ? <p className="text-sm text-muted-foreground">Changes create a new immutable version. Existing character inventory pins keep their saved version.</p> : null}
        {state.status !== "idle" && state.message ? <p role="alert" className="text-sm text-destructive">{state.message}</p> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link href="/homebrew" className={buttonVariants({ variant: "outline" })}>Cancel</Link>
          {state.status === "conflict" ? <Button type="button" variant="outline" onClick={() => window.location.reload()}>Reload latest</Button> : null}
          <Button type="submit" variant="gold" disabled={pending || state.status === "conflict"}>
            {pending ? "Saving..." : mode === "create" ? "Create private weapon" : "Save new version"}
          </Button>
        </div>
      </div>
    </form>
  );
}
