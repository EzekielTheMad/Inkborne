"use client";

import { useEffect, useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const PRESETS = [
  { name: "Gold", hex: "#c9a44a" },
  { name: "Purple", hex: "#7c3aed" },
  { name: "Red", hex: "#b91c1c" },
  { name: "Emerald", hex: "#059669" },
  { name: "Blue", hex: "#2563eb" },
  { name: "Magenta", hex: "#db2777" },
] as const;

const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

export interface ColorPickerPopoverProps {
  currentColor: string | null;
  onChange: (color: string | null) => void;
  children: React.ReactNode; // the trigger (e.g., avatar button)
}

export function ColorPickerPopover({
  currentColor,
  onChange,
  children,
}: ColorPickerPopoverProps) {
  const [hexInput, setHexInput] = useState(currentColor ?? "");
  const [nativeColorDraft, setNativeColorDraft] = useState<string | null>(null);

  // Keep the input synced when the parent's color changes externally.
  useEffect(() => {
    setHexInput(currentColor ?? "");
  }, [currentColor]);

  const isHexValid = hexInput === "" || HEX_RE.test(hexInput);

  const commitHex = () => {
    if (hexInput === "") return;
    if (!isHexValid) return;
    const normalized = hexInput.startsWith("#") ? hexInput : `#${hexInput}`;
    onChange(normalized.toLowerCase());
  };

  return (
    <Popover>
      <PopoverTrigger render={children as React.ReactElement} />
      <PopoverContent className="w-64 p-3">
        <div className="space-y-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Character color
          </div>
          <div className="flex gap-1.5">
            {PRESETS.map((p) => {
              const isSelected = currentColor?.toLowerCase() === p.hex.toLowerCase();
              return (
                <button
                  key={p.hex}
                  type="button"
                  aria-label={`Set character color to ${p.name}`}
                  onClick={() => onChange(p.hex)}
                  className={cn(
                    "h-[18px] w-[18px] rounded-full border border-border transition-shadow",
                    isSelected && "ring-1 ring-white/70 ring-offset-1 ring-offset-popover",
                  )}
                  style={{ backgroundColor: p.hex }}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={hexInput}
              onChange={(e) => setHexInput(e.target.value)}
              onBlur={commitHex}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitHex();
                }
              }}
              aria-invalid={!isHexValid}
              className={cn(
                "h-7 w-24 rounded border px-2 font-mono text-xs uppercase",
                "bg-background text-foreground",
                isHexValid ? "border-border" : "border-destructive",
              )}
              placeholder="#xxxxxx"
              maxLength={7}
              spellCheck={false}
            />
            <label
              className="relative h-6 w-6 cursor-pointer overflow-hidden rounded border border-border"
              style={{ backgroundColor: currentColor ?? "transparent" }}
              aria-label="Open native color picker"
            >
              <input
                type="color"
                value={nativeColorDraft ?? currentColor ?? "#c9a44a"}
                onChange={(e) => setNativeColorDraft(e.target.value)}
                onBlur={() => {
                  if (nativeColorDraft) {
                    onChange(nativeColorDraft.toLowerCase());
                    setNativeColorDraft(null);
                  }
                }}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
            <button
              type="button"
              aria-label="Reset character color to default"
              onClick={() => onChange(null)}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground"
            >
              Reset
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
