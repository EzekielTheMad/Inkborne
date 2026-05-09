"use client";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { ClassPickerPanel } from "@/components/builder/class-step-rail/class-picker-panel";
import type { ContentEntry } from "@/components/builder/content-browser";

interface ClassPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: ContentEntry[];
  resolvedStats: Record<string, number>;
  selectedClasses: Array<{ slug: string }>;
  levelsRemaining: number;
  onSelect: (content: ContentEntry) => void;
  onCancel: () => void;
}

export function ClassPickerSheet(props: ClassPickerSheetProps) {
  const {
    open, onOpenChange, classes, resolvedStats, selectedClasses, levelsRemaining,
    onSelect, onCancel,
  } = props;

  return (
    <Drawer open={open} onOpenChange={(next) => {
      if (!next) onCancel();
      onOpenChange(next);
    }}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle>Add a class</DrawerTitle>
          <DrawerDescription>
            {levelsRemaining} levels remaining · pick a class with met prerequisites
          </DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-4">
          <ClassPickerPanel
            classes={classes}
            resolvedStats={resolvedStats}
            selectedClasses={selectedClasses}
            levelsRemaining={levelsRemaining}
            onSelect={onSelect}
            onCancel={onCancel}
            chrome="embedded"
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
