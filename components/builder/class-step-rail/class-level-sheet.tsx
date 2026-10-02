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
  savePending?: boolean;
  saveError?: string | null;
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
  const { open, onOpenChange, level, savePending = false, saveError, ...paneProps } = props;

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
          {savePending && <p role="status" className="text-sm text-muted-foreground">Saving this class change. Please wait.</p>}
          {saveError && <p role="alert" className="text-left text-sm text-destructive">{saveError}</p>}
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-4">
          <fieldset disabled={savePending} aria-busy={savePending} className="min-w-0 border-0 p-0">
            <ClassLevelPane {...paneProps} />
          </fieldset>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
