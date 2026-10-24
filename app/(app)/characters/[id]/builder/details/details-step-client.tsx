"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { SaveBuilderStep } from "@/lib/builder/builder-step-command";
import { useBuilderStepSave } from "@/components/builder/builder-save-boundary";
import { useSaveNavigationGuard } from "@/lib/builder/use-save-navigation-guard";

const alignments = ["Lawful Good", "Neutral Good", "Chaotic Good", "Lawful Neutral", "True Neutral", "Chaotic Neutral",
  "Lawful Evil", "Neutral Evil", "Chaotic Evil", "Unaligned"];

export function DetailsStepClient({ characterId, name: initialName, alignment: initialAlignment, confirmed,
  saveAction: providedSaveAction }: { characterId: string; name: string; alignment: string; confirmed: boolean; saveAction: SaveBuilderStep }) {
  const saveAction = useBuilderStepSave(providedSaveAction)!;
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const inFlight = useRef(false);
  const { notice, setBlocked } = useSaveNavigationGuard("character details");
  const [name, setName] = useState(initialName), [alignment, setAlignment] = useState(initialAlignment);
  const [saved, setSaved] = useState(confirmed), [saving, setSaving] = useState(false), [error, setError] = useState<string | null>(null);
  useEffect(() => setBlocked(saving || refreshing || name !== initialName || alignment !== initialAlignment),
    [saving, refreshing, name, alignment, initialName, initialAlignment, setBlocked]);
  return <section className="max-w-xl space-y-5">
    <h2 className="text-xl font-semibold">Character Details</h2>
    <p className="text-sm text-muted-foreground">Choose the name and alignment for your character. You can keep writing their story on the character sheet.</p>
    <form className="space-y-4" onSubmit={async event => {
      event.preventDefault(); if (inFlight.current || refreshing) return;
      inFlight.current = true;
      setSaving(true); setError(null);
      try {
        const result = await saveAction("save_details", { name: name.trim(), alignment: alignment || null });
        setName(name.trim()); setAlignment(result.choices.alignment ?? ""); setSaved(result.choices.details_confirmed === true);
        startTransition(() => router.refresh());
      } catch { setSaved(false); setError("These details could not be confirmed. Reload their saved values before trying again."); }
      finally { inFlight.current = false; setSaving(false); }
    }}>
      <fieldset disabled={saving || refreshing} className="space-y-4">
        <div className="space-y-1"><label htmlFor="character-name" className="block text-sm font-medium">Character name</label>
          <input id="character-name" className="w-full rounded-md border bg-background p-2" required maxLength={100} value={name}
            onChange={event => { setName(event.target.value); setSaved(false); }} /></div>
        <div className="space-y-1"><label htmlFor="character-alignment" className="block text-sm font-medium">Alignment</label>
          <select id="character-alignment" className="w-full rounded-md border bg-background p-2" value={alignment}
            onChange={event => { setAlignment(event.target.value); setSaved(false); }}>
            <option value="">No alignment selected</option>
            {alignment && !alignments.includes(alignment) && <option value={alignment}>{alignment}</option>}
            {alignments.map(value => <option key={value} value={value}>{value}</option>)}
          </select></div>
        <Button type="submit" disabled={!name.trim()}>{saving ? "Saving details…" : "Save details"}</Button>
      </fieldset>
    </form>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {saved && !saving && <p role="status" className="text-sm">Character details saved.</p>}
    <div className="flex justify-between gap-3"><Button variant="outline" disabled={saving}
      onClick={() => router.push(`/characters/${characterId}/builder/equipment`)}>Previous: Equipment</Button>
      <Button disabled={saving || !saved} onClick={() => router.push(`/characters/${characterId}/builder/equipment`)}>Review &amp; Finish</Button></div>
  </section>;
}
