"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { classTone } from "@/lib/builder/class-tone";

type LevelUpButtonState = "idle" | "disabled" | "active-flow";

interface LevelUpButtonProps {
  state: LevelUpButtonState;
  classSlug: string;
  classLabel: string;
  /** Current level of this class (button shows "Lv {atLevel + 1}"). */
  atLevel: number;
  /** Reason text for the disabled state (e.g. "Finish Pal 7 first", "Lv 20 (max)"). Ignored for idle/active-flow. */
  reason?: string;
  onClick: () => void;
}

const TONE_BORDER_IDLE: Record<"gold" | "purple", string> = {
  gold: "border-[rgba(201,164,74,0.45)] bg-[rgba(201,164,74,0.06)] hover:bg-[rgba(201,164,74,0.12)] text-[#c9a44a]",
  purple: "border-[rgba(124,58,237,0.55)] bg-[rgba(124,58,237,0.08)] hover:bg-[rgba(124,58,237,0.14)] text-[#c7b0ff]",
};

const TONE_BORDER_ACTIVE: Record<"gold" | "purple", string> = {
  gold: "border-[rgba(201,164,74,0.25)] bg-transparent text-muted-foreground",
  purple: "border-[rgba(124,58,237,0.25)] bg-transparent text-muted-foreground",
};

export function LevelUpButton(props: LevelUpButtonProps) {
  const { state, classSlug, classLabel, atLevel, reason, onClick } = props;
  const tone = classTone(classSlug);
  const nextLevel = atLevel + 1;
  const ariaLabel = `Level up ${classLabel} to level ${nextLevel}`;

  if (state === "idle") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        data-tone={tone}
        className={cn(
          "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-xs font-semibold transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          TONE_BORDER_IDLE[tone],
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex size-4 items-center justify-center rounded-full font-bold leading-none",
            tone === "gold" ? "bg-[#c9a44a] text-[#1a1625]" : "bg-[#c7b0ff] text-[#1a1625]",
          )}
        >
          <Plus className="size-3" />
        </span>
        <span className="flex-1 text-left">Level up {classLabel}</span>
        <span aria-hidden="true" className="text-[10px] tabular-nums opacity-80">Lv {nextLevel}</span>
      </button>
    );
  }

  // disabled or active-flow share the same DOM shape; reason text differs.
  const reasonText = state === "active-flow" ? "In progress" : reason ?? "";
  const borderClass =
    state === "active-flow" ? TONE_BORDER_ACTIVE[tone] : "border-dashed border-muted text-muted-foreground";

  return (
    <button
      type="button"
      aria-disabled="true"
      aria-label={ariaLabel}
      aria-describedby={`level-up-reason-${classSlug}`}
      onClick={(e) => e.preventDefault()}
      data-tone={tone}
      className={cn(
        "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-xs cursor-not-allowed transition-colors",
        borderClass,
      )}
    >
      <span
        aria-hidden="true"
        className="inline-flex size-4 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-[10px] opacity-60"
      >
        +
      </span>
      <span className="flex-1 text-left">Level up {classLabel}</span>
      <span id={`level-up-reason-${classSlug}`} aria-hidden="false" className="text-[10px] opacity-70">
        {reasonText}
      </span>
    </button>
  );
}
