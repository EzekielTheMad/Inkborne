"use client";
import Link from "next/link";
import { unstable_rethrow, useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createHomebrewNpc, updateHomebrewNpc } from "@/app/(app)/homebrew/npcs/actions";
import { acceptNpcResponse, changedNpcFields, npcUncertainty, type NpcActionState } from "@/lib/homebrew/npc-form";
import type { NpcData } from "@/lib/schemas/content-types/npc";
import type { HomebrewNpcRecord } from "@/lib/supabase/homebrew-npcs-server";

const lists = [["personality_traits", "Personality traits"], ["ideals", "Ideals"], ["bonds", "Bonds"], ["flaws", "Flaws"]] as const;
const scalarPersonality = [["motivation", "Motivation"], ["mannerisms", "Mannerisms"], ["fear", "Fear"]] as const;
const controlId = (path: string) => `npc-${path.replaceAll(".", "-")}`;
function preserveDraft(form: HTMLFormElement | null) {
  if (!form) return;
  const prevent = (event: Event) => event.preventDefault(); form.addEventListener("reset", prevent);
  return () => form.removeEventListener("reset", prevent);
}
function valueAt(data: NpcData, path: string): unknown {
  return path.split(".").reduce<unknown>((value, part) => value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined, data);
}
export function NpcForm({ mode, initialValue }: { mode: "create" | "edit"; initialValue?: HomebrewNpcRecord }) {
  const router = useRouter(), submitting = useRef(false), saved = useRef<Extract<NpcActionState, { status: "saved" }> | null>(null);
  const excluded = useRef<Record<string, unknown>>({}), nextKey = useRef(0);
  const [rowKeys, setRowKeys] = useState<Record<string, string[]>>({});
  const [acknowledged, setAcknowledged] = useState<NpcActionState | null>(null);
  const [name, setName] = useState(initialValue?.name ?? "");
  const [data, setData] = useState<NpcData>(() => structuredClone(initialValue?.data ?? { schema_version: 1 }));
  const [state, action, pending] = useActionState(async (previous: NpcActionState, form: FormData): Promise<NpcActionState> => {
    if (saved.current || previous.status === "conflict" || (previous.status === "uncertain" && (mode === "edit" || acknowledged !== previous))) {
      submitting.current = false; return saved.current ?? previous;
    }
    let result: NpcActionState;
    try { result = acceptNpcResponse(await (mode === "create" ? createHomebrewNpc : updateHomebrewNpc)(previous, form), mode, initialValue); }
    catch (error) { unstable_rethrow(error); result = npcUncertainty(mode); }
    finally { submitting.current = false; }
    if (result.status === "saved") {
      saved.current = result; // Keep the exact confirmed version even if navigation fails.
      try { router.push("/homebrew"); } catch (error) { unstable_rethrow(error); }
    }
    return result;
  }, { status: "idle" } as NpcActionState);
  const blocked = state.status === "saved" || state.status === "conflict" || (state.status === "uncertain" && (mode === "edit" || acknowledged !== state));
  const errors = "fieldErrors" in state ? state.fieldErrors : undefined;
  useEffect(() => {
    const first = Object.keys("fieldErrors" in state ? state.fieldErrors ?? {} : {})[0];
    if (first) (document.getElementById(controlId(first)) ?? document.getElementById("npc-errors"))?.focus();
  }, [state]);
  function setPath(path: string, value: unknown) {
    setData(current => {
      const next = structuredClone(current), parts = path.split(".");
      let object = next as unknown as Record<string, unknown>;
      for (const part of parts.slice(0, -1)) object = object[part] as Record<string, unknown>;
      if (value === undefined) delete object[parts.at(-1)!]; else object[parts.at(-1)!] = value;
      return next;
    });
  }
  function toggle(path: string, fallback: unknown) {
    const current = valueAt(data, path);
    if (current !== undefined) { excluded.current[path] = current; setPath(path, undefined); }
    else setPath(path, excluded.current[path] ?? fallback);
  }
  function field(path: string, label: string, maximum: number, required = false, textarea = true) {
    const raw = path === "name" ? name : valueAt(data, path), value = typeof raw === "string" ? raw : "";
    const props = { id: controlId(path), value, required, maxLength: maximum,
      "aria-invalid": Boolean(errors?.[path]?.length) || undefined, "aria-describedby": errors?.[path]?.length ? `${controlId(path)}-error` : undefined,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (path === "name") setName(event.target.value); else setPath(path, event.target.value === "" && !required ? undefined : event.target.value);
      } };
    return <div className="min-w-0 space-y-2"><label htmlFor={props.id} className="text-sm font-medium">{label}</label>
      {textarea ? <textarea {...props} rows={3} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm [overflow-wrap:anywhere]" /> : <Input {...props} />}
      {errors?.[path]?.length ? <p id={`${controlId(path)}-error`} className="text-sm text-destructive">{errors[path].join(" ")}</p> : null}</div>;
  }
  function presence(path: string, label: string, fallback: unknown) {
    return <label className="flex items-center gap-2 text-sm"><input id={controlId(path)} type="checkbox" checked={valueAt(data, path) !== undefined}
      onChange={() => toggle(path, fallback)} />Include {label}</label>;
  }
  function keysFor(path: string, length: number) {
    return rowKeys[path] ?? Array.from({ length }, (_, index) => `${path}-initial-${index}`);
  }
  function editRows(path: string, action: "add" | "remove" | "up" | "down", index = 0) {
    const rows = [...((valueAt(data, path) as unknown[] | undefined) ?? [])], keys = [...keysFor(path, rows.length)];
    if (action === "add") { rows.push(path === "relationships" ? { name: "", relationship: "" } : ""); keys.push(`${path}-new-${nextKey.current++}`); }
    else if (action === "remove") { rows.splice(index, 1); keys.splice(index, 1); }
    else { const target = action === "up" ? index - 1 : index + 1; [rows[index], rows[target]] = [rows[target], rows[index]]; [keys[index], keys[target]] = [keys[target], keys[index]]; }
    setRowKeys(current => ({ ...current, [path]: keys })); setPath(path, rows);
  }
  function rowButtons(path: string, index: number, count: number, label: string) {
    return <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={() => editRows(path, "remove", index)}>Remove {label} {index + 1}</Button>
      <Button type="button" variant="outline" disabled={index === 0} onClick={() => editRows(path, "up", index)}>Move {label} {index + 1} up</Button>
      <Button type="button" variant="outline" disabled={index === count - 1} onClick={() => editRows(path, "down", index)}>Move {label} {index + 1} down</Button>
    </div>;
  }
  return <form action={action} ref={preserveDraft} className="j-card-paper min-w-0 space-y-6 p-5 sm:p-7" onSubmit={event => {
    if (pending || blocked || submitting.current || saved.current) event.preventDefault(); else submitting.current = true;
  }}>
    <input type="hidden" name="name" value={name} /><input type="hidden" name="npc_data" value={JSON.stringify(data)} />
    {mode === "edit" && initialValue ? <><input type="hidden" name="id" value={initialValue.id} /><input type="hidden" name="expected_version" value={initialValue.version} />
      <input type="hidden" name="changed_fields" value={JSON.stringify(changedNpcFields(initialValue.data, data))} /></> : null}
    <p className="text-sm text-muted-foreground">Private NPC narrative template. Relationship ideas are story hooks; saving does not link people, attach to characters, store campaign secrets or activate game mechanics.</p>
    <fieldset disabled={pending || blocked} aria-busy={pending} className="min-w-0 space-y-5"><legend className="j-folio mb-3">NPC narrative</legend>
      {field("name", "Name", 120, true, false)}{field("description", "Description (optional)", 8_000)}{field("occupation", "Occupation (optional)", 120, false, false)}
      {presence("personality", "personality", {})}
      {data.personality !== undefined ? <fieldset className="min-w-0 space-y-5"><legend className="j-folio">Personality</legend>
        {lists.map(([key, label]) => {
          const path = `personality.${key}`, rows = data.personality?.[key];
          return <div key={key} className="space-y-3">{presence(path, label.toLowerCase(), [])}
            {rows !== undefined ? <div className="space-y-4">{rows.map((_, index) => <div key={keysFor(path, rows.length)[index]} className="space-y-2">
              {field(`${path}.${index}`, `${label} ${index + 1}`, 500, true)}{rowButtons(path, index, rows.length, label.toLowerCase())}</div>)}
              <Button type="button" variant="outline" disabled={rows.length >= 8} onClick={() => editRows(path, "add")}>Add {label.toLowerCase()}</Button></div> : null}</div>;
        })}
        {scalarPersonality.map(([key, label]) => <div key={key}>{field(`personality.${key}`, `${label} (optional)`, 1_000)}</div>)}
      </fieldset> : null}
      {presence("relationships", "relationship ideas", [])}
      {data.relationships !== undefined ? <fieldset className="min-w-0 space-y-5"><legend className="j-folio">Relationship ideas</legend>
        {data.relationships.map((_, index) => <div key={keysFor("relationships", data.relationships!.length)[index]} className="space-y-3">
          {field(`relationships.${index}.name`, `Idea ${index + 1} name`, 120, true, false)}
          {field(`relationships.${index}.relationship`, `Idea ${index + 1} relationship`, 120, true)}
          {field(`relationships.${index}.description`, `Idea ${index + 1} description (optional)`, 1_000)}
          {rowButtons("relationships", index, data.relationships!.length, "idea")}</div>)}
        <Button type="button" variant="outline" disabled={data.relationships.length >= 20} onClick={() => editRows("relationships", "add")}>Add relationship idea</Button>
      </fieldset> : null}
      <p className="text-xs text-muted-foreground">Included lists with no rows are saved empty. Excluding a group removes it on save; re-enabling restores its draft here. Whitespace-only text is invalid. Order and duplicate ideas are retained.</p>
    </fieldset>
    {state.status !== "saved" && state.status !== "unchanged" && state.message ? <div id="npc-errors" tabIndex={-1} role="alert" className="text-sm [overflow-wrap:anywhere]">{state.message}
      {Object.entries(errors ?? {}).map(([path, messages]) => <p key={path}>{path}: {messages.join(" ")}</p>)}</div> : null}
    {state.status === "saved" ? <p role="status">NPC version {state.version} was saved. Newer edits may already exist. <Link href="/homebrew">Open Homebrew</Link></p> : null}
    {state.status === "unchanged" ? <p role="status">No changes to save. This invocation did not write; version {state.version} was read.</p> : null}
    {mode === "create" && state.status === "uncertain" ? <div className="space-y-3 text-sm"><Link href="/homebrew">Check Homebrew</Link>
      <p>Another create may make a separate NPC. Your draft is kept here; navigating or reloading can lose it.</p>
      <Button type="button" variant="outline" disabled={acknowledged === state} onClick={() => setAcknowledged(state)}>I checked Homebrew; allow another create</Button></div> : null}
    {mode === "edit" && (state.status === "conflict" || state.status === "uncertain") ? <div className="space-y-3 text-sm"><p>Reload latest discards this unsaved draft and loads the stored version.</p>
      <Button type="button" variant="outline" onClick={() => window.location.reload()}>Reload latest</Button><Link href="/homebrew">Check Homebrew</Link></div> : null}
    <div className="flex flex-wrap gap-3"><Button type="submit" disabled={pending || blocked}>{pending ? "Saving…" : mode === "create" ? "Create private NPC" : "Save new version"}</Button>
      <Link href="/homebrew" className={buttonVariants({ variant: "outline" })}>Back to Homebrew</Link></div>
  </form>;
}
