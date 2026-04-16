"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { searchItems } from "@/lib/supabase/inventory";

interface AddItemModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (item: {
    content_id: string | null;
    name: string;
    content_type: string;
    custom_data?: Record<string, unknown> | null;
  }) => void;
  systemId: string;
}

const FILTER_TABS = [
  { value: "", label: "All" },
  { value: "weapon", label: "Weapons" },
  { value: "armor", label: "Armor" },
  { value: "item", label: "Gear" },
  { value: "magic_item", label: "Magic Items" },
];

export function AddItemModal({ open, onClose, onAdd, systemId }: AddItemModalProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [results, setResults] = useState<Array<{ id: string; name: string; slug: string; content_type: string; data: Record<string, unknown> }>>([]);
  const [loading, setLoading] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customType, setCustomType] = useState("item");

  const doSearch = useCallback(async () => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const items = await searchItems(systemId, query, filter || undefined);
    setResults(items);
    setLoading(false);
  }, [systemId, query, filter]);

  useEffect(() => {
    const timer = setTimeout(doSearch, 300);
    return () => clearTimeout(timer);
  }, [doSearch]);

  function handleAdd(item: typeof results[number]) {
    onAdd({
      content_id: item.id,
      name: item.name,
      content_type: item.content_type,
    });
    onClose();
    setQuery("");
    setResults([]);
  }

  function handleAddCustom() {
    if (!customName.trim()) return;
    onAdd({
      content_id: null,
      name: customName.trim(),
      content_type: customType,
    });
    onClose();
    setCustomName("");
    setShowCustom(false);
  }

  function getItemSubtext(item: typeof results[number]): string {
    const data = item.data;
    if (item.content_type === "weapon") {
      const dmg = data.damage as { dice: string; type: string } | null;
      return dmg ? `${dmg.dice} ${dmg.type}` : "";
    }
    if (item.content_type === "armor") {
      const ac = data.armor_class as { base: number } | null;
      return ac ? `AC ${ac.base}` : "";
    }
    if (item.content_type === "magic_item") {
      return (data.rarity as string) ?? "";
    }
    const weight = data.weight as number | null;
    return weight ? `${weight} lb` : "";
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Item</DialogTitle>
        </DialogHeader>

        {showCustom ? (
          <div className="space-y-3">
            <Input
              placeholder="Item name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              autoFocus
            />
            <select
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="item">Gear</option>
              <option value="weapon">Weapon</option>
              <option value="armor">Armor</option>
              <option value="magic_item">Magic Item</option>
            </select>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCustom(false)}>
                Back
              </Button>
              <Button size="sm" onClick={handleAddCustom} disabled={!customName.trim()}>
                Add Custom Item
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            <div className="flex gap-1 flex-wrap">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setFilter(tab.value)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    filter === tab.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5">
              {loading && <p className="text-sm text-muted-foreground py-4 text-center">Searching...</p>}
              {!loading && query.length >= 2 && results.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">No items found</p>
              )}
              {results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-accent/50 transition-colors text-left"
                  onClick={() => handleAdd(item)}
                >
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{getItemSubtext(item)}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {item.content_type === "magic_item" ? "Magic" : item.content_type}
                  </Badge>
                </button>
              ))}
            </div>

            <Button variant="outline" size="sm" onClick={() => setShowCustom(true)} className="w-full">
              <Plus className="size-4 mr-1" />
              Custom Item
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
