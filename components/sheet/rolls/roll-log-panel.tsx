"use client";

import { useState } from "react";
import { DicesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/lib/builder/use-is-mobile";
import { useRolls } from "@/lib/character/character-context";
import type { RollKind } from "@/lib/dice/types";
import type { RollLogEntry } from "@/lib/types/rolls";
import { RollBreakdown } from "@/components/sheet/rolls/roll-breakdown";

const KIND_LABELS: Record<RollKind, string> = {
  check: "Check",
  save: "Save",
  attack: "Attack",
  damage: "Damage",
  heal: "Heal",
  death_save: "Death Save",
  initiative: "Initiative",
  hit_die: "Hit Die",
  concentration: "Concentration",
  custom: "Custom",
};

/**
 * Persistent Roll Log: a d20 trigger button opening a right-side slide-over
 * on desktop / a Vaul bottom sheet on mobile (design D1). Lists hydrated +
 * session rolls newest-first with kind badges, relative timestamps, and full
 * breakdowns.
 */
export function RollLogPanel() {
  const { rolls } = useRolls();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const trigger = (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Open roll log"
      title="Roll log"
      onClick={() => setOpen(true)}
    >
      <DicesIcon />
    </Button>
  );

  const list =
    rolls.length === 0 ? (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        No rolls yet — click any modifier on the sheet.
      </p>
    ) : (
      <ul className="flex flex-col gap-2 px-4 pb-4" aria-label="Roll history">
        {rolls.map((entry) => (
          <RollLogRow key={entry.id} entry={entry} />
        ))}
      </ul>
    );

  if (isMobile) {
    return (
      <>
        {trigger}
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader className="text-left">
              <DrawerTitle>Roll Log</DrawerTitle>
              <DrawerDescription>
                Recent rolls for this character, newest first.
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto">{list}</div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <>
      {trigger}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="gap-0">
          <SheetHeader>
            <SheetTitle>Roll Log</SheetTitle>
            <SheetDescription>
              Recent rolls for this character, newest first.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">{list}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function RollLogRow({ entry }: { entry: RollLogEntry }) {
  const natural = entry.result.natural;
  return (
    <li className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant="secondary" className="shrink-0">
            {KIND_LABELS[entry.kind] ?? entry.kind}
          </Badge>
          <span className="truncate text-sm font-medium">{entry.label}</span>
        </div>
        <span
          className={
            natural === 20
              ? "text-lg font-bold tabular-nums text-emerald-500"
              : natural === 1
                ? "text-lg font-bold tabular-nums text-destructive"
                : "text-lg font-bold tabular-nums"
          }
        >
          {entry.total}
        </span>
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <RollBreakdown result={entry.result} />
        <time
          dateTime={entry.rolled_at}
          className="shrink-0 text-[11px] text-muted-foreground"
        >
          {formatRelativeTime(entry.rolled_at)}
        </time>
      </div>
    </li>
  );
}

/** Compact relative timestamp: "just now", "5m ago", "3h ago", "2d ago", else a date. */
export function formatRelativeTime(
  iso: string,
  now: Date = new Date(),
): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.floor((now.getTime() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
