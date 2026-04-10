"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useCallback,
} from "react";
import { cn } from "@/lib/utils";
import type { MentionItem } from "@/lib/types/narrative";

export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface MentionListProps {
  items: MentionItem[];
  command: (item: MentionItem) => void;
}

export const MentionList = forwardRef<MentionListRef, MentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) {
          command(item);
        }
      },
      [items, command],
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((prev) =>
            prev <= 0 ? items.length - 1 : prev - 1,
          );
          return true;
        }

        if (event.key === "ArrowDown") {
          setSelectedIndex((prev) =>
            prev >= items.length - 1 ? 0 : prev + 1,
          );
          return true;
        }

        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }

        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="rounded-md border border-border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-md">
          No results
        </div>
      );
    }

    return (
      <div className="rounded-md border border-border bg-popover shadow-md overflow-hidden">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground transition-colors",
              "hover:bg-secondary",
              index === selectedIndex && "bg-secondary text-accent",
            )}
            onClick={() => selectItem(index)}
          >
            <span className="font-medium">{item.label}</span>
            <span className="text-xs text-muted-foreground">
              {item.entityType}
            </span>
          </button>
        ))}
      </div>
    );
  },
);

MentionList.displayName = "MentionList";
