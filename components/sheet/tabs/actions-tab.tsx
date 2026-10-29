"use client";

import { useState, useMemo, useCallback } from "react";
import type { CharacterWithSystem } from "@/lib/types/character";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { EvaluationResult } from "@/lib/engine/evaluator";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import type { RollResult } from "@/lib/dice/types";
import { getWeaponAttack, getWeaponDisplay } from "@/lib/sheet/weapon-attack";
import { getItemData } from "@/lib/inventory/helpers";
import { RollPopover } from "@/components/sheet/rolls/roll-popover";
import { SheetEmptyState } from "@/components/sheet/empty-state";
import { useInventory, useRolls } from "@/lib/character/character-context";

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

export function ActionsTab({
  character,
  schema,
  evalResult,
  contentRefs,
}: ActionsTabProps) {
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");
  const { inventory } = useInventory();

  // Starting awards live in inventory, with their own exact version snapshots.
  // Retain legacy weapon refs without showing a plain same-pin weapon twice.
  const attacks = useMemo(() => {
    const equippedWeapons = inventory.flatMap((item) => {
      const definition = item.content_definitions;
      if (!item.equipped || item.quantity <= 0 || item.character_id !== character.id
        || item.content_type !== "weapon" || definition?.content_type !== "weapon"
        || !item.content_id || item.content_id !== definition.id
        || !Number.isInteger(item.content_version) || item.content_version !== definition.version || definition.version <= 0
        || definition.system_id !== character.system_id) return [];
      return [{ definition, name: item.name, data: getItemData(item),
        plain: item.name === definition.name && Object.keys(item.custom_data ?? {}).length === 0 }];
    });
    const presentedPins = new Set(equippedWeapons.filter((weapon) => weapon.plain)
      .map(({ definition }) => `${definition.id}:${definition.version}`));
    const legacyWeapons = contentRefs.flatMap((ref) => {
      const definition = ref.content_definitions;
      if (definition?.content_type !== "weapon" || presentedPins.has(`${definition.id}:${definition.version}`)) return [];
      return [{ definition, name: definition.name, data: definition.data }];
    });

    return [...equippedWeapons, ...legacyWeapons].map(({ definition, name, data }) => {
      const display = getWeaponDisplay(data);
      return { ...getWeaponAttack(name, definition.slug, data, evalResult, schema),
        requiredAbilities: display.finesse ? ["strength", "dexterity"] : [display.ranged ? "dexterity" : "strength"] };
    });
  }, [inventory, character.id, character.system_id, contentRefs, evalResult, schema]);

  // Attack → damage crit chain (design §3.3/§3.4): a natural 20 on a row's
  // attack roll arms `crit: true` on that row's next damage roll; the damage
  // roll consumes the arming.
  const { mechanicsToken: attackSnapshot } = useRolls();
  const [critState, setCritState] = useState<{ source: object; armed: Record<number, boolean> }>({ source: attackSnapshot, armed: {} });
  const critArmed = critState.source === attackSnapshot ? critState.armed : {};

  const handleAttackResult = useCallback((rowIndex: number, result: RollResult) => {
    setCritState((prev) => ({ source: attackSnapshot, armed: { ...(prev.source === attackSnapshot ? prev.armed : {}), [rowIndex]: result.natural === 20 } }));
  }, [attackSnapshot]);

  const handleDamageRolled = useCallback((rowIndex: number) => {
    setCritState((prev) => prev.source === attackSnapshot && prev.armed[rowIndex] ? { ...prev, armed: { ...prev.armed, [rowIndex]: false } } : prev);
  }, [attackSnapshot]);

  // Collect class features and selected feats with action metadata. Feats use
  // the schema's `action` field while legacy class features use `action_type`.
  const actionFeatures = useMemo(() => {
    return contentRefs.filter((ref) => {
      const ct = ref.content_definitions?.content_type;
      const data = ref.content_definitions?.data;
      if (ct === "feature") return data?.action_type != null;
      if (ct === "feat") return data?.action != null;
      return false;
    });
  }, [contentRefs]);

  const getActionType = useCallback((ref: ContentRefWithContent) => {
    const data = ref.content_definitions?.data;
    return String(data?.action_type ?? data?.action ?? "other");
  }, []);

  // Filter action features by sub-filter
  const filteredActions = useMemo(() => {
    if (activeFilter === "all") return actionFeatures;
    if (activeFilter === "attack") return []; // attacks are in the table
    return actionFeatures.filter((ref) => {
      const actionType = getActionType(ref).toLowerCase();
      if (activeFilter === "bonus") return actionType.includes("bonus");
      if (activeFilter === "reaction") return actionType.includes("reaction");
      if (activeFilter === "action")
        return actionType === "action" || actionType === "standard";
      return actionType === "other" || !["action", "standard", "bonus", "reaction"].some((t) => actionType.includes(t));
    });
  }, [actionFeatures, activeFilter, getActionType]);

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
                ? "bg-character-bg text-character-fg border-character-border"
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
                    <td className="py-2 pr-3 font-medium">
                      <RollPopover
                        kind="attack"
                        mechanicsRequirement={{ abilities: atk.requiredAbilities, computed: ["proficiency_bonus"], values: [atk.hitBonusValue] }}
                        label={`${atk.name} — Attack`}
                        modifier={atk.hitBonusValue}
                        ariaLabel={`Roll ${atk.name} attack`}
                        onResult={(result) => handleAttackResult(i, result)}
                        className="rounded-md border border-border bg-card px-2 py-0.5"
                      >
                        {atk.hitBonus}
                      </RollPopover>
                    </td>
                    <td className="py-2 pr-3">
                      <RollPopover
                        kind="damage"
                        mechanicsRequirement={{ abilities: atk.requiredAbilities, values: [atk.hitBonusValue] }}
                        label={`${atk.name} — Damage`}
                        expression={atk.damageExpression ?? undefined}
                        disabled={atk.damageExpression === null}
                        crit={critArmed[i] === true}
                        meta={atk.damageType ? { damage_type: atk.damageType } : undefined}
                        ariaLabel={`Roll ${atk.name} damage`}
                        onResult={() => handleDamageRolled(i)}
                        className="rounded-md border border-border bg-card px-2 py-0.5 text-left"
                      >
                        {atk.damage}
                        {critArmed[i] && (
                          <span className="ml-1.5 text-xs font-semibold text-emerald-500">
                            Crit!
                          </span>
                        )}
                      </RollPopover>
                    </td>
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
          <SheetEmptyState hint="Equip a weapon from the Inventory tab to see attacks here.">
            No weapons equipped.
          </SheetEmptyState>
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
                  {getActionType(ref)}
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
          <SheetEmptyState>
            No {SUB_FILTERS.find((f) => f.id === activeFilter)?.label?.toLowerCase() ?? "actions"} available.
          </SheetEmptyState>
        )}
    </div>
  );
}
