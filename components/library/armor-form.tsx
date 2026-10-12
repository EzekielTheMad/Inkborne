"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { createHomebrewArmor, updateHomebrewArmor, type HomebrewArmorActionState } from "@/app/(app)/homebrew/armors/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ArmorData } from "@/lib/schemas/content-types/armor";
import { ARMOR_CATEGORIES } from "@/lib/types/taxonomies";

interface ArmorFormProps {
  mode: "create" | "edit";
  initialValue?: { id: string; name: string; version: number; data: ArmorData };
}

const emptyState: HomebrewArmorActionState = { status: "idle", message: "" };
const controls = [
  { key: "armor_class_base", label: "Base armor class", required: true },
  { key: "max_bonus", label: "Maximum Dexterity bonus" },
  { key: "str_minimum", label: "Minimum Strength" },
  { key: "cost_quantity", label: "Cost quantity", decimal: true },
  { key: "cost_unit", label: "Cost unit", text: true },
  { key: "weight", label: "Weight (lb.)", decimal: true },
] as const;

function errorAttributes(state: HomebrewArmorActionState, name: string) {
  const invalid = Boolean(state.fieldErrors?.[name]?.length);
  return { "aria-invalid": invalid || undefined, "aria-describedby": invalid ? `armor-${name}-error` : undefined } as const;
}
function FieldErrors({ state, name }: { state: HomebrewArmorActionState; name: string }) {
  const errors = state.fieldErrors?.[name];
  return errors?.length ? <p id={`armor-${name}-error`} className="text-xs text-destructive">{errors.join(" ")}</p> : null;
}
function preserveFormDraft(form: HTMLFormElement | null) {
  if (!form) return;
  // React resets action forms during commit. Retain explicit retry drafts.
  const preventReset = (event: Event) => event.preventDefault();
  form.addEventListener("reset", preventReset);
  return () => form.removeEventListener("reset", preventReset);
}

export function ArmorForm({ mode, initialValue }: ArmorFormProps) {
  const [state, formAction, pending] = useActionState(mode === "create" ? createHomebrewArmor : updateHomebrewArmor, emptyState);
  const [fields, setFields] = useState(() => ({
    name: initialValue?.name ?? "",
    armor_category: initialValue?.data.armor_category ?? "Light",
    armor_class_base: initialValue?.data.armor_class.base.toString() ?? "",
    dex_bonus: initialValue?.data.armor_class.dex_bonus ?? false,
    max_bonus: initialValue?.data.armor_class.max_bonus?.toString() ?? "",
    str_minimum: initialValue?.data.str_minimum.toString() ?? "",
    cost_quantity: initialValue?.data.cost?.quantity.toString() ?? "",
    cost_unit: initialValue?.data.cost?.unit ?? "",
    weight: initialValue?.data.weight?.toString() ?? "",
    stealth_disadvantage: initialValue?.data.stealth_disadvantage ?? false,
  }));
  function setField<K extends keyof typeof fields>(key: K, value: typeof fields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
  }
  return (
    <form action={formAction} ref={preserveFormDraft} className="j-card-paper space-y-7 p-5 sm:p-7">
      {initialValue ? <>
        <input type="hidden" name="id" value={initialValue.id} />
        <input type="hidden" name="expected_version" value={initialValue.version} />
      </> : null}
      <fieldset className="space-y-4">
        <legend className="j-folio mb-3">Armor details</legend>
        <div className="space-y-2">
          <Label htmlFor="armor-name">Name</Label>
          <Input id="armor-name" name="name" value={fields.name} onChange={(event) => setField("name", event.target.value)}
            maxLength={100} required {...errorAttributes(state, "name")} />
          <FieldErrors state={state} name="name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="armor-category">Armor category</Label>
          <select id="armor-category" name="armor_category" value={fields.armor_category}
            onChange={(event) => setField("armor_category", event.target.value as ArmorData["armor_category"])}
            className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            {...errorAttributes(state, "armor_category")}>
            {ARMOR_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <FieldErrors state={state} name="armor_category" />
        </div>
        {fields.armor_category === "Shield" ? <p className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
          For a shield, base armor class is its AC bonus. Shield bonuses are saved here, but equipping a shield does not currently add this number to sheet AC.
        </p> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {controls.map((control) => <div key={control.key} className="space-y-2">
            <Label htmlFor={`armor-${control.key}`}>{control.label}</Label>
            <Input id={`armor-${control.key}`} name={control.key} value={fields[control.key]}
              onChange={(event) => setField(control.key, event.target.value)}
              maxLength={"text" in control ? 20 : 30}
              inputMode={"text" in control ? undefined : "decimal" in control ? "decimal" : "numeric"}
              required={"required" in control && control.required}
              {...errorAttributes(state, control.key)} />
            <FieldErrors state={state} name={control.key} />
          </div>)}
        </div>
        <div className="flex items-center gap-2">
          <input id="armor-dex-bonus" type="checkbox" name="dex_bonus" checked={fields.dex_bonus}
            onChange={(event) => setField("dex_bonus", event.target.checked)} className="size-4 accent-accent" />
          <Label htmlFor="armor-dex-bonus">Add Dexterity modifier</Label>
        </div>
        <div className="flex items-center gap-2">
          <input id="armor-stealth-disadvantage" type="checkbox" name="stealth_disadvantage" checked={fields.stealth_disadvantage}
            onChange={(event) => setField("stealth_disadvantage", event.target.checked)} className="size-4 accent-accent" />
          <Label htmlFor="armor-stealth-disadvantage">Stealth disadvantage</Label>
        </div>
        <p className="text-xs text-muted-foreground">Leave the Dexterity cap blank for no cap. Blank minimum Strength means no requirement. Cost and weight are optional; cost needs both a quantity and unit.</p>
        <p className="text-xs text-muted-foreground">Minimum Strength and stealth disadvantage are recorded armor details; they do not automatically change movement or rolls. Existing imported metadata and mechanical effects are preserved when editing.</p>
      </fieldset>
      <div className="space-y-3 border-t border-border pt-5">
        {mode === "edit" ? <p className="text-sm text-muted-foreground">Changes create a new immutable version. Existing character inventory pins keep their saved version.</p> : null}
        {state.status !== "idle" && state.message ? <p role="alert" className="text-sm text-destructive">{state.message}</p> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link href="/homebrew" className={buttonVariants({ variant: "outline" })}>Cancel</Link>
          {state.status === "conflict" ? <Button type="button" variant="outline" onClick={() => window.location.reload()}>Reload latest</Button> : null}
          <Button type="submit" variant="gold" disabled={pending || state.status === "conflict"}>
            {pending ? "Saving..." : mode === "create" ? "Create private armor" : "Save new version"}
          </Button>
        </div>
      </div>
    </form>
  );
}
