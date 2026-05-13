import { cn } from "@/lib/utils";

interface LevelPillProps {
  level: number;
  summary: string;
  hasUnmadeChoice: boolean;
  active: boolean;
  onClick: () => void;
}

export function LevelPill({ level, summary, hasUnmadeChoice, active, onClick }: LevelPillProps) {
  return (
    <button
      type="button"
      aria-current={active ? "true" : undefined}
      aria-label={`Level ${level}: ${summary}`}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
        "border border-transparent hover:bg-muted/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-character-bg border-character-border text-character-fg",
      )}
    >
      <span className="w-5 text-center font-semibold tabular-nums">{level}</span>
      <span className="flex-1 truncate">{summary}</span>
      {hasUnmadeChoice && (
        <span
          aria-label="Has unmade choice"
          className="size-1.5 shrink-0 rounded-full bg-destructive"
        />
      )}
    </button>
  );
}
