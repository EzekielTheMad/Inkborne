"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { createHomebrewMonster, updateHomebrewMonster } from "@/app/(app)/homebrew/monsters/actions";
import { MonsterStatBlock } from "@/components/compendium/monster-stat-block";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MONSTER_CONTROLS, monsterDataToDraft, monsterDraftToData, newMonsterDraft, type MonsterControl, type MonsterDraft, type MonsterDraftObject, type MonsterDraftRow } from "@/lib/homebrew/monster-draft";
import { changedMonsterFields, monsterNameSchema, type MonsterFormState } from "@/lib/homebrew/monster-form";
import { monsterDataSchema, type MonsterData } from "@/lib/schemas/content-types/monster";

const initialState: MonsterFormState = { status: "idle" };
interface MonsterFormProps { mode: "create" | "edit"; initialValue?: { id: string; name: string; version: number; data: MonsterData } }
interface ControlProps {
  control: MonsterControl; value: MonsterDraft | undefined; path: string; prefix: string;
  onChange: (value: MonsterDraft | undefined) => void; newRowId: () => string; errors: Record<string, string[]>;
}
function DraftControl({ control, value, path, prefix, onChange, newRowId, errors }: ControlProps) {
  const id = `${prefix}-${path.replaceAll(".", "-")}`;
  const error = errors[path];
  if (control.kind === "object" || control.kind === "list") {
    const children = control.kind === "object" ? Object.entries(control.fields!).map(([key, field]) =>
      <DraftControl key={key} control={field} value={(value as MonsterDraftObject | undefined)?.[key]} path={`${path}.${key}`} prefix={prefix}
        onChange={(next) => onChange({ ...(value as MonsterDraftObject), [key]: next })} newRowId={newRowId} errors={errors} />)
      : value === undefined ? null : (value as MonsterDraftRow[]).map((row, index, rows) => <div key={row.id} className="min-w-0 space-y-3 rounded-lg border border-border p-3">
        <p className="text-xs text-muted-foreground">{control.item!.label} {index + 1}</p>
        <DraftControl control={control.item!} value={row.value} path={`${path}.${index}`} prefix={prefix}
          onChange={(next) => onChange(rows.map((entry) => entry.id === row.id ? { ...entry, value: next! } : entry))} newRowId={newRowId} errors={errors} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" aria-label={`Move ${control.label} ${index + 1} up`} disabled={index === 0}
            onClick={() => { const next = [...rows]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onChange(next); }}>Move up</Button>
          <Button type="button" variant="outline" size="sm" aria-label={`Move ${control.label} ${index + 1} down`} disabled={index === rows.length - 1}
            onClick={() => { const next = [...rows]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; onChange(next); }}>Move down</Button>
          <Button type="button" variant="outline" size="sm" aria-label={`Remove ${control.label} ${index + 1}`} onClick={() => onChange(rows.filter((entry) => entry.id !== row.id))}>Remove</Button>
        </div>
      </div>);
    return <fieldset className="min-w-0 space-y-3 rounded-lg border border-border p-3" data-error-key={path}>
      <legend className="px-1 text-sm font-medium">{control.label}</legend>
      {control.optional ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value !== undefined}
        onChange={(event) => onChange(event.target.checked ? newMonsterDraft(control) : undefined)} />Include {control.label.toLowerCase()}</label> : null}
      {value !== undefined ? <>
        {children}
        {control.kind === "list" ? <Button type="button" variant="outline" size="sm" disabled={(value as MonsterDraftRow[]).length >= control.max!}
          onClick={() => onChange([...(value as MonsterDraftRow[]), { id: newRowId(), value: newMonsterDraft(control.item!) }])}>Add {control.item!.label.toLowerCase()}</Button> : null}
      </> : null}
      {error ? <p className="text-xs text-destructive" id={`${id}-error`}>{error.join(" ")}</p> : null}
    </fieldset>;
  }
  const attrs = { id, value: typeof value === "string" ? value : "", "aria-invalid": Boolean(error) || undefined,
    "aria-describedby": error ? `${id}-error` : undefined, "data-error-key": path } as const;
  return <div className="min-w-0 space-y-1.5">
    <Label htmlFor={id}>{control.label}{control.optional ? " (optional)" : ""}</Label>
    {control.kind === "select" || control.kind === "boolean" ? <select {...attrs} required={!control.optional}
      onChange={(event) => onChange(event.target.value || undefined)} className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm">
      <option value="">{control.optional ? "Not specified" : "Choose an option"}</option>
      {(control.kind === "boolean" ? ["false", "true"] : control.options!).map((option) => <option key={option} value={option}>{option === "true" ? "Yes" : option === "false" ? "No" : option}</option>)}
    </select> : control.multiline ? <textarea {...attrs} rows={3} maxLength={control.max} required={!control.optional}
      onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm [overflow-wrap:anywhere]" />
      : <Input {...attrs} inputMode={control.kind === "integer" ? "numeric" : undefined} maxLength={control.kind === "integer" ? 16 : control.max}
        required={!control.optional} onChange={(event) => onChange(event.target.value)} />}
    {control.kind === "integer" ? <p className="text-xs text-muted-foreground">Whole number, {control.min} to {control.max}.{control.min! <= 0 ? " Zero is a declared value." : ""}</p> : null}
    {error ? <p id={`${id}-error`} className="text-xs text-destructive">{error.join(" ")}</p> : null}
  </div>;
}
function preserveDraft(form: HTMLFormElement | null) {
  if (!form) return;
  const preventReset = (event: Event) => event.preventDefault();
  form.addEventListener("reset", preventReset);
  return () => form.removeEventListener("reset", preventReset);
}
function focusError(form: HTMLFormElement | null, key: string) {
  if (!form) return;
  const node = Array.from(form.querySelectorAll<HTMLElement>("[data-error-key]")).find((element) => element.dataset.errorKey === key)
    ?? Array.from(form.querySelectorAll<HTMLElement>("[data-error-key]")).find((element) => element.dataset.errorKey === key.split(".")[0]);
  for (let ancestor = node?.parentElement; ancestor; ancestor = ancestor.parentElement) if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
  if (node?.matches("input,select,textarea")) node.focus();
  else node?.querySelector<HTMLElement>("input,select,textarea,button")?.focus();
}
export function MonsterForm({ mode, initialValue }: MonsterFormProps) {
  const [state, action, pending] = useActionState(mode === "create" ? createHomebrewMonster : updateHomebrewMonster, initialState);
  const [name, setName] = useState(initialValue?.name ?? "");
  const [draft, setDraft] = useState(() => monsterDataToDraft(initialValue?.data));
  const [attempted, setAttempted] = useState(false);
  const prefix = useId();
  const sequence = useRef(0);
  const formRef = useRef<HTMLFormElement | null>(null);
  const candidate = monsterDraftToData(draft);
  const parsed = monsterDataSchema.safeParse(candidate);
  const parsedName = monsterNameSchema.safeParse(name);
  const errors: Record<string, string[]> = { ...state.fieldErrors };
  if (attempted) {
    if (!parsed.success) for (const issue of parsed.error.issues) (errors[issue.path.join(".") || "monster_data"] ??= []).push(issue.message);
    if (!parsedName.success) errors.name = parsedName.error.issues.map((issue) => issue.message);
  }
  useEffect(() => {
    const key = Object.keys(state.fieldErrors ?? {})[0];
    if (key) focusError(formRef.current, key);
  }, [state]);
  return <form action={action} noValidate ref={(form) => { formRef.current = form; return preserveDraft(form); }}
    onSubmit={(event) => {
      if (pending || state.status === "conflict") { event.preventDefault(); return; }
      if (!parsed.success || !parsedName.success) {
        event.preventDefault(); setAttempted(true);
        const key = !parsedName.success ? "name" : !parsed.success ? parsed.error.issues[0]?.path.join(".") : "";
        if (key) focusError(formRef.current, key);
      }
    }} className="j-card-paper min-w-0 space-y-6 p-5 sm:p-7">
    <input type="hidden" name="monster_data" value={JSON.stringify(candidate)} />
    {initialValue ? <><input type="hidden" name="id" value={initialValue.id} /><input type="hidden" name="expected_version" value={initialValue.version} />
      <input type="hidden" name="changed_fields" value={JSON.stringify(changedMonsterFields(initialValue.data, candidate))} /></> : null}
    <p className="text-sm text-muted-foreground">D&D 5e (2014) · Private. Enter declared values; dice text is displayed and does not calculate averages. Changes save a new version. Older versions remain unchanged.</p>
    <fieldset disabled={pending || state.status === "conflict"} className="min-w-0 space-y-5">
      <legend className="sr-only">Monster details</legend>
      <div className="space-y-1.5"><Label htmlFor={`${prefix}-name`}>Name</Label><Input id={`${prefix}-name`} name="name" value={name} required maxLength={100}
        data-error-key="name" aria-invalid={Boolean(errors.name) || undefined} aria-describedby={errors.name ? `${prefix}-name-error` : undefined}
        onChange={(event) => setName(event.target.value)} />{errors.name ? <p id={`${prefix}-name-error`} className="text-xs text-destructive">{errors.name.join(" ")}</p> : null}</div>
      {Object.entries(MONSTER_CONTROLS).map(([key, control]) => <details key={key} open={!control.optional || Boolean(errors[key])} className="min-w-0 space-y-3">
        <summary className="cursor-pointer py-1 text-sm font-medium">{control.label}</summary>
        <DraftControl control={control} value={draft[key]} path={key} prefix={prefix} errors={errors}
          onChange={(value) => setDraft((current) => ({ ...current, [key]: value }))} newRowId={() => `${prefix}-new-${sequence.current++}`} />
      </details>)}
    </fieldset>
    {state.message ? <p role={state.status === "idle" ? "status" : "alert"} className="text-sm [overflow-wrap:anywhere]">{state.message}</p> : null}
    {attempted && Object.keys(errors).length ? <div role="alert" className="text-sm text-destructive">Check the highlighted fields. {Object.entries(errors).map(([key, messages]) => <p key={key}>{key.replaceAll("_", " ")}: {messages.join(" ")}</p>)}</div> : null}
    <details className="min-w-0"><summary className="cursor-pointer text-sm font-medium">Stat block preview</summary>
      {parsed.success && parsedName.success ? <div className="mt-4"><h2 className="j-display mb-3 text-xl [overflow-wrap:anywhere]">{name}</h2><MonsterStatBlock data={parsed.data} /></div> : <p className="mt-3 text-sm text-muted-foreground">Enter valid required values to preview the stat block.</p>}
    </details>
    {state.status === "conflict" ? <div className="space-y-2"><p className="text-sm">Reload latest discards this unsaved draft. Cancel keeps the stored version unchanged.</p>
      <Button type="button" variant="outline" onClick={() => window.location.reload()}>Reload latest</Button></div> : null}
    <div className="flex flex-wrap gap-3"><Button type="submit" disabled={pending || state.status === "conflict"}>{pending ? "Saving…" : mode === "create" ? "Create private monster" : "Save new version"}</Button>
      <Link href="/homebrew" className={buttonVariants({ variant: "outline" })}>Cancel</Link></div>
    <p className="text-xs text-muted-foreground">This stat block does not execute attacks, spellcasting, recharge, conditions or formulas. Effects and existing versions are not edited here.</p>
  </form>;
}
