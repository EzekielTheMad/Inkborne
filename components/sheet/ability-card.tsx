import { cn } from "@/lib/utils";
import { formatModifier } from "@/lib/sheet/helpers";

interface AbilityCardProps {
  name: string;
  score: number;
  modifier: number;
  className?: string;
}

export function AbilityCard({ name, score, modifier, className }: AbilityCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-3 text-center min-w-[70px]",
        className,
      )}
    >
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        {name}
      </p>
      <p className="text-2xl font-bold text-foreground leading-tight">
        {formatModifier(modifier)}
      </p>
      <p className="text-sm text-muted-foreground">{score}</p>
    </div>
  );
}
