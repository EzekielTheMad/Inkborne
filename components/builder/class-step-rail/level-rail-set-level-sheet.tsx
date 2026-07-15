"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface LevelRailSetLevelSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classSlug: string;
  className_: string;
  classIndex: number;
  currentLevel: number;
  maxLevel: number;
  onLevelChange: (classIndex: number, newLevel: number) => Promise<void> | void;
}

export function LevelRailSetLevelSheet(props: LevelRailSetLevelSheetProps) {
  const { open, onOpenChange, classSlug, className_, classIndex, currentLevel, maxLevel, onLevelChange } = props;
  const [draftLevel, setDraftLevel] = useState<number>(currentLevel);

  useEffect(() => {
    if (open) setDraftLevel(currentLevel);
  }, [open, currentLevel]);

  const labelId = `set-level-${classSlug}-label`;

  const handleConfirm = () => {
    void onLevelChange(classIndex, draftLevel);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle id={labelId}>Set level for {className_}</DrawerTitle>
          <DrawerDescription className="sr-only">
            Choose a level for {className_} between 1 and {maxLevel}.
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-2">
          <select
            id={`${labelId}-select`}
            aria-label={`Set level for ${className_}`}
            value={draftLevel}
            onChange={(e) => setDraftLevel(Number.parseInt(e.target.value, 10))}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {Array.from({ length: maxLevel }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                Level {n}
              </option>
            ))}
          </select>
        </div>
        <DrawerFooter className="flex-row justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="default" size="sm" onClick={handleConfirm}>
            Confirm
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
