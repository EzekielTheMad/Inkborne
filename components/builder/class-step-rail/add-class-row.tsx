import { Lock } from "lucide-react";

interface AddClassRowProps {
  reasons: string[];
}

export function AddClassRow({ reasons }: AddClassRowProps) {
  const reasonText = reasons.slice(0, 3).join(" · ");
  return (
    <button
      type="button"
      aria-disabled="true"
      aria-describedby="add-class-reason"
      title={reasons.join("\n")}
      className="w-full rounded-md border border-dashed border-muted px-3 py-2 text-left transition-colors cursor-not-allowed"
      onClick={(e) => e.preventDefault()}
    >
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="size-3.5" aria-hidden="true" />
        <span>Add a class · Locked</span>
      </span>
      {reasonText && (
        <p id="add-class-reason" className="mt-1 text-[11px] leading-relaxed text-muted-foreground/70">
          {reasonText}
        </p>
      )}
    </button>
  );
}
