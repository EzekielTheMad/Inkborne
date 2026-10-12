"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createHomebrewRace, updateHomebrewRace, type HomebrewRaceActionState } from "@/app/(app)/homebrew/races/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RaceData } from "@/lib/schemas/content-types/race";
import { CREATURE_SIZES } from "@/lib/types/taxonomies";

interface RaceFormProps {
  mode: "create" | "edit";
  initialValue?: { id: string; name: string; version: number; data: RaceData; walkingEditable: boolean };
}
const emptyState: HomebrewRaceActionState = { status: "idle", message: "" };
const descriptions = [
  { key: "age_description", label: "Age description" },
  { key: "alignment_description", label: "Alignment description" },
  { key: "size_description", label: "Size description" },
  { key: "language_description", label: "Language description" },
] as const;
function errorAttributes(state: HomebrewRaceActionState, name: string) {
  const invalid = Boolean(state.fieldErrors?.[name]?.length);
  return { "aria-invalid": invalid || undefined, "aria-describedby": invalid ? `race-${name}-error` : undefined } as const;
}
function FieldErrors({ state, name }: { state: HomebrewRaceActionState; name: string }) {
  const errors = state.fieldErrors?.[name];
  return errors?.length ? <p id={`race-${name}-error`} className="text-xs text-destructive">{errors.join(" ")}</p> : null;
}
function preserveFormDraft(form: HTMLFormElement | null) {
  if (!form) return;
  const preventReset = (event: Event) => event.preventDefault();
  form.addEventListener("reset", preventReset);
  return () => form.removeEventListener("reset", preventReset);
}

export function RaceForm({ mode, initialValue }: RaceFormProps) {
  const [state, formAction, pending] = useActionState(mode === "create" ? createHomebrewRace : updateHomebrewRace, emptyState);
  const walkingEditable = mode === "create" || initialValue?.walkingEditable === true;
  const [fields, setFields] = useState(() => ({
    name: initialValue?.name ?? "", size: initialValue?.data.size ?? "", speed: initialValue?.data.speed.toString() ?? "",
    age_description: initialValue?.data.age_description ?? "", alignment_description: initialValue?.data.alignment_description ?? "",
    size_description: initialValue?.data.size_description ?? "", language_description: initialValue?.data.language_description ?? "",
  }));
  function setField(key: keyof typeof fields, value: string) { setFields((current) => ({ ...current, [key]: value })); }
  return (
    <form action={formAction} ref={preserveFormDraft} className="j-card-paper space-y-7 p-5 sm:p-7">
      {initialValue ? <>
        <input type="hidden" name="id" value={initialValue.id} />
        <input type="hidden" name="expected_version" value={initialValue.version} />
      </> : null}
      <fieldset className="space-y-4">
        <legend className="j-folio mb-3">Race details</legend>
        <div className="space-y-2">
          <Label htmlFor="race-name">Name</Label>
          <Input id="race-name" name="name" value={fields.name} onChange={(event) => setField("name", event.target.value)} required maxLength={100} {...errorAttributes(state, "name")} />
          <FieldErrors state={state} name="name" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="race-size">Size</Label>
            <select id="race-size" name="size" value={fields.size} onChange={(event) => setField("size", event.target.value)} required
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" {...errorAttributes(state, "size")}>
              <option value="">Choose a size</option>
              {CREATURE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
            <FieldErrors state={state} name="size" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="race-speed">Walking speed (ft.)</Label>
            <Input id="race-speed" name={walkingEditable ? "speed" : undefined} value={fields.speed}
              onChange={(event) => setField("speed", event.target.value)} inputMode="numeric" maxLength={30}
              disabled={!walkingEditable} required={walkingEditable} {...errorAttributes(state, "speed")} />
            <FieldErrors state={state} name="speed" />
          </div>
        </div>
        {!walkingEditable ? <p className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
          Walking speed is read-only for this record because its editing annotation or movement effects are ambiguous. Existing walking values and all effects are preserved.
        </p> : null}
        {!walkingEditable && initialValue?.data.speed_detail?.walk !== undefined && initialValue.data.speed_detail.walk !== initialValue.data.speed ?
          <p className="text-xs text-muted-foreground">Stored flat speed: {initialValue.data.speed} ft. Walking detail: {initialValue.data.speed_detail.walk} ft. Both remain unchanged.</p> : null}
        {descriptions.map((control) => <div key={control.key} className="space-y-2">
          <Label htmlFor={`race-${control.key}`}>{control.label}</Label>
          <textarea id={`race-${control.key}`} name={control.key} value={fields[control.key]} onChange={(event) => setField(control.key, event.target.value)} rows={3} maxLength={20_000}
            className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" {...errorAttributes(state, control.key)} />
          <FieldErrors state={state} name={control.key} />
        </div>)}
        <p className="text-xs text-muted-foreground">Size and descriptions are recorded details. Language descriptions do not grant languages. This form authors only walking speed mechanics; ability bonuses, traits, subraces, grants, and advanced movement are not created here.</p>
        {mode === "edit" ? <p className="text-xs text-muted-foreground">Existing imported mechanics and links are retained. Their calculation and trait-version limitations are not repaired by these edits.</p> : null}
      </fieldset>
      <div className="space-y-3 border-t border-border pt-5">
        {mode === "edit" ? <p className="text-sm text-muted-foreground">Changes create a new immutable version. Existing character pins keep their saved version.</p> : null}
        {state.status !== "idle" && state.message ? <p role="alert" className="text-sm text-destructive">{state.message}</p> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link href="/homebrew" className={buttonVariants({ variant: "outline" })}>Cancel</Link>
          {state.status === "conflict" ? <Button type="button" variant="outline" onClick={() => window.location.reload()}>Reload latest</Button> : null}
          <Button type="submit" variant="gold" disabled={pending || state.status === "conflict"}>{pending ? "Saving..." : mode === "create" ? "Create private race" : "Save new version"}</Button>
        </div>
      </div>
    </form>
  );
}
