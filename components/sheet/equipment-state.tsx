"use client";

import { Label } from "@/components/ui/label";

interface EquipmentStateProps {
  equippedArmor: string;
  shieldEquipped: boolean;
  onArmorChange: (armor: string) => void;
  onShieldChange: (shield: boolean) => void;
}

const ARMOR_OPTIONS = [
  { value: "none", label: "No Armor" },
  { value: "light", label: "Light Armor" },
  { value: "medium", label: "Medium Armor" },
  { value: "heavy", label: "Heavy Armor" },
];

export function EquipmentState({
  equippedArmor,
  shieldEquipped,
  onArmorChange,
  onShieldChange,
}: EquipmentStateProps) {
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <p className="text-sm font-medium">Equipment</p>
      <div className="space-y-2">
        <div>
          <Label className="text-xs text-muted-foreground">Armor</Label>
          <select
            value={equippedArmor}
            onChange={(e) => onArmorChange(e.target.value)}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            {ARMOR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Shield</Label>
          <button
            type="button"
            onClick={() => onShieldChange(!shieldEquipped)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              shieldEquipped ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg transition-transform ${
                shieldEquipped ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
