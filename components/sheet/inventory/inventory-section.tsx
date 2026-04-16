"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface InventorySectionProps {
  title: string;
  count: number;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  highlight?: boolean;
  children: React.ReactNode;
}

export function InventorySection({
  title,
  count,
  badge,
  defaultOpen = true,
  highlight = false,
  children,
}: InventorySectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn(
      "rounded-lg border border-border overflow-hidden",
      highlight && "border-accent/30 bg-accent/5",
    )}>
      <button
        type="button"
        className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium hover:bg-accent/10 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center gap-2">
          {title}
          <span className="text-xs text-muted-foreground">({count})</span>
          {badge}
        </span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1">
          {children}
        </div>
      )}
    </div>
  );
}
