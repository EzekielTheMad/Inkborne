"use client";

import { useState, useMemo } from "react";
import type { CharacterWithSystem } from "@/lib/types/character";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { EvaluationResult } from "@/lib/engine/evaluator";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import { formatModifier, isProficient } from "@/lib/sheet/helpers";

const SUB_FILTERS = [
  { id: "all", label: "All" },
  { id: "attack", label: "Attack" },
  { id: "action", label: "Action" },
  { id: "bonus", label: "Bonus Action" },
  { id: "reaction", label: "Reaction" },
  { id: "other", label: "Other" },
] as const;

type FilterId = (typeof SUB_FILTERS)[number]["id"];

interface ActionsTabProps {
  character: CharacterWithSystem;
  schema: SystemSchemaDefinition;
  evalResult: EvaluationResult;
  contentRefs: ContentRefWithContent[];
}

interface AttackRow {
  name: string;
  range: string;
  hitBonus: string;
  damage: string;
  properties: string;
}

export function ActionsTab({
  character,
  schema,
  evalResult,
  contentRefs,
}: ActionsTabProps) {
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");

  const proficiencyBonus = evalResult.computed.proficiency_bonus ?? 2;

  // Build attack rows from weapon content refs
  const attacks = useMemo((): AttackRow[] => {
    const weaponRefs = contentRefs.filter(
      (ref) => ref.content_definitions?.content_type === "weapon",
    );

    return weaponRefs.map((ref) => {
      const data = ref.content_definitions?.data ?? {};
      const name = ref.content_definitions?.name ?? "Unknown Weapon";
      const range = (data.range as string) ?? "5 ft";
      const damageDice = (data.damage as string) ?? "1d4";
      const damageType = (data.damage_type as string) ?? "";
      const properties = Array.isArray(data.properties)
        ? (data.properties as string[]).join(", ")
        : "";

      // Determine ability modifier for attack/damage
      const isFinesse = properties.toLowerCase().includes("finesse");
      const isRanged =
        (data.weapon_type as string)?.includes("ranged") ||
        range.includes("/");

      const strMod = evalResult.stats.strength
        ? Math.floor((evalResult.stats.strength - 10) / 2)
        : 0;
      const dexMod = evalResult.stats.dexterity
        ? Math.floor((evalResult.stats.dexterity - 10) / 2)
        : 0;

      let abilityMod = isRanged ? dexMod : strMod;
      if (isFinesse) abilityMod = Math.max(strMod, dexMod);

      // Check weapon proficiency (simplified — check for weapon category grants)
      const weaponSlug = ref.content_definitions?.slug ?? "";
      const hasProficiency =
        isProficient(evalResult.grants, weaponSlug) ||
        isProficient(evalResult.grants, `weapon_${weaponSlug}`) ||
        isProficient(evalResult.grants, "simple_weapons") ||
        isProficient(evalResult.grants, "martial_weapons");

      const hitBonus = abilityMod + (hasProficiency ? proficiencyBonus : 0);
      const damageStr = `${damageDice}${abilityMod >= 0 ? " + " + abilityMod : " - " + Math.abs(abilityMod)}${damageType ? ` ${damageType}` : ""}`;

      return {
        name,
        range,
        hitBonus: formatModifier(hitBonus),
        damage: damageStr,
        properties,
      };
    });
  }, [contentRefs, evalResult, proficiencyBonus]);

  // Collect action-type features (class features with action metadata)
  const actionFeatures = useMemo(() => {
    return contentRefs.filter((ref) => {
      const ct = ref.content_definitions?.content_type;
      if (ct !== "feature") return false;
      const data = ref.content_definitions?.data;
      return data?.action_type != null;
    });
  }, [contentRefs]);

  // Filter action features by sub-filter
  const filteredActions = useMemo(() => {
    if (activeFilter === "all") return actionFeatures;
    if (activeFilter === "attack") return []; // attacks are in the table
    return actionFeatures.filter((ref) => {
      const actionType = String(
        ref.content_definitions?.data?.action_type ?? "other",
      ).toLowerCase();
      if (activeFilter === "bonus") return actionType.includes("bonus");
      if (activeFilter === "reaction") return actionType.includes("reaction");
      if (activeFilter === "action")
        return actionType === "action" || actionType === "standard";
      return actionType === "other" || !["action", "standard", "bonus", "reaction"].some((t) => actionType.includes(t));
    });
  }, [actionFeatures, activeFilter]);

  return (
    <div className="space-y-4">
      {/* Sub-filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {SUB_FILTERS.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              activeFilter === filter.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Attack table */}
      {(activeFilter === "all" || activeFilter === "attack") &&
        attacks.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-3 text-xs font-semibold uppercase text-muted-foreground">
                    Attack
                  </th>
                  <th className="py-2 pr-3 text-xs font-semibold uppercase text-muted-foreground">
                    Range
                  </th>
                  <th className="py-2 pr-3 text-xs font-semibold uppercase text-muted-foreground">
                    Hit/DC
                  </th>
                  <th className="py-2 pr-3 text-xs font-semibold uppercase text-muted-foreground">
                    Damage
                  </th>
                  <th className="py-2 text-xs font-semibold uppercase text-muted-foreground">
                    Properties
                  </th>
                </tr>
              </thead>
              <tbody>
                {attacks.map((atk, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 pr-3 text-accent font-medium">
                      {atk.name}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {atk.range}
                    </td>
                    <td className="py-2 pr-3 font-medium">{atk.hitBonus}</td>
                    <td className="py-2 pr-3">{atk.damage}</td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {atk.properties}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {/* No attacks message */}
      {(activeFilter === "all" || activeFilter === "attack") &&
        attacks.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            No weapons equipped. Add weapons via content references.
          </p>
        )}

      {/* Action-type features */}
      {filteredActions.length > 0 && (
        <div className="space-y-2">
          {filteredActions.map((ref) => (
            <div
              key={ref.id}
              className="rounded-md border border-border bg-card p-3 space-y-1"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-accent font-medium text-sm">
                  {ref.content_definitions?.name ?? "Unknown Action"}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                  {String(ref.content_definitions?.data?.action_type ?? "Action")}
                </span>
              </div>
              {ref.content_definitions?.data?.description != null && (
                <p className="text-sm text-foreground">
                  {String(ref.content_definitions.data.description)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state for non-attack filters */}
      {activeFilter !== "all" &&
        activeFilter !== "attack" &&
        filteredActions.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            No {SUB_FILTERS.find((f) => f.id === activeFilter)?.label?.toLowerCase() ?? "actions"} available.
          </p>
        )}
    </div>
  );
}
