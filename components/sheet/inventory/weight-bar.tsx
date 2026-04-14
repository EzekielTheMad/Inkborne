"use client";

interface WeightBarProps {
  totalWeight: number;
  carryingCapacity: number;
}

export function WeightBar({ totalWeight, carryingCapacity }: WeightBarProps) {
  const pct = carryingCapacity > 0 ? Math.min((totalWeight / carryingCapacity) * 100, 100) : 0;
  const isEncumbered = carryingCapacity > 0 && totalWeight > carryingCapacity / 3;
  const isHeavy = carryingCapacity > 0 && totalWeight > (carryingCapacity * 2) / 3;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Weight</span>
        <span className={isHeavy ? "text-destructive font-medium" : isEncumbered ? "text-yellow-500" : "text-muted-foreground"}>
          {totalWeight} lb / {carryingCapacity} lb
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isHeavy ? "bg-destructive" : isEncumbered ? "bg-yellow-500" : "bg-primary"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
