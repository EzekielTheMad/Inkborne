"use client";

import { useState } from "react";
import { useDialogAction } from "@/lib/character/use-dialog-action";
import { CharacterStateReloadError } from "@/lib/character/state-save-error";
import { cn } from "@/lib/utils";
import type { Currency } from "@/lib/types/inventory";

interface CurrencyTrackerProps {
  currency: Currency;
  onChange: (currency: Currency) => Promise<boolean> | void;
}

const DENOMINATIONS: Array<{ key: keyof Currency; label: string; color: string }> = [
  { key: "pp", label: "PP", color: "text-blue-300" },
  { key: "gp", label: "GP", color: "text-accent" },
  { key: "ep", label: "EP", color: "text-gray-300" },
  { key: "sp", label: "SP", color: "text-gray-400" },
  { key: "cp", label: "CP", color: "text-orange-400" },
];

export function CurrencyTracker({ currency, onChange }: CurrencyTrackerProps) {
  const [edit, setEdit] = useState({ base: currency, draft: currency, dirty: false });
  const [saveError, setSaveError] = useState<string | null>(null);
  const { pending, run } = useDialogAction();
  // Refresh an untouched editor; a pending/failed draft must stay reviewable.
  if (!edit.dirty && edit.base !== currency) setEdit({ base: currency, draft: currency, dirty: false });
  function handleChange(key: keyof Currency, value: string) {
    const num = parseInt(value) || 0;
    setEdit({ ...edit, dirty: true, draft: { ...edit.draft, [key]: Math.max(0, num) } });
  }
  function save() {
    setSaveError(null);
    if (DENOMINATIONS.some(({ key }) => currency[key] !== edit.base[key])) {
      setSaveError("Currency changed while you were editing. Discard this draft and review the current amounts before editing again.");
      return;
    }
    void run(async () => onChange(edit.draft), saved => {
      if (saved === false) setSaveError("Currency could not be saved. Please try again.");
      else setEdit(previous => ({ ...previous, dirty: false }));
    }, error => setSaveError(error instanceof CharacterStateReloadError
      ? error.message : "Currency could not be saved. Wait for any pending save, then try again."));
  }
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2" aria-busy={pending}>
      <p className="text-xs font-medium text-muted-foreground">Currency</p>
      <div className="flex gap-2">
        {DENOMINATIONS.map(({ key, label, color }) => (
          <div key={key} className="flex-1 text-center">
            <input type="number" min={0} aria-label={`${label} amount`} disabled={pending}
              value={edit.draft[key]} onChange={(e) => handleChange(key, e.target.value)}
              className="w-full h-7 rounded border border-input bg-background px-1 text-center text-sm font-medium" />
            <p className={cn("text-[10px] font-medium mt-0.5", color)}>{label}</p>
          </div>
        ))}
      </div>
      {edit.dirty && <div className="flex gap-2 text-xs">
        <button type="button" disabled={pending} className="underline" onClick={save}>Save currency</button>
        <button type="button" disabled={pending} className="underline" onClick={() => {
          setEdit({ base: currency, draft: currency, dirty: false }); setSaveError(null);
        }}>Discard currency draft</button>
      </div>}
      {saveError && <p role="alert" className="text-xs text-destructive">{saveError}</p>}
    </div>
  );
}
