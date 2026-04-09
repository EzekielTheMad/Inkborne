import { cn } from "@/lib/utils";
import { formatModifier } from "@/lib/sheet/helpers";

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

interface CombatStatsProps {
  proficiencyBonus: number;
  armorClass: number;
  initiative: number;
  speed: number;
}

export function CombatStats({
  proficiencyBonus,
  armorClass,
  initiative,
  speed,
}: CombatStatsProps) {
  return (
    <div className="flex items-center gap-2">
      <CombatStatCard
        label="PROF"
        value={formatModifier(proficiencyBonus)}
        accent
      />
      <CombatStatCard label="AC" value={armorClass} accent ring />
      <CombatStatCard label="INIT" value={formatModifier(initiative)} />
      <CombatStatCard label="SPEED" value={`${speed}ft`} />
    </div>
  );
}
