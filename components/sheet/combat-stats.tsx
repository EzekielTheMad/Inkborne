import { cn } from "@/lib/utils";
import { formatModifier } from "@/lib/sheet/helpers";
import type { SpeedData } from "@/lib/schemas/content-types/mechanical";

interface CombatStatCardProps {
  label: string;
  value: string | number;
  accent?: boolean;
  ring?: boolean;
}

function CombatStatCard({ label, value, accent, ring }: CombatStatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-2.5 text-center min-w-[60px]",
        ring ? "border-primary" : "border-border",
      )}
    >
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p
        className={cn(
          "text-xl font-bold leading-tight",
          accent ? "text-accent" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

const SPEED_LABELS: Record<string, string> = {
  walk: "Walk",
  fly: "Fly",
  swim: "Swim",
  climb: "Climb",
  burrow: "Burrow",
};

interface CombatStatsProps {
  proficiencyBonus: number;
  armorClass: number;
  initiative: number;
  speed: number;
  speedDetail?: SpeedData;
}

export function CombatStats({
  proficiencyBonus,
  armorClass,
  initiative,
  speed,
  speedDetail,
}: CombatStatsProps) {
  // Build the speed display: use speedDetail if available, fall back to single speed number
  const extraSpeeds = speedDetail
    ? (Object.entries(speedDetail) as [string, number | undefined][])
        .filter(([key, val]) => key !== "walk" && key !== "encumbered" && val != null && val > 0)
        .map(([key, val]) => ({ label: SPEED_LABELS[key] ?? key, value: val! }))
    : [];

  const walkSpeed = speedDetail?.walk ?? speed;

  return (
    <div className="flex items-center gap-2">
      <CombatStatCard
        label="PROF"
        value={formatModifier(proficiencyBonus)}
        accent
      />
      <CombatStatCard label="AC" value={armorClass} accent ring />
      <CombatStatCard label="INIT" value={formatModifier(initiative)} />
      <div className="flex flex-col items-center gap-0.5">
        <CombatStatCard label="SPEED" value={`${walkSpeed}ft`} />
        {extraSpeeds.length > 0 && (
          <div className="flex gap-1.5">
            {extraSpeeds.map(({ label, value }) => (
              <span
                key={label}
                className="text-[10px] text-muted-foreground"
              >
                {label} {value}ft
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
