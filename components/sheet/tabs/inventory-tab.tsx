"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { InventoryItem } from "@/lib/types/inventory";
import { InventorySection } from "@/components/sheet/inventory/inventory-section";
import { CurrencyTracker } from "@/components/sheet/inventory/currency-tracker";
import { WeightBar } from "@/components/sheet/inventory/weight-bar";
import { AddItemPanel } from "@/components/sheet/inventory/add-item-panel";
import { rarityTextClass } from "@/lib/inventory/rarity-colors";
import { getItemData, getItemWeight, isShield, isBodyArmor } from "@/lib/inventory/helpers";
import { useInventory, useCharacter } from "@/lib/character/character-context";

export function InventoryTab() {
  const { inventory, currency, addItem, updateItem, removeItem, setCurrency } = useInventory();
  const { character, evalResult } = useCharacter();
  const systemId = character.system_id;
  const strengthScore = evalResult.stats.strength ?? 10;

  const [showAddPanel, setShowAddPanel] = useState(false);

  const equipped = inventory.filter((i) => i.equipped);
  const weapons = inventory.filter((i) => i.content_type === "weapon");
  const armor = inventory.filter((i) => isBodyArmor(i) || isShield(i));
  const gear = inventory.filter((i) => i.content_type === "item");
  const magicItems = inventory.filter((i) => i.content_type === "magic_item");

  const totalWeight = inventory.reduce((sum, i) => sum + getItemWeight(i) * i.quantity, 0);
  const carryingCapacity = strengthScore * 15;
  const attunedCount = inventory.filter((i) => i.attuned).length;

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Inventory</p>
        <Button size="sm" variant="outline" onClick={() => setShowAddPanel(!showAddPanel)}>
          <Plus className="size-3.5 mr-1" />
          {showAddPanel ? "Close" : "Add Item"}
        </Button>
      </div>

      {/* Add Item Panel — inline at top */}
      <AddItemPanel
        open={showAddPanel}
        onClose={() => setShowAddPanel(false)}
        onAdd={addItem}
        systemId={systemId}
      />

      {/* Equipped section */}
      {equipped.length > 0 && (
        <InventorySection title="Equipped" count={equipped.length} highlight defaultOpen>
          {equipped.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onUpdate={(updates) => updateItem(item.id, updates)}
              onRemove={() => removeItem(item.id)}
              showEquipToggle={false}
            />
          ))}
        </InventorySection>
      )}

      {/* Weapons */}
      {weapons.length > 0 && (
        <InventorySection title="Weapons" count={weapons.length}>
          {weapons.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onUpdate={(updates) => updateItem(item.id, updates)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </InventorySection>
      )}

      {/* Armor & Shields */}
      {armor.length > 0 && (
        <InventorySection title="Armor & Shields" count={armor.length}>
          {armor.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onUpdate={(updates) => updateItem(item.id, updates)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </InventorySection>
      )}

      {/* Gear */}
      {gear.length > 0 && (
        <InventorySection title="Gear" count={gear.length}>
          {gear.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onUpdate={(updates) => updateItem(item.id, updates)}
              onRemove={() => removeItem(item.id)}
              showQuantity
            />
          ))}
        </InventorySection>
      )}

      {/* Magic Items */}
      {magicItems.length > 0 && (
        <InventorySection
          title="Magic Items"
          count={magicItems.length}
          badge={<Badge variant="secondary" className="text-[10px]">{attunedCount}/3 attuned</Badge>}
        >
          {magicItems.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onUpdate={(updates) => updateItem(item.id, updates)}
              onRemove={() => removeItem(item.id)}
              showAttunement
              attunedCount={attunedCount}
            />
          ))}
        </InventorySection>
      )}

      {/* Currency */}
      <CurrencyTracker currency={currency} onChange={setCurrency} />

      {/* Weight */}
      <WeightBar totalWeight={Math.round(totalWeight)} carryingCapacity={carryingCapacity} />

    </div>
  );
}

// --- Item Row ---

interface ItemRowProps {
  item: InventoryItem;
  onUpdate: (updates: Partial<Pick<InventoryItem, "quantity" | "equipped" | "attuned">>) => void;
  onRemove: () => void;
  showEquipToggle?: boolean;
  showQuantity?: boolean;
  showAttunement?: boolean;
  attunedCount?: number;
}

function ItemRow({
  item,
  onUpdate,
  onRemove,
  showEquipToggle = true,
  showQuantity = false,
  showAttunement = false,
  attunedCount = 0,
}: ItemRowProps) {
  const data = getItemData(item);
  const weight = getItemWeight(item);

  // Weapon info
  const damage = data.damage as { dice: string; type: string } | null;
  const properties = (data.properties as string[]) ?? [];

  // Armor info
  const armorClass = data.armor_class as { base: number; dex_bonus?: boolean; max_bonus?: number } | null;
  const armorCategory = data.armor_category as string | undefined;

  // Magic item info
  const rarity = data.rarity as string | undefined;
  const requiresAttunement = data.requires_attunement as boolean | undefined;

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-accent/30 transition-colors group text-sm">
      {/* Equip toggle */}
      {showEquipToggle && (
        <button
          type="button"
          onClick={() => onUpdate({ equipped: !item.equipped })}
          className={`size-4 rounded border shrink-0 flex items-center justify-center text-[10px] ${
            item.equipped
              ? "bg-primary border-primary text-primary-foreground"
              : "border-muted-foreground/50 hover:border-primary"
          }`}
          title={item.equipped ? "Unequip" : "Equip"}
        >
          {item.equipped && "\u2713"}
        </button>
      )}

      {/* Name + details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`truncate font-medium ${rarityTextClass(rarity)}`}>{item.name}</span>
          {item.quantity > 1 && !showQuantity && (
            <span className="text-xs text-muted-foreground">{"\u00d7"}{item.quantity}</span>
          )}
          {rarity && rarity !== "Common" && (
            <Badge variant="outline" className="text-[9px] shrink-0">{rarity}</Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {damage && <span>{damage.dice} {damage.type}</span>}
          {armorClass && <span>AC {armorClass.base}{armorCategory ? ` (${armorCategory})` : ""}</span>}
          {properties.length > 0 && <span> · {properties.join(", ")}</span>}
          {weight > 0 && <span> · {weight} lb</span>}
        </div>
      </div>

      {/* Quantity editor */}
      {showQuantity && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="size-5 rounded border border-input text-xs hover:bg-accent"
            onClick={() => onUpdate({ quantity: Math.max(1, item.quantity - 1) })}
          >
            -
          </button>
          <span className="text-xs w-5 text-center">{item.quantity}</span>
          <button
            type="button"
            className="size-5 rounded border border-input text-xs hover:bg-accent"
            onClick={() => onUpdate({ quantity: item.quantity + 1 })}
          >
            +
          </button>
        </div>
      )}

      {/* Attunement toggle */}
      {showAttunement && requiresAttunement && (
        <button
          type="button"
          onClick={() => {
            if (!item.attuned && attunedCount >= 3) return; // cap at 3
            onUpdate({ attuned: !item.attuned });
          }}
          className={`px-2 py-0.5 rounded text-[10px] font-medium ${
            item.attuned
              ? "bg-primary text-primary-foreground"
              : attunedCount >= 3
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
          title={item.attuned ? "Remove attunement" : attunedCount >= 3 ? "Max 3 attuned items" : "Attune"}
        >
          {item.attuned ? "Attuned" : "Attune"}
        </button>
      )}

      {/* Delete */}
      <button
        type="button"
        className="size-5 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        onClick={onRemove}
        title="Remove item"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
