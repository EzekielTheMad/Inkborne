"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  searchItems,
  type SearchItemsOptions,
} from "@/lib/supabase/inventory";
import { rarityTextClass } from "@/lib/inventory/rarity-colors";
import {
  ItemFilters,
  type CategoryPill,
} from "@/components/sheet/inventory/item-filters";
import { CustomItemForm } from "@/components/sheet/inventory/custom-item-form";
import {
  ItemDetailCard,
  type SearchResult,
} from "@/components/sheet/inventory/item-detail-card";

const CATEGORY_TO_CONTENT_TYPE: Record<CategoryPill, SearchItemsOptions> = {
  Armor: { equipmentCategory: "Armor" },
  Weapon: { equipmentCategory: "Weapon" },
  Potion: { equipmentCategory: "Potion" },
  Ring: { equipmentCategory: "Ring" },
  Rod: { equipmentCategory: "Rod" },
  Scroll: { equipmentCategory: "Scroll" },
  Staff: { equipmentCategory: "Staff" },
  Wand: { equipmentCategory: "Wand" },
  Wondrous: { equipmentCategory: "Wondrous" },
  Gear: { equipmentCategory: "Gear" },
};

export interface AddItemPanelProps {
  open: boolean;
  onClose: () => void;
  onAdd: (item: {
    content_id: string | null;
    content_version?: number | null;
    name: string;
    content_type: string;
    quantity?: number;
    custom_data?: Record<string, unknown> | null;
  }) => void | Promise<void>;
  systemId: string;
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
  const [searchError, setSearchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [showCustom, setShowCustom] = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequest = useRef(0);

  const runSearch = useCallback(async () => {
    const requestId = ++searchRequest.current;
    setLoading(true);
    setSearchError(null);
    const opts: SearchItemsOptions = {
      ...(category ? CATEGORY_TO_CONTENT_TYPE[category] : {}),
      magicalOnly: magicalOnly || undefined,
    };
    try {
      const data = await searchItems(systemId, query, opts);
      if (requestId === searchRequest.current) setResults(data);
    } catch (error) {
      console.error("[AddItemPanel] Search failed:", error);
      if (requestId === searchRequest.current) {
        setResults([]);
        setSearchError("Items could not be loaded. Please try again.");
      }
    } finally {
      if (requestId === searchRequest.current) setLoading(false);
    }
  }, [systemId, query, category, magicalOnly]);

  useEffect(() => {
    if (!open) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(runSearch, 200);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      searchRequest.current += 1;
    };
  }, [runSearch, open]);

  if (!open) return null;

  const getQuantity = (id: string) => quantities[id] ?? 1;
  const setQuantity = (id: string, q: number) =>
    setQuantities((prev) => ({ ...prev, [id]: q }));

  const handleAdd = async (item: SearchResult, qty: number) => {
    if (busyId) return;
    setBusyId(item.id);
    setActionError(null);
    try {
      await onAdd({
        content_id: item.id,
        content_version: item.version,
        name: item.name,
        content_type: item.content_type,
        quantity: qty,
      });
      setExpandedId(null);
    } catch (error) {
      console.error("[AddItemPanel] Add failed:", error);
      setActionError("The item could not be added. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const handleCustomAdd = async (
    item: Parameters<AddItemPanelProps["onAdd"]>[0],
  ) => {
    setActionError(null);
    try {
      await onAdd(item);
      setShowCustom(false);
    } catch (error) {
      console.error("[AddItemPanel] Custom item add failed:", error);
      setActionError("The custom item could not be added. Please try again.");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-background space-y-3 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Add item</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search items…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      <ItemFilters
        selected={category}
        onSelect={setCategory}
        magicalOnly={magicalOnly}
        onMagicalToggle={setMagicalOnly}
      />

      {actionError && (
        <p className="text-xs text-destructive" role="alert">
          {actionError}
        </p>
      )}

      <div className="max-h-[400px] overflow-y-auto space-y-1">
        {loading && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Searching…
          </p>
        )}
        {!loading && searchError && (
          <div className="space-y-2 py-4 text-center" role="alert">
            <p className="text-xs text-destructive">{searchError}</p>
            <Button variant="outline" size="sm" onClick={runSearch}>
              Try again
            </Button>
          </div>
        )}
        {!loading && !searchError && results.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No items found. Try adjusting filters.
          </p>
        )}
        {results.map((item) => {
          const rarity = item.data?.rarity as string | undefined;
          const isExpanded = expandedId === item.id;
          return (
            <div
              key={item.id}
              className="rounded border border-border/50 overflow-hidden"
            >
              <button
                type="button"
                onClick={() =>
                  setExpandedId(isExpanded ? null : item.id)
                }
                className="w-full flex items-center justify-between px-2 py-1.5 text-left hover:bg-accent/30"
              >
                <span
                  className={`text-sm font-medium ${rarityTextClass(rarity)}`}
                >
                  {item.name}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase">
                  {item.content_type === "magic_item"
                    ? "Magic"
                    : item.content_type}
                </span>
              </button>
              {isExpanded && (
                <div className="p-2 border-t border-border/50">
                  <ItemDetailCard
                    item={item}
                    quantity={getQuantity(item.id)}
                    onQuantityChange={(q) => setQuantity(item.id, q)}
                    onAdd={() => {
                      void handleAdd(item, getQuantity(item.id));
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showCustom ? (
        <CustomItemForm
          onAdd={(item) => {
            void handleCustomAdd(item);
          }}
          onCancel={() => setShowCustom(false)}
        />
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setShowCustom(true)}
        >
          + Add custom item
        </Button>
      )}
    </div>
  );
}
