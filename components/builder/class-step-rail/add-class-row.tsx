import { Lock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type AddClassRowProps =
  | {
      /** Locked state — same as PR-B. Renders the dashed-border, lock-icon row with reasons. */
      unlocked?: false;
      reasons: string[];
      onClick?: () => void;
      levelsRemaining?: never;
      /** Override for the reasons list. When present, renders instead of joined reasons. */
      disabledReason?: string;
    }
  | {
      /** Unlocked state — renders the accent-border row with plus icon. */
      unlocked: true;
      levelsRemaining: number;
      onClick: () => void;
      reasons?: never;
      disabledReason?: never;
    };

export function AddClassRow(props: AddClassRowProps) {
  if (props.unlocked) {
    return (
      <button
        type="button"
        onClick={props.onClick}
        className={cn(
          "w-full rounded-md border px-3 py-2 text-left transition-colors",
          "border-[rgba(201,164,74,0.45)] bg-[rgba(201,164,74,0.06)]",
          "hover:bg-[rgba(201,164,74,0.12)] cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <span className="flex items-center gap-2 text-xs text-foreground">
          <Plus className="size-3.5 text-[#c9a44a]" aria-hidden="true" />
          <span>Add a class · {props.levelsRemaining} levels remaining</span>
        </span>
      </button>
    );
  }

  const { reasons, onClick, disabledReason } = props;
  const reasonText = disabledReason ?? reasons.slice(0, 3).join(" · ");
  return (
    <button
      type="button"
      aria-disabled="true"
      aria-describedby="add-class-reason"
      title={disabledReason ? disabledReason : reasons.join("\n")}
      className="w-full rounded-md border border-dashed border-muted px-3 py-2 text-left transition-colors cursor-not-allowed"
      onClick={(e) => {
        e.preventDefault();
        // Locked: ignore onClick. Provided so the rail can pass a single handler unconditionally.
        void onClick;
      }}
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
