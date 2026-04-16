"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";
import { rarityTextClass } from "@/lib/inventory/rarity-colors";

export interface SearchResult {
  id: string;
  name: string;
  slug: string;
  content_type: string;
  data: Record<string, unknown>;
  effects: Array<Record<string, unknown>>;
}

interface ItemDetailCardProps {
  item: SearchResult;
  quantity: number;
  onQuantityChange: (q: number) => void;
  onAdd: () => void;
}

function formatCost(cost: unknown): string {
  if (!cost || typeof cost !== "object") return "";
  const c = cost as { quantity?: number; unit?: string };
  if (c.quantity == null) return "";
  return `${c.quantity} ${c.unit ?? "gp"}`;
}

export function ItemDetailCard({
  item,
  quantity,
  onQuantityChange,
  onAdd,
}: ItemDetailCardProps) {
  const [showFullDescription, setShowFullDescription] = useState(false);
  const data = item.data;
  const rarity = data.rarity as string | undefined;
  const damage = data.damage as { dice?: string; type?: string } | null;
  const armorClass = data.armor_class as
    | { base?: number; dex_bonus?: boolean; max_bonus?: number }
    | null;
  const armorCategory = data.armor_category as string | undefined;
  const weight = data.weight as number | undefined;
  const cost = data.cost;
  const properties = (data.properties as string[] | undefined) ?? [];
  const description = data.description as string | undefined;
  const sourceRefs = data.source_refs as Array<{ book?: string; page?: number }> | undefined;

  const displayDesc = description
    ? showFullDescription
      ? description
      : description.slice(0, 200) + (description.length > 200 ? "…" : "")
    : null;

  return (
    <div className="rounded-md border border-border bg-card/50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[9px] uppercase">
            {item.content_type === "magic_item" ? "Magic" : item.content_type}
          </Badge>
          {rarity && (
            <span className={`text-xs font-medium ${rarityTextClass(rarity)}`}>
              {rarity}
            </span>
          )}
          {armorCategory && (
            <span className="text-xs text-muted-foreground">
              {armorCategory} armor
            </span>
          )}
        </div>
      </div>

      {damage && (damage.dice || damage.type) && (
        <p className="text-xs">
          <span className="text-muted-foreground">Damage:</span>{" "}
          <span className="font-medium">
            {damage.dice ?? "?"} {damage.type ?? ""}
          </span>
        </p>
      )}

      {armorClass?.base != null && (
        <p className="text-xs">
          <span className="text-muted-foreground">AC:</span>{" "}
          <span className="font-medium">
            {armorClass.base}
            {armorClass.dex_bonus &&
              (armorClass.max_bonus != null
                ? ` + Dex (max +${armorClass.max_bonus})`
                : " + Dex")}
          </span>
        </p>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {weight != null && weight > 0 && <span>{weight} lb</span>}
        {formatCost(cost) && <span>{formatCost(cost)}</span>}
        {properties.length > 0 && <span>{properties.join(", ")}</span>}
      </div>

      {displayDesc && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {displayDesc}
          {description && description.length > 200 && (
            <button
              type="button"
              onClick={() => setShowFullDescription(!showFullDescription)}
              className="ml-1 text-primary underline"
            >
              {showFullDescription ? "less" : "more"}
            </button>
          )}
        </p>
      )}

      {sourceRefs && sourceRefs.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          Source:{" "}
          {sourceRefs
            .map((r) => `${r.book ?? "?"} p${r.page ?? "?"}`)
            .join(", ")}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-6 w-6"
            onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
          >
            <Minus className="size-3" />
          </Button>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => onQuantityChange(parseInt(e.target.value) || 1)}
            className="w-12 h-6 text-center text-xs rounded border border-input bg-background"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-6 w-6"
            onClick={() => onQuantityChange(quantity + 1)}
          >
            <Plus className="size-3" />
          </Button>
        </div>
        <Button type="button" size="sm" onClick={onAdd} className="flex-1">
          Add to Inventory
        </Button>
      </div>
    </div>
  );
}
