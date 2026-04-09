"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { CharacterState } from "@/lib/types/character";

interface QuickNotesProps {
  state: CharacterState;
  patchState: (patch: Partial<CharacterState>) => void;
}

export function QuickNotes({ state, patchState }: QuickNotesProps) {
  const [expanded, setExpanded] = useState(false);
  const [value, setValue] = useState(state.quick_notes ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSave = useCallback(
    (text: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        patchState({ quick_notes: text });
      }, 500);
    },
    [patchState],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    setValue(text);
    debouncedSave(text);
  }

  function handleBlur() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    patchState({ quick_notes: value });
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center justify-between w-full px-3 py-2 text-left"
      >
        <span className="text-accent font-semibold text-sm uppercase tracking-wide">
          Quick Notes
        </span>
        <svg
          className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Collapsible textarea */}
      {expanded && (
        <div className="px-3 pb-3">
          <textarea
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Quick reminders, initiative order, HP tracking..."
            className="bg-background border border-border text-foreground placeholder:text-muted-foreground w-full min-h-[100px] p-2 rounded-md resize-y text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      )}
    </div>
  );
}
