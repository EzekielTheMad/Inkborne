"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ClassEmblem } from "@/components/builder/class-emblem";
import type { ContentEntry } from "@/components/builder/content-browser";

export interface ClassPreviewModalProps {
  open: boolean;
  classContent: ContentEntry | null;
  features: ContentEntry[];
  subclasses: ContentEntry[];
  spells: ContentEntry[];
  onCancel: () => void;
  onPick: (selection: { classSlug: string; subclassSlug: string | null }) => void;
}

type TabId = "overview" | "features" | "subclasses" | "spells";

export function ClassPreviewModal({
  open,
  classContent,
  features,
  subclasses,
  spells,
  onCancel,
  onPick,
}: ClassPreviewModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [previewLevel, setPreviewLevel] = useState<number>(1);
  const [previewSubclassSlug, setPreviewSubclassSlug] = useState<string | null>(null);

  // Reset modal-local state whenever a new class is opened. Task 11 will
  // switch the call site to a `key`-prop pattern so this can become a fresh
  // mount per class — at which point this effect (and the disables below)
  // can go away. The exhaustive-deps disable is intentional: we depend on
  // classContent's id (a stable value) rather than the whole object so the
  // effect doesn't re-run on every parent re-render that produces a new
  // object reference for the same class.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (open && classContent) {
      setActiveTab("overview");
      setPreviewLevel(1);
      setPreviewSubclassSlug(null);
    }
  }, [open, classContent?.id]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  if (!classContent) return null;

  const data = classContent.data as Record<string, unknown>;
  const hitDie = data.hit_die as number | undefined;
  const primaryAbility = data.primaryAbility as string | undefined;
  const levels = (data.levels as Array<{ level: number; features: string[] }>) ?? [];
  const maxLevel = levels.length > 0 ? levels[levels.length - 1].level : 20;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent
        showCloseButton
        aria-labelledby="class-preview-title"
        className="grid grid-rows-[auto_1fr_auto] gap-0 p-0 max-w-[1120px] w-[min(1120px,90vw)] max-h-[820px] h-[min(820px,85vh)] rounded-xl shadow-[0_24px_60px_rgba(0,0,0,0.5)] data-open:duration-[180ms] data-open:[animation-timing-function:cubic-bezier(0.16,1,0.3,1)]"
      >
        <header className="flex items-center gap-4 px-6 py-4 border-b border-border">
          <ClassEmblem slug={classContent.slug} name={classContent.name} size="lg" />
          <div className="flex-1 min-w-0">
            <h2 id="class-preview-title" className="text-2xl font-semibold leading-tight font-serif">
              {classContent.name}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {[
                hitDie ? `d${hitDie} hit die` : null,
                primaryAbility ? primaryAbility : null,
                `${maxLevel} levels of features`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </header>

        {/* Tab body placeholder — Task 4 fills in tabs. */}
        <div className="overflow-y-auto px-6 py-4 text-sm">
          <p className="text-muted-foreground">Coming up: tabs.</p>
        </div>

        <footer className="flex items-center justify-between gap-3 px-6 py-3 border-t border-border bg-muted/30">
          <div data-slot="preview-level-slot" />
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} autoFocus>
              Cancel
            </Button>
            <Button
              onClick={() =>
                onPick({
                  classSlug: classContent.slug,
                  subclassSlug: previewSubclassSlug,
                })
              }
            >
              Pick this class
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
