"use client";

import { cn } from "@/lib/utils";
import type { Currency } from "@/lib/types/inventory";

interface CurrencyTrackerProps {
  currency: Currency;
  onChange: (currency: Currency) => void;
}

const DENOMINATIONS: Array<{ key: keyof Currency; label: string; color: string }> = [
  { key: "pp", label: "PP", color: "text-blue-300" },
  { key: "gp", label: "GP", color: "text-accent" },
  { key: "ep", label: "EP", color: "text-gray-300" },
  { key: "sp", label: "SP", color: "text-gray-400" },
  { key: "cp", label: "CP", color: "text-orange-400" },
];

export function CurrencyTracker({ currency, onChange }: CurrencyTrackerProps) {
  function handleChange(key: keyof Currency, value: string) {
    const num = parseInt(value) || 0;
    onChange({ ...currency, [key]: Math.max(0, num) });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs font-medium text-muted-foreground mb-2">Currency</p>
      <div className="flex gap-2">
        {DENOMINATIONS.map(({ key, label, color }) => (
          <div key={key} className="flex-1 text-center">
            <input
              type="number"
              min={0}
              value={currency[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              className="w-full h-7 rounded border border-input bg-background px-1 text-center text-sm font-medium"
            />
            <p className={cn("text-[10px] font-medium mt-0.5", color)}>{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
