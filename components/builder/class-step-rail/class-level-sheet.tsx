"use client";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ClassLevelPane } from "@/components/builder/class-step-rail/class-level-pane";
import type { ComponentProps } from "react";

type ClassLevelSheetProps = ComponentProps<typeof ClassLevelPane> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The level shown in the sheet header (row may be undefined for data gaps). */
  level: number;
};

/**
 * Mobile bottom-sheet variant of the static per-level body (UAT A3).
 *
 * The desktop layout renders <ClassLevelPane> in the main pane next to the
 * rail; sub-`md` had no equivalent, so required choices (subclass, ASI, …)
 * were unreachable outside the level-up flow. This sheet wraps the same pane —
 * including the same choice cards the level-up flow uses — and opens when a
 * level pill or a pending-choice callout is tapped.
 */
export function ClassLevelSheet(props: ClassLevelSheetProps) {
  const { open, onOpenChange, level, ...paneProps } = props;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle>
            {paneProps.className_} · Level {level}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            Features and choices for {paneProps.className_} at level {level}.
          </DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-4">
          <ClassLevelPane {...paneProps} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
