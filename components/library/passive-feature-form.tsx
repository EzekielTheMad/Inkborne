"use client";
import Link from "next/link";
import { unstable_rethrow, useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { createHomebrewPassiveFeature, updateHomebrewPassiveFeature } from "@/app/(app)/homebrew/features/actions";
import { acceptFeatureActionResponse, featureUncertainty, type FeatureActionState } from "@/lib/homebrew/passive-feature-form";
import type { HomebrewPassiveFeatureRecord } from "@/lib/supabase/homebrew-passive-features-server";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props { mode: "create" | "edit"; initialValue?: HomebrewPassiveFeatureRecord }
const idle: FeatureActionState = { status: "idle" };
function preserveDraft(form: HTMLFormElement | null) {
  if (!form) return;
  const preventReset = (event: Event) => event.preventDefault();
  form.addEventListener("reset", preventReset);
  return () => form.removeEventListener("reset", preventReset);
}
function errors(state: FeatureActionState, key: string) { return "fieldErrors" in state ? state.fieldErrors?.[key] : undefined; }
function errorAttributes(state: FeatureActionState, key: string) {
  const invalid = Boolean(errors(state, key)?.length);
  return { "aria-invalid": invalid || undefined, "aria-describedby": invalid ? `feature-${key}-error` : undefined } as const;
}
function FieldErrors({ state, name }: { state: FeatureActionState; name: string }) {
  const messages = errors(state, name);
  return messages?.length ? <p id={`feature-${name}-error`} className="text-xs text-destructive">{messages.join(" ")}</p> : null;
}
export function PassiveFeatureForm({ mode, initialValue }: Props) {
  const router = useRouter();
  const submitting = useRef(false);
  const confirmed = useRef<Extract<FeatureActionState, { status: "saved" }> | null>(null);
  const [acknowledged, setAcknowledged] = useState<FeatureActionState | null>(null);
  const [state, action, pending] = useActionState(async (previous: FeatureActionState, input: FormData): Promise<FeatureActionState> => {
    if (confirmed.current || previous.status === "saved" || previous.status === "conflict"
      || (previous.status === "uncertain" && (mode === "edit" || acknowledged !== previous))) {
      submitting.current = false; return confirmed.current ?? previous;
    }
    let result: FeatureActionState;
    try {
      const response: unknown = await (mode === "create" ? createHomebrewPassiveFeature : updateHomebrewPassiveFeature)(previous, input);
      result = acceptFeatureActionResponse(response, mode, initialValue);
    } catch (error) {
      unstable_rethrow(error); // Preserve genuine framework navigation, never classify it by an invented digest.
      result = featureUncertainty(mode);
    } finally { submitting.current = false; }
    if (result.status === "saved") {
      confirmed.current = result; // Save identity survives any subsequent navigation failure.
      try { router.push(`/homebrew?${mode === "create" ? "created" : "updated"}=${encodeURIComponent(result.id)}`); }
      catch (error) { unstable_rethrow(error); return result; }
    }
    return result;
  }, idle);
  const [fields, setFields] = useState(() => ({ name: initialValue?.name ?? "", description: initialValue?.data.description ?? "",
    class: "", subclass: "", level: "" }));
  const blocked = state.status === "saved" || state.status === "conflict" || (state.status === "uncertain" && (mode === "edit" || acknowledged !== state));
  useEffect(() => {
    if ("fieldErrors" in state) {
      const first = Object.keys(state.fieldErrors ?? {})[0];
      if (first) document.getElementById(`feature-${first}`)?.focus();
    }
  }, [state]);
  function change(key: keyof typeof fields, value: string) { setFields(current => ({ ...current, [key]: value })); }
  return <form action={action} ref={preserveDraft} className="j-card-paper min-w-0 space-y-6 p-5 sm:p-7"
    onSubmit={event => { if (submitting.current || confirmed.current || pending || blocked) event.preventDefault(); else submitting.current = true; }}>
    {initialValue ? <><input type="hidden" name="id" value={initialValue.id} /><input type="hidden" name="expected_version" value={initialValue.version} /></> : null}
    <p className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
      This is a private standalone feature. Class and subclass slugs are descriptive, unverified associations. Saving does not attach it to a class or subclass, grant it to a character, or activate its mechanics.
    </p>
    <fieldset disabled={pending || blocked} className="min-w-0 space-y-4"><legend className="j-folio mb-3">Feature text</legend>
      <div className="space-y-2"><Label htmlFor="feature-name">Name</Label><Input id="feature-name" name="name" value={fields.name} required maxLength={100}
        onChange={event => change("name", event.target.value)} {...errorAttributes(state, "name")} /><FieldErrors state={state} name="name" /></div>
      <div className="space-y-2"><Label htmlFor="feature-description">Description</Label><textarea id="feature-description" name="description" value={fields.description}
        required maxLength={20_000} rows={6} onChange={event => change("description", event.target.value)}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm [overflow-wrap:anywhere]" {...errorAttributes(state, "description")} />
        <FieldErrors state={state} name="description" /></div>
      {mode === "create" ? <fieldset className="space-y-4"><legend className="j-folio mb-3">Descriptive association</legend>
        <p className="text-xs text-muted-foreground">Enter a lowercase slug using letters, numbers and single hyphens. No attachment or entitlement is verified by these labels.</p>
        {([{ key: "class", label: "Class slug", required: true }, { key: "subclass", label: "Subclass slug (optional)", required: false },
          { key: "level", label: "Gain level", required: true }] as const).map(control => <div key={control.key} className="space-y-2">
            <Label htmlFor={`feature-${control.key}`}>{control.label}</Label><Input id={`feature-${control.key}`} name={control.key} value={fields[control.key]} required={control.required}
              maxLength={control.key === "level" ? 2 : 100} inputMode={control.key === "level" ? "numeric" : undefined}
              onChange={event => change(control.key, event.target.value)} {...errorAttributes(state, control.key)} /><FieldErrors state={state} name={control.key} /></div>)}
        <p className="text-xs text-muted-foreground">Gain level must be 1–20. New feature type is Passive; no effects, counters, choices or relations are authored here.</p>
      </fieldset> : initialValue ? <section aria-label="Read-only feature association" className="space-y-2 text-sm [overflow-wrap:anywhere]">
        <h2 className="j-folio">Preserved association and mechanics</h2>
        <dl className="space-y-1"><div><dt className="inline font-medium">Class association: </dt><dd className="inline">{initialValue.data.class}</dd></div>
          <div><dt className="inline font-medium">Subclass association: </dt><dd className="inline">{initialValue.data.subclass === undefined ? "Not present" : initialValue.data.subclass === null ? "None declared" : initialValue.data.subclass}</dd></div>
          <div><dt className="inline font-medium">Gain level: </dt><dd className="inline">{initialValue.data.level}</dd></div>
          <div><dt className="inline font-medium">Feature type: </dt><dd className="inline">{initialValue.data.feature_type ?? "Not declared"}</dd></div></dl>
        <p className="text-xs text-muted-foreground">Only name and description are edited. Original association, mechanics, relations, raw effects, extensions and older versions remain unchanged.</p>
      </section> : null}
    </fieldset>
    {state.status !== "saved" && state.status !== "unchanged" && state.message ? <div role="alert" className="rounded-lg border border-border p-3 text-sm">{state.message}<FieldErrors state={state} name="form" /></div> : null}
    {state.status === "unchanged" ? <p role="status">{state.message} Version {state.version} is unchanged.</p> : null}
    {state.status === "saved" ? <p role="status">Feature saved as version {state.version}. <Link href="/homebrew">Open Homebrew</Link></p> : null}
    {state.status === "uncertain" && mode === "create" ? <div className="space-y-3 text-sm"><Link href="/homebrew" className={buttonVariants({ variant: "outline" })}>Check Homebrew</Link>
      <p>Another create may make a separate feature. Your draft is kept here; navigating away can lose it.</p>
      <Button type="button" variant="outline" disabled={acknowledged === state} onClick={() => setAcknowledged(state)}>I checked Homebrew; allow another create</Button></div> : null}
    {mode === "edit" && (state.status === "uncertain" || state.status === "conflict") ? <div className="space-y-2 text-sm"><p>Reload latest discards this unsaved draft and loads the stored version.</p>
      <Button type="button" variant="outline" onClick={() => window.location.reload()}>Reload latest</Button><Link href="/homebrew" className="ml-3 underline">Check Homebrew</Link></div> : null}
    <div className="flex flex-wrap gap-3"><Button type="submit" disabled={pending || blocked}>{pending ? "Saving…" : mode === "create" ? "Create private passive feature" : "Save new version"}</Button>
      <Link href="/homebrew" className={buttonVariants({ variant: "outline" })}>Back to Homebrew</Link></div>
  </form>;
}
