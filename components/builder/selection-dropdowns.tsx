"use client";

import { useId } from "react";

interface SelectionDropdownsProps {
  label: string;
  options: readonly string[];
  selected: readonly string[];
  limit: number;
  onChange: (values: string[]) => void;
  disabled?: boolean;
  optionLabel?: (value: string) => string;
}

/** One dropdown per allowed pick. Other picks never reappear as candidates. */
export function SelectionDropdowns({ label, options, selected, limit, onChange, disabled = false,
  optionLabel = value => value }: SelectionDropdownsProps) {
  const id = useId();
  const candidates = [...new Set(options)].filter(value => value.length > 0);
  const valid = Number.isInteger(limit) && limit > 0 && limit <= 100 && selected.length <= limit
    && new Set(selected).size === selected.length && selected.every(value => candidates.includes(value));
  const locked = disabled || !valid || candidates.length === 0;

  return <div className="space-y-2">
    {Array.from({ length: Number.isInteger(limit) && limit > 0 && limit <= 100 ? limit : 0 }, (_, index) => {
      const current = selected[index] ?? "";
      return <div key={index} className="space-y-1">
        <label htmlFor={`${id}-${index}`} className="text-sm text-muted-foreground">{label}{limit > 1 ? ` ${index + 1}` : ""}</label>
        <select id={`${id}-${index}`} value={candidates.includes(current) ? current : ""} disabled={locked}
          className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
          onChange={event => {
            const value = event.target.value;
            if (locked || value !== "" && (!candidates.includes(value) || selected.some((item, slot) => slot !== index && item === value))) return;
            const next = [...selected];
            if (value === "") next.splice(index, 1);
            else if (index >= next.length) next.push(value);
            else next[index] = value;
            onChange(next);
          }}>
          <option value="">Choose…</option>
          {candidates.filter(value => value === current || !selected.includes(value)).map(value =>
            <option key={value} value={value}>{optionLabel(value)}</option>)}
        </select>
      </div>;
    })}
    {valid && candidates.length === 0 && <p className="text-sm text-muted-foreground">No valid options are available for this choice.</p>}
  </div>;
}
