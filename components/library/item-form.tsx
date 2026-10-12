"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { createHomebrewItem, updateHomebrewItem, type HomebrewItemActionState } from "@/app/(app)/homebrew/items/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ItemData } from "@/lib/schemas/content-types/item";

interface ItemFormProps {
  mode: "create" | "edit";
  initialValue?: { id: string; name: string; version: number; data: ItemData };
}

const emptyState: HomebrewItemActionState = { status: "idle", message: "" };
const controls = [
  { key: "name", label: "Name", maxLength: 100, required: true },
  { key: "equipment_category", label: "Equipment category", maxLength: 100 },
  { key: "cost_quantity", label: "Cost quantity", numeric: true },
  { key: "cost_unit", label: "Cost unit", maxLength: 20 },
  { key: "weight", label: "Weight (lb.)", numeric: true },
] as const;

function errorAttributes(state: HomebrewItemActionState, name: string) {
  const invalid = Boolean(state.fieldErrors?.[name]?.length);
  return { "aria-invalid": invalid || undefined, "aria-describedby": invalid ? `item-${name}-error` : undefined } as const;
}

function FieldErrors({ state, name }: { state: HomebrewItemActionState; name: string }) {
  const errors = state.fieldErrors?.[name];
  return errors?.length ? <p id={`item-${name}-error`} className="text-xs text-destructive">{errors.join(" ")}</p> : null;
}

function preserveFormDraft(form: HTMLFormElement | null) {
  if (!form) return;
  // React resets settled action forms during commit. Preserve explicit retry drafts.
  const preventReset = (event: Event) => event.preventDefault();
  form.addEventListener("reset", preventReset);
  return () => form.removeEventListener("reset", preventReset);
}

export function ItemForm({ mode, initialValue }: ItemFormProps) {
  const [state, formAction, pending] = useActionState(mode === "create" ? createHomebrewItem : updateHomebrewItem, emptyState);
  const [draftIdentity] = useState(() => ({ mode, id: initialValue?.id, version: initialValue?.version }));
  const staleDraft = mode !== draftIdentity.mode || (mode === "edit" && (!initialValue
    || initialValue.id !== draftIdentity.id || initialValue.version !== draftIdentity.version));
  const [fields, setFields] = useState(() => ({
    name: initialValue?.name ?? "",
    equipment_category: initialValue?.data.equipment_category ?? "",
    description: initialValue?.data.description ?? "",
    cost_quantity: initialValue?.data.cost?.quantity.toString() ?? "",
    cost_unit: initialValue?.data.cost?.unit ?? "",
    weight: initialValue?.data.weight?.toString() ?? "",
  }));
  function setField(key: keyof typeof fields, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }
  return (
    <form action={formAction} onSubmit={event => { if (staleDraft) event.preventDefault(); }} ref={preserveFormDraft} className="j-card-paper space-y-7 p-5 sm:p-7">
      {draftIdentity.mode === "edit" ? <>
        <input type="hidden" name="id" value={draftIdentity.id ?? ""} />
        <input type="hidden" name="expected_version" value={draftIdentity.version ?? ""} />
      </> : null}
      <fieldset className="space-y-4">
        <legend className="j-folio mb-3">Item details</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {controls.map((control) => <div key={control.key} className="space-y-2">
            <Label htmlFor={`item-${control.key}`}>{control.label}</Label>
            <Input id={`item-${control.key}`} name={control.key} value={fields[control.key]}
              onChange={(event) => setField(control.key, event.target.value)}
              maxLength={"maxLength" in control ? control.maxLength : 30}
              required={"required" in control && control.required}
              inputMode={"numeric" in control ? "decimal" : undefined}
              {...errorAttributes(state, control.key)} />
            <FieldErrors state={state} name={control.key} />
          </div>)}
        </div>
        <p className="text-xs text-muted-foreground">Cost and weight are optional. Enter both a quantity and unit for cost.</p>
        <div className="space-y-2">
          <Label htmlFor="item-description">Item description</Label>
          <textarea id="item-description" name="description" value={fields.description}
            onChange={(event) => setField("description", event.target.value)} rows={10} maxLength={20_000}
            className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            {...errorAttributes(state, "description")} />
          <FieldErrors state={state} name="description" />
        </div>
      </fieldset>
      <div className="space-y-3 border-t border-border pt-5">
        {mode === "edit" ? <p className="text-sm text-muted-foreground">Changes create a new immutable version. Existing character inventory pins keep their saved version.</p> : null}
        {state.status !== "idle" && state.message ? <p role="alert" className="text-sm text-destructive">{state.message}</p> : null}
        {staleDraft ? <p role="alert" className="text-sm text-destructive">The saved item or campaign access changed. Your draft is preserved; reload latest before saving.</p> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link href="/homebrew" className={buttonVariants({ variant: "outline" })}>Cancel</Link>
          {staleDraft || state.status === "conflict" ? <Button type="button" variant="outline" onClick={() => window.location.reload()}>Reload latest</Button> : null}
          <Button type="submit" variant="gold" disabled={pending || staleDraft || state.status === "conflict"}>
            {pending ? "Saving..." : mode === "create" ? "Create private item" : "Save new version"}
          </Button>
        </div>
      </div>
    </form>
  );
}
