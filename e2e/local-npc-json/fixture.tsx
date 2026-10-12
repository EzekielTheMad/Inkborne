"use client";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { NpcJsonImportPreview } from "@/components/library/npc-json-import-preview";
import { createNpcJsonReview } from "@/lib/import/npc-json/review";
import { NPC_JSON_LIMITS, type NpcJsonDiagnostic, type NpcJsonReview } from "@/lib/import/npc-json/types";

let release: (() => void) | undefined;
const journal = { reads: 0, accepted: 0, held: false, release: () => { if (!release) throw Error("No held local result"); release(); } };
Object.assign(window, { npcJsonHarness: journal });
function Fixture() {
  const busy = useRef(false), sequence = useRef(0);
  const [file, setFile] = useState<File>(), [serial, setSerial] = useState(0), [hold, setHold] = useState(false), [pending, setPending] = useState(false);
  const [previous, setPrevious] = useState<{ serial: number; review: NpcJsonReview }>();
  const [errors, setErrors] = useState<NpcJsonDiagnostic[]>([]);
  useEffect(() => { if (errors.length) document.getElementById("json-errors")?.focus(); }, [errors]);
  return <main className="min-w-0 space-y-6 p-4">
    <p>Offline local prototype only. No app upload route, Auth, SQL, staging, commit, save or navigation. JSON format choice remains provisional. Native file bytes/codec/profile are real; optional result delay is a fixture timing model.</p>
    <form onSubmit={async event => {
      event.preventDefault(); if (!file || busy.current) return;
      busy.current = true; setPending(true); const selected = sequence.current; setErrors([]);
      try {
        if (file.size < 1 || file.size > NPC_JSON_LIMITS.bytes) {
          setErrors([{ code: "BYTE_LIMIT", path: "/", message: "Local file exceeds the byte budget; bytes were not read.", location: { byteOffset: 0, line: 1, column: 1 } }]); return;
        }
        journal.reads++;
        const result = await createNpcJsonReview(new Uint8Array(await file.arrayBuffer()), file.name, file.size);
        if (hold) await new Promise<void>(resolve => { release = resolve; journal.held = true; });
        if (selected !== sequence.current) return;
        if (result.success) { journal.accepted++; setPrevious({ serial: selected, review: result.review }); }
        else setErrors(result.diagnostics);
      } catch { setErrors([{ code: "FILE_READ", path: "/", message: "Local file could not be read; previous preview remains separate.", location: { byteOffset: 0, line: 1, column: 1 } }]); }
      finally { journal.held = false; busy.current = false; release = undefined; setPending(false); }
    }} className="space-y-3">
      <fieldset disabled={pending} aria-busy={pending} className="space-y-3">
        <label htmlFor="json-file" className="block">Original local JSON file</label>
        <input id="json-file" type="file" accept=".json" required className="block max-w-full" onChange={event => {
          sequence.current++; setSerial(sequence.current); setFile(event.target.files?.[0]); setErrors([]);
        }} />
        <label className="flex gap-2"><input type="checkbox" checked={hold} onChange={event => setHold(event.target.checked)} />Hold result for offline timing control</label>
        <button type="submit" className="rounded border px-3 py-2" disabled={!file || pending}>{pending ? "Reading local file…" : "Preview local file"}</button>
      </fieldset>
    </form>
    {errors.length ? <div id="json-errors" role="alert" tabIndex={-1} className="space-y-2 [overflow-wrap:anywhere]">New file rejected; nothing imported.
      {errors.map((issue, index) => <p key={index}>{issue.code}: {issue.message} ({issue.path}, byte {issue.location.byteOffset}, line {issue.location.line}, column {issue.location.column})</p>)}</div> : null}
    {previous ? <NpcJsonImportPreview review={previous.review} retained={previous.serial !== serial || errors.length > 0 || pending} /> : null}
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
