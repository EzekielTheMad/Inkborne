"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createHomebrewTrait, updateHomebrewTrait } from "@/app/(app)/homebrew/traits/actions";
import { homebrewTraitActionStateSchema, TRAIT_UNCERTAIN_MESSAGE, type HomebrewTraitActionState } from "@/lib/homebrew/trait-form";
import type { TraitData } from "@/lib/schemas/content-types/trait";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TraitFormProps {
  mode: "create" | "edit";
  initialValue?: { id: string; name: string; version: number; data: TraitData; resourceEditable: boolean };
}
const idle: HomebrewTraitActionState = { status: "idle" };
function preserveFormDraft(form: HTMLFormElement | null) {
  if (!form) return;
  const preventReset = (event: Event) => event.preventDefault();
  form.addEventListener("reset", preventReset);
  return () => form.removeEventListener("reset", preventReset);
}
function fieldError(state: HomebrewTraitActionState, name: string) {
  return state.status === "saved" ? undefined : state.fieldErrors?.[name];
}
function errorAttributes(state: HomebrewTraitActionState, name: string) {
  const invalid = Boolean(fieldError(state, name)?.length);
  return { "aria-invalid": invalid || undefined, "aria-describedby": invalid ? `trait-${name}-error` : undefined } as const;
}
function FieldErrors({ state, name }: { state: HomebrewTraitActionState; name: string }) {
  const errors = fieldError(state, name);
  return errors?.length ? <p id={`trait-${name}-error`} className="text-xs text-destructive">{errors.join(" ")}</p> : null;
}
export function TraitForm({ mode, initialValue }: TraitFormProps) {
  const router = useRouter();
  const submitting = useRef(false);
  const [acknowledged, setAcknowledged] = useState<HomebrewTraitActionState | null>(null);
  const [state, formAction, pending] = useActionState(async (previous: HomebrewTraitActionState, form: FormData): Promise<HomebrewTraitActionState> => {
    if (previous.status === "saved" || previous.status === "conflict" || (previous.status === "uncertain" && (mode === "edit" || acknowledged !== previous))) {
      submitting.current = false;
      return previous;
    }
    let result: HomebrewTraitActionState;
    try {
      const response: unknown = await (mode === "create" ? createHomebrewTrait : updateHomebrewTrait)(previous, form);
      const parsed = homebrewTraitActionStateSchema.safeParse(response);
      result = parsed.success && parsed.data.status !== "idle" ? parsed.data : { status: "uncertain", message: mode === "create" ? TRAIT_UNCERTAIN_MESSAGE : "The save could not be confirmed. Your draft is kept. Reload this trait before saving again." };
    } catch {
      result = { status: "uncertain", message: mode === "create" ? TRAIT_UNCERTAIN_MESSAGE : "The save could not be confirmed. Your draft is kept. Reload this trait before saving again." };
    } finally { submitting.current = false; }
    if (result.status === "saved") {
      // A navigation failure does not turn a confirmed saved row into another INSERT.
      try { router.push(`/homebrew?${mode === "create" ? "created" : "updated"}=${encodeURIComponent(result.id)}`); } catch { return result; }
    }
    return result;
  }, idle);
  const editable = mode === "create" || initialValue?.resourceEditable === true;
  const [fields, setFields] = useState(() => ({ name: initialValue?.name ?? "", description: initialValue?.data.description ?? "",
    usages: typeof initialValue?.data.usages === "number" ? initialValue.data.usages.toString() : "",
    recovery: initialValue?.data.recovery ?? "" }));
  const blocked = state.status === "saved" || state.status === "conflict" || (state.status === "uncertain" && (mode === "edit" || acknowledged !== state));
  useEffect(() => {
    if (state.status === "error") {
      const first = Object.keys(state.fieldErrors ?? {})[0];
      if (first) document.getElementById(`trait-${first}`)?.focus();
    }
  }, [state]);
  function change(key: keyof typeof fields, value: string) { setFields(current => ({ ...current, [key]: value })); }
  return <form action={formAction} ref={preserveFormDraft} className="j-card-paper space-y-7 p-5 sm:p-7"
    onSubmit={event => { if (submitting.current || blocked || pending) event.preventDefault(); else submitting.current = true; }}>
    {initialValue ? <><input type="hidden" name="id" value={initialValue.id} /><input type="hidden" name="expected_version" value={initialValue.version} /></> : null}
    <fieldset className="space-y-4">
      <legend className="j-folio mb-3">Trait details</legend>
      <div className="space-y-2"><Label htmlFor="trait-name">Name</Label>
        <Input id="trait-name" name="name" value={fields.name} onChange={event => change("name", event.target.value)} required maxLength={100} {...errorAttributes(state, "name")} />
        <FieldErrors state={state} name="name" /></div>
      <div className="space-y-2"><Label htmlFor="trait-description">Description</Label>
        <textarea id="trait-description" name="description" value={fields.description} onChange={event => change("description", event.target.value)} required maxLength={20_000} rows={5}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" {...errorAttributes(state, "description")} />
        <FieldErrors state={state} name="description" /></div>
    </fieldset>
    <fieldset className="space-y-4"><legend className="j-folio mb-3">Limited uses</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="trait-usages">Uses</Label>
          <Input id="trait-usages" name={editable ? "usages" : undefined} value={fields.usages} disabled={!editable} inputMode="numeric" maxLength={16}
            onChange={event => change("usages", event.target.value)} {...errorAttributes(state, "usages")} /><FieldErrors state={state} name="usages" /></div>
        <div className="space-y-2"><Label htmlFor="trait-recovery">Recovery</Label>
          <select id="trait-recovery" name={editable ? "recovery" : undefined} value={fields.recovery} disabled={!editable} onChange={event => change("recovery", event.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm" {...errorAttributes(state, "recovery")}>
            <option value="">None</option><option value="short rest">Short rest</option><option value="long rest">Long rest</option>
            {!editable && (fields.recovery === "dawn" || fields.recovery === "day") ? <option value={fields.recovery}>{fields.recovery === "dawn" ? "Dawn" : "Day"} (currently long rest)</option> : null}
          </select><FieldErrors state={state} name="recovery" /></div>
      </div>
      {editable ? <p className="text-xs text-muted-foreground">Leave uses blank for an unspecified counter. Zero is saved as zero and creates no primary counter. Positive uses need short or long rest recovery.</p>
        : <p className="rounded-lg border border-border p-3 text-sm text-muted-foreground">Limited uses and recovery are read-only for this trait. Its per-level, unsupported, or incomplete counter is retained.
          {Array.isArray(initialValue?.data.usages) ? " It has per-level uses." : null}
          {fields.recovery === "dawn" || fields.recovery === "day" ? " Dawn and day counters currently recover on a long rest." : null}</p>}
      {!editable && Array.isArray(initialValue?.data.usages) ? <p className="break-words text-xs text-muted-foreground">Uses by level 1–20: {initialValue.data.usages.map(value => value ?? "none").join(", ")}.</p> : null}
      <p className="text-xs text-muted-foreground">This saves a private standalone trait. It does not attach the trait to a race or apply it to a character. Existing links and effects are retained when editing.</p>
    </fieldset>
    {state.status !== "saved" && state.message ? <div role="alert" className="rounded-lg border border-border p-3 text-sm">{state.message}</div> : null}
    {state.status === "uncertain" && mode === "create" ? <div className="space-y-3 text-sm">
      <Link href="/homebrew" className={buttonVariants({ variant: "outline" })}>Check Homebrew</Link>
      <p>Another submission may create a separate trait. Your draft is kept on this page; navigating away can lose it.</p>
      <Button type="button" variant="outline" disabled={acknowledged === state} onClick={() => setAcknowledged(state)}>I checked Homebrew; allow another create</Button>
    </div> : null}
    {state.status === "saved" ? <p role="status">Trait saved. <Link href="/homebrew">Open Homebrew</Link></p> : null}
    <div className="flex flex-wrap gap-3">
      <Button type="submit" disabled={pending || blocked}>{pending ? "Saving…" : mode === "create" ? "Create private trait" : "Save new version"}</Button>
      {mode === "edit" && (state.status === "conflict" || state.status === "uncertain") ? <Button type="button" variant="outline" onClick={() => window.location.reload()}>Reload latest</Button> : null}
      <Link href="/homebrew" className={buttonVariants({ variant: "outline" })}>Back to Homebrew</Link>
    </div>
  </form>;
}
