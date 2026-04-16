"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CustomItemFormProps {
  onAdd: (item: {
    content_id: null;
    name: string;
    content_type: string;
    quantity?: number;
    custom_data: Record<string, unknown>;
  }) => void;
  onCancel: () => void;
}

const ITEM_TYPES = [
  { value: "item", label: "Gear" },
  { value: "weapon", label: "Weapon" },
  { value: "armor", label: "Armor" },
  { value: "magic_item", label: "Magic Item" },
];

export function CustomItemForm({ onAdd, onCancel }: CustomItemFormProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState("item");
  const [weight, setWeight] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");

  const canSubmit = name.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const customData: Record<string, unknown> = {};
    if (weight.trim()) {
      const w = parseFloat(weight);
      if (!Number.isNaN(w)) customData.weight = w;
    }
    if (description.trim()) {
      customData.description = description.trim();
    }

    onAdd({
      content_id: null,
      name: name.trim(),
      content_type: type,
      quantity: parseInt(quantity) || 1,
      custom_data: customData,
    });

    setName("");
    setType("item");
    setWeight("");
    setDescription("");
    setQuantity("1");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Add custom item</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
      <Input
        placeholder="Item name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <div className="flex gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          {ITEM_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <Input
          placeholder="Weight (lb)"
          type="number"
          step="0.1"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className="w-24"
        />
        <Input
          placeholder="Qty"
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-16"
        />
      </div>
      <textarea
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <Button type="submit" size="sm" disabled={!canSubmit} className="w-full">
        Add Custom Item
      </Button>
    </form>
  );
}
