"use client";

import { useId, useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import styles from "./character-notebook.module.css";

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
  const [open, setOpen] = useState(false);
  const fieldId = useId();
  const [hexInput, setHexInput] = useState(currentColor ?? "");
  const [nativeColorDraft, setNativeColorDraft] = useState<string | null>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setHexInput(currentColor ?? "");
      setNativeColorDraft(null);
    }
    setOpen(nextOpen);
  };

  const applyColor = (color: string | null) => {
    setHexInput(color ?? "");
    onChange(color);
  };

  const isHexValid = hexInput === "" || HEX_RE.test(hexInput);

  const commitHex = () => {
    if (hexInput === "") return;
    if (!isHexValid) return;
    const normalized = hexInput.startsWith("#") ? hexInput : `#${hexInput}`;
    applyColor(normalized.toLowerCase());
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger render={children as React.ReactElement} />
      <PopoverContent className="w-72 p-4" aria-label="Character color">
        <div className="space-y-3">
          <div className="text-sm font-semibold text-foreground">
            Character color
          </div>
          <p className="text-xs text-muted-foreground">{currentColor ?? "Site accent"} · adapts to light and dark</p>
          <div className="grid grid-cols-6 gap-2">
            {PRESETS.map((p) => {
              const isSelected = currentColor?.toLowerCase() === p.hex.toLowerCase();
              return (
                <button
                  key={p.hex}
                  type="button"
                  aria-label={`Set character color to ${p.name}`}
                  aria-pressed={isSelected}
                  onClick={() => applyColor(p.hex)}
                  className={styles.colorSwatch}
                ><span aria-hidden="true" style={{ backgroundColor: p.hex }} />{isSelected && <b className={styles.swatchMark} aria-hidden="true">✓</b>}</button>
              );
            })}
          </div>
          <label htmlFor={fieldId} className="block text-xs text-muted-foreground">Custom hex</label>
          <div className="flex items-center gap-3">
            <input
              id={fieldId}
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
                styles.colorField, "min-w-0 flex-1 font-mono",
                isHexValid ? "border-border" : "border-destructive",
              )}
              placeholder="#xxxxxx"
              maxLength={7}
              spellCheck={false}
            />
            <label
              className="relative size-10 shrink-0 cursor-pointer overflow-hidden rounded border border-input"
              style={{ backgroundColor: currentColor ?? "var(--character-color)" }}
              aria-label="Open native color picker"
            >
              <input
                type="color"
                value={nativeColorDraft ?? currentColor ?? "#c9a44a"}
                onChange={(e) => setNativeColorDraft(e.target.value)}
                onBlur={() => {
                  if (nativeColorDraft) {
                    applyColor(nativeColorDraft.toLowerCase());
                    setNativeColorDraft(null);
                  }
                }}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
            <button
              type="button"
              aria-label="Reset character color to default"
              onClick={() => applyColor(null)}
              className={styles.colorReset}
            >
              Reset
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
