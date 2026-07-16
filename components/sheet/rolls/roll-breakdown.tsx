import type { RollResult } from "@/lib/dice/types";
import type { RollModifier } from "@/lib/types/active-effects";
import { cn } from "@/lib/utils";

/**
 * Shared dice-breakdown renderer used by the roll toast and the roll log
 * panel: one span per dice group ("d20: 14, 8" with dropped dice struck
 * through), plus the flat modifier ("+5").
 *
 * Active-effect roll riders (`meta.roll_modifiers`, appended last by
 * `buildD20RollRequest`) are attributed by name: `1d20+5 · d4: 3 (Bless)`.
 */
export function RollBreakdown({
  result,
  className,
}: {
  result: RollResult;
  className?: string;
}) {
  // Riders contribute one trailing dice group each, in order.
  const riders =
    (result.request.meta?.roll_modifiers as RollModifier[] | undefined) ?? [];
  const riderOffset = result.groups.length - riders.length;

  return (
    <div
      data-slot="roll-breakdown"
      className={cn(
        "flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-muted-foreground",
        className,
      )}
    >
      {result.groups.map((group, groupIndex) => {
        const dropped = droppedFlags(group.rolls, group.kept);
        const rider =
          riders.length > 0 && groupIndex >= riderOffset && riderOffset >= 0
            ? riders[groupIndex - riderOffset]
            : undefined;
        return (
          <span key={groupIndex} className="whitespace-nowrap tabular-nums">
            <span className="font-medium">d{group.sides}:</span>{" "}
            {group.rolls.map((face, faceIndex) => (
              <span key={faceIndex}>
                {faceIndex > 0 && ", "}
                <span
                  className={cn(
                    dropped[faceIndex] && "line-through opacity-50",
                  )}
                >
                  {face}
                </span>
              </span>
            ))}
            {rider && <span className="opacity-80"> ({rider.name})</span>}
          </span>
        );
      })}
      {result.modifier !== 0 && (
        <span className="whitespace-nowrap tabular-nums">
          {result.modifier > 0 ? `+${result.modifier}` : `${result.modifier}`}
        </span>
      )}
    </div>
  );
}

/**
 * Marks which rolled faces were dropped by a keep spec. `kept` preserves roll
 * order, so a greedy left-to-right multiset match assigns each kept value to
 * the earliest matching face (ties are indistinguishable by value anyway).
 */
function droppedFlags(rolls: number[], kept: number[]): boolean[] {
  const remaining = [...kept];
  return rolls.map((face) => {
    const idx = remaining.indexOf(face);
    if (idx >= 0) {
      remaining.splice(idx, 1);
      return false;
    }
    return true;
  });
}
