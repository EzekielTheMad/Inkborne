"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { CharacterState } from "@/lib/types/character";

interface NotesTabProps {
  state: CharacterState;
  patchState: (patch: Partial<CharacterState>) => void;
}

export function NotesTab({ state, patchState }: NotesTabProps) {
  const [value, setValue] = useState(state.notes ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSave = useCallback(
    (text: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        patchState({ notes: text });
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
    // Save immediately on blur
    if (debounceRef.current) clearTimeout(debounceRef.current);
    patchState({ notes: value });
  }

  return (
    <textarea
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="Session notes, story beats, reminders..."
      className="bg-card border border-border text-foreground placeholder:text-muted-foreground w-full min-h-[300px] p-3 rounded-md resize-y text-sm focus:outline-none focus:ring-1 focus:ring-ring"
    />
  );
}
