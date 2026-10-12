"use client";

import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { useCharacter, useCharacterState, useInventory, useSpells, useRest, useResources, useRolls, useConcentration } from "@/lib/character/character-context";
import { buildCharacterPrintModel, type CharacterPrintModel } from "@/lib/character/print-model";
import { CharacterPrintView } from "./character-print-view";
import styles from "./character-print.module.css";

export function CharacterPrintAction() {
  const character = useCharacter();
  const state = useCharacterState();
  const inventory = useInventory();
  const spells = useSpells();
  const { hitDicePools } = useRest();
  const { resources } = useResources();
  const rolls = useRolls();
  const { pendingCheck } = useConcentration();
  const ctx = { ...character, ...state, ...inventory, ...spells, ...rolls, hitDicePools, resources, pendingConcentrationCheck: pendingCheck };
  const [model, setModel] = useState<CharacterPrintModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!model) return;
    const previousTitle = document.title;
    const trigger = triggerRef.current;
    document.title = `${model.name} - Inkborne Character Sheet`;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setModel(null); }
      if (event.key === "Tab") {
        const buttons = previewRef.current?.querySelectorAll<HTMLButtonElement>("button");
        const first = buttons?.[0], last = buttons?.[buttons.length - 1];
        if (!previewRef.current?.contains(document.activeElement)) { event.preventDefault(); first?.focus(); }
        else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); document.title = previousTitle; trigger?.focus(); };
  }, [model]);
  if (!ctx.isOwner || !ctx.hasSheet) return null;
  const mathUnavailable = ctx.casterInfo.castingMathStatus === "unavailable";
  const busy = ctx.reloadRequired || ctx.patchState.hasPendingWrites() || ctx.rollPersistencePending || ctx.rollPersistenceUncertain || !!ctx.pendingConcentrationCheck || !ctx.contentSnapshotsComplete || ctx.slotResolution?.status !== "available" || mathUnavailable;
  return <>
    <div className="flex flex-wrap items-center justify-end gap-2 border-b border-border px-4 py-2">
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {busy ? <p className="text-xs text-muted-foreground">{ctx.slotResolution?.status !== "available" ? "Spell slots are unavailable. Reload or restore saved class content before printing." : mathUnavailable ? "Casting values are unavailable. Reload or restore saved ability/class content before printing." : !ctx.contentSnapshotsComplete ? "Saved content is incomplete. Reload before printing." : "Finish saving and resolve pending play actions to print."}</p> : null}
      <Button ref={triggerRef} variant="outline" size="sm" disabled={busy} onClick={() => {
        try { setModel(buildCharacterPrintModel(ctx)); setError(null); }
        catch (cause) { setError(cause instanceof Error ? cause.message : "The character could not be prepared for printing."); }
      }}>Print / Save PDF</Button>
    </div>
    {model ? createPortal(<div ref={previewRef} data-character-print className={styles.preview} role="dialog" aria-modal="true" aria-label="Print preview"><div className={styles.toolbar}>
      <button ref={closeRef} type="button" onClick={() => setModel(null)}>Back to character</button>
      <p>Choose Letter or A4 and Save as PDF in your print dialog. Turn off browser headers and footers. Review this snapshot before sharing.</p>
      <button type="button" onClick={() => window.print()}>Print / Save PDF</button>
    </div><CharacterPrintView model={model} /></div>, document.body) : null}
  </>;
}
