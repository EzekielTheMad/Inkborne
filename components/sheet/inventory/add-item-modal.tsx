"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  Plus,
  Minus,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { searchItems } from "@/lib/supabase/inventory";
import type { SearchItemsOptions } from "@/lib/supabase/inventory";
import { rarityTextClass } from "@/lib/inventory/rarity-colors";

interface AddItemPanelProps {
  open: boolean;
  onClose: () => void;
  onAdd: (item: {
    content_id: string | null;
    name: string;
    content_type: string;
    quantity?: number;
    custom_data?: Record<string, unknown> | null;
  }) => void;
  systemId: string;
}

interface SearchResult {
  id: string;
  name: string;
  slug: string;
  content_type: string;
  data: Record<string, unknown>;
  effects: Array<Record<string, unknown>>;
}

const CATEGORY_PILLS = [
  "Armor",
  "Weapon",
  "Potion",
  "Ring",
  "Rod",
  "Scroll",
  "Staff",
  "Wand",
  "Wondrous",
  "Gear",
] as const;

type CategoryPill = (typeof CATEGORY_PILLS)[number];

function formatCost(cost: unknown): string | null {
  if (!cost || typeof cost !== "object") return null;
  const c = cost as { quantity?: number; unit?: string };
  if (!c.quantity || !c.unit) return null;
  return `${c.quantity} ${c.unit}`;
}

function getItemSubtext(item: SearchResult): string {
  const parts: string[] = [];
  const data = item.data;

  // Type label
  if (item.content_type === "magic_item") {
    const cat = data.equipment_category as string | undefined;
    parts.push(cat ?? "Magic Item");
  } else {
    const typeMap: Record<string, string> = {
      weapon: "Weapon",
      armor: "Armor",
      item: "Gear",
    };
    parts.push(typeMap[item.content_type] ?? item.content_type);
  }

  // Category for armor
  if (item.content_type === "armor") {
    const cat = data.armor_category as string | undefined;
    if (cat) parts.push(cat);
  }

  // Damage for weapons
  if (item.content_type === "weapon") {
    const dmg = data.damage as { dice?: string; type?: string } | null;
    if (dmg?.dice) parts.push(`${dmg.dice} ${dmg.type ?? ""}`.trim());
  }

  // AC for armor
  if (item.content_type === "armor") {
    const ac = data.armor_class as { base?: number } | null;
    if (ac?.base) parts.push(`AC ${ac.base}`);
  }

  // Weight
  const weight = data.weight as number | null;
  if (weight) parts.push(`${weight} lb`);

  return parts.join(" \u00b7 ");
}

function ItemDetailCard({
  item,
  quantity,
  onQuantityChange,
  onAdd,
}: {
  item: SearchResult;
  quantity: number;
  onQuantityChange: (q: number) => void;
  onAdd: () => void;
}) {
  const [showFullDesc, setShowFullDesc] = useState(false);
  const data = item.data;

  const rarity = data.rarity as string | undefined;
  const damage = data.damage as {
    dice?: string;
    type?: string;
  } | null;
  const armorClass = data.armor_class as {
    base?: number;
    dex_bonus?: boolean;
    max_bonus?: number;
  } | null;
  const armorCategory = data.armor_category as string | undefined;
  const weight = data.weight as number | null;
  const cost = data.cost;
  const properties = (data.properties as string[]) ?? [];
  const description = (data.description ?? data.desc) as string | undefined;
  const sourceRefs = data.source_refs as
    | Array<{ source?: string; page?: number }>
    | undefined;

  return (
    <div className="mx-2 mb-2 p-3 rounded-lg bg-card border border-border space-y-2 text-sm">
      {/* Type and rarity row */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-[10px]">
          {item.content_type === "magic_item"
            ? "Magic Item"
            : item.content_type}
        </Badge>
        {rarity && (
          <Badge variant="secondary" className={`text-[10px] ${rarityTextClass(rarity)}`}>
            {rarity}
          </Badge>
        )}
        {armorCategory && (
          <span className="text-xs text-muted-foreground">{armorCategory}</span>
        )}
      </div>

      {/* Damage */}
      {damage?.dice && (
        <div className="text-xs">
          <span className="text-muted-foreground">Damage:</span>{" "}
          {damage.dice} {damage.type ?? ""}
        </div>
      )}

      {/* Armor Class */}
      {armorClass?.base != null && (
        <div className="text-xs">
          <span className="text-muted-foreground">AC:</span> {armorClass.base}
          {armorClass.dex_bonus && " + DEX"}
          {armorClass.max_bonus != null &&
            ` (max ${armorClass.max_bonus})`}
        </div>
      )}

      {/* Weight and Cost */}
      <div className="flex gap-4 text-xs">
        {weight != null && weight > 0 && (
          <span>
            <span className="text-muted-foreground">Weight:</span> {weight} lb
          </span>
        )}
        {formatCost(cost) && (
          <span>
            <span className="text-muted-foreground">Cost:</span>{" "}
            {formatCost(cost)}
          </span>
        )}
      </div>

      {/* Properties */}
      {properties.length > 0 && (
        <div className="text-xs">
          <span className="text-muted-foreground">Properties:</span>{" "}
          {properties.join(", ")}
        </div>
      )}

      {/* Description */}
      {description && (
        <div className="text-xs text-muted-foreground">
          <p className={showFullDesc ? "" : "line-clamp-3"}>{description}</p>
          {description.length > 150 && (
            <button
              type="button"
              className="text-primary text-[11px] mt-0.5 hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                setShowFullDesc(!showFullDesc);
              }}
            >
              {showFullDesc ? "show less" : "show more"}
            </button>
          )}
        </div>
      )}

      {/* Source */}
      {sourceRefs && sourceRefs.length > 0 && (
        <div className="text-[10px] text-muted-foreground/70">
          Source:{" "}
          {sourceRefs
            .map((s) => `${s.source ?? ""}${s.page ? ` p.${s.page}` : ""}`)
            .join(", ")}
        </div>
      )}

      {/* Quantity + Add button */}
      <div className="flex items-center justify-between pt-1 border-t border-border/50">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="size-6 rounded border border-input flex items-center justify-center hover:bg-accent"
            onClick={(e) => {
              e.stopPropagation();
              onQuantityChange(Math.max(1, quantity - 1));
            }}
          >
            <Minus className="size-3" />
          </button>
          <input
            type="number"
            min={1}
            max={999}
            value={quantity}
            onChange={(e) => {
              e.stopPropagation();
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 1) onQuantityChange(v);
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-10 h-6 text-center text-sm border border-input rounded bg-background"
          />
          <button
            type="button"
            className="size-6 rounded border border-input flex items-center justify-center hover:bg-accent"
            onClick={(e) => {
              e.stopPropagation();
              onQuantityChange(quantity + 1);
            }}
          >
            <Plus className="size-3" />
          </button>
        </div>
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
        >
          ADD ITEM
        </Button>
      </div>
    </div>
  );
}

export function AddItemPanel({
  open,
  onClose,
  onAdd,
  systemId,
}: AddItemPanelProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryPill | null>(null);
  const [magicalOnly, setMagicalOnly] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customType, setCustomType] = useState("item");
  const [customWeight, setCustomWeight] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const doSearch = useCallback(async () => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const opts: SearchItemsOptions = {};
    if (category) {
      opts.equipmentCategory = category;
    }
    if (magicalOnly) {
      opts.magicalOnly = true;
    }
    const items = await searchItems(systemId, query, opts);
    setResults(items);
    setLoading(false);
  }, [systemId, query, category, magicalOnly]);

  useEffect(() => {
    const timer = setTimeout(doSearch, 300);
    return () => clearTimeout(timer);
  }, [doSearch]);

  // Focus search input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [open]);

  function handleAddFromSearch(item: SearchResult) {
    const qty = quantities[item.id] ?? 1;
    onAdd({
      content_id: item.id,
      name: item.name,
      content_type: item.content_type,
      quantity: qty,
    });
    // Reset quantity for this item after adding
    setQuantities((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
  }

  function handleQuickAdd(
    e: React.MouseEvent,
    item: SearchResult,
  ) {
    e.stopPropagation();
    onAdd({
      content_id: item.id,
      name: item.name,
      content_type: item.content_type,
      quantity: 1,
    });
  }

  function handleAddCustom() {
    if (!customName.trim()) return;
    const customData: Record<string, unknown> = {};
    if (customWeight) customData.weight = parseFloat(customWeight);
    if (customDescription) customData.description = customDescription;
    onAdd({
      content_id: null,
      name: customName.trim(),
      content_type: customType,
      custom_data: Object.keys(customData).length > 0 ? customData : null,
    });
    setCustomName("");
    setCustomWeight("");
    setCustomDescription("");
  }

  if (!open) return null;

  const panelContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <p className="text-sm font-semibold">Add Items</p>
        <button
          type="button"
          onClick={onClose}
          className="size-6 rounded-md flex items-center justify-center hover:bg-accent"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            ref={searchRef}
            placeholder="Search items..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Category pills */}
      <div className="px-3 pt-2 flex gap-1 flex-wrap shrink-0">
        {CATEGORY_PILLS.map((pill) => (
          <button
            key={pill}
            type="button"
            onClick={() => setCategory(category === pill ? null : pill)}
            className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
              category === pill
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {pill}
          </button>
        ))}
      </div>

      {/* Checkbox filters */}
      <div className="px-3 pt-2 flex gap-4 shrink-0">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={magicalOnly}
            onChange={(e) => setMagicalOnly(e.target.checked)}
            className="size-3.5 rounded border-muted-foreground/50 accent-primary"
          />
          Magical
        </label>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto min-h-0 mt-2">
        {loading && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Searching...
          </p>
        )}
        {!loading && query.length >= 2 && results.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No items found
          </p>
        )}
        {!loading && query.length < 2 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Type at least 2 characters to search
          </p>
        )}
        {results.map((item) => {
          const isExpanded = expandedId === item.id;
          const itemRarity = item.data?.rarity as string | undefined;
          return (
            <div key={item.id}>
              <button
                type="button"
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-accent/50 transition-colors text-left"
                onClick={() =>
                  setExpandedId(isExpanded ? null : item.id)
                }
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm font-medium truncate ${rarityTextClass(itemRarity)}`}>
                      {item.name}
                    </span>
                    {item.effects && item.effects.length > 0 && (
                      <span className="size-1.5 rounded-full bg-primary shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {getItemSubtext(item)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={(e) => handleQuickAdd(e, item)}
                  >
                    Add
                  </Button>
                  {isExpanded ? (
                    <ChevronUp className="size-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="size-3.5 text-muted-foreground" />
                  )}
                </div>
              </button>
              {isExpanded && (
                <ItemDetailCard
                  item={item}
                  quantity={quantities[item.id] ?? 1}
                  onQuantityChange={(q) =>
                    setQuantities((prev) => ({ ...prev, [item.id]: q }))
                  }
                  onAdd={() => handleAddFromSearch(item)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Custom item section */}
      <div className="border-t border-border shrink-0">
        <button
          type="button"
          className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-accent/50 transition-colors"
          onClick={() => setShowCustom(!showCustom)}
        >
          <span className="flex items-center gap-1.5">
            <Plus className="size-3.5" />
            Add Custom Item
          </span>
          {showCustom ? (
            <ChevronUp className="size-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-3.5 text-muted-foreground" />
          )}
        </button>
        {showCustom && (
          <div className="px-3 pb-3 space-y-2">
            <Input
              placeholder="Item name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
            <div className="flex gap-2">
              <select
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="item">Gear</option>
                <option value="weapon">Weapon</option>
                <option value="armor">Armor</option>
                <option value="magic_item">Magic Item</option>
              </select>
              <Input
                placeholder="Weight (lb)"
                value={customWeight}
                onChange={(e) => setCustomWeight(e.target.value)}
                className="w-24"
                type="number"
                min={0}
                step={0.1}
              />
            </div>
            <textarea
              placeholder="Description (optional)"
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              className="w-full h-16 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            />
            <Button
              size="sm"
              onClick={handleAddCustom}
              disabled={!customName.trim()}
              className="w-full"
            >
              Add Custom Item
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: inline panel */}
      <div className="hidden md:block border border-border rounded-lg bg-card max-h-[60vh] overflow-y-auto">
        {panelContent}
      </div>

      {/* Mobile: full-screen overlay */}
      <div className="fixed inset-0 z-50 bg-background flex flex-col md:hidden">
        {panelContent}
      </div>
    </>
  );
}
