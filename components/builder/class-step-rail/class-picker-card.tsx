"use client";

import { Check, Lock } from "lucide-react";
import { ClassEmblem } from "@/components/builder/class-emblem";
import { cn } from "@/lib/utils";
import type { ContentEntry } from "@/components/builder/content-browser";
import type { ClassPrereqResult } from "@/lib/builder/multiclass-prereqs";

interface ClassPickerCardProps {
  classContent: ContentEntry;
  prereq: ClassPrereqResult;
  onSelect: (content: ContentEntry) => void;
}

function deriveRole(data: Record<string, unknown>): string | null {
  const role = data.role;
  if (typeof role === "string" && role.length > 0) return role;
  const hitDie = data.hit_die;
  if (typeof hitDie === "number") return `d${hitDie} hit die`;
  return null;
}

export function ClassPickerCard({ classContent, prereq, onSelect }: ClassPickerCardProps) {
  const data = classContent.data as Record<string, unknown>;
  const role = deriveRole(data);

  const disabled = prereq.state !== "met";

  const lineClass =
    prereq.state === "met"
      ? "text-emerald-500"
      : prereq.state === "not-met"
        ? "text-red-500"
        : "text-muted-foreground";

  return (
    <button
      type="button"
      aria-disabled={disabled ? "true" : "false"}
      onClick={() => {
        if (!disabled) onSelect(classContent);
      }}
      className={cn(
        "flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        disabled
          ? cn(
              "opacity-55 cursor-not-allowed",
              prereq.state === "not-met" ? "border-dashed border-muted" : "border-muted",
            )
          : "border-border hover:bg-accent/40 cursor-pointer",
      )}
    >
      <ClassEmblem slug={classContent.slug} name={classContent.name} size="md" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">{classContent.name}</p>
        {role && <p className="mt-0.5 text-xs text-muted-foreground">{role}</p>}
        <p className={cn("mt-1 flex items-center gap-1 text-xs", lineClass)}>
          {prereq.state === "met" && <Check className="size-3" aria-hidden="true" />}
          {prereq.state === "not-met" && <span aria-hidden="true">•</span>}
          {prereq.state === "already-in-build" && <Lock className="size-3" aria-hidden="true" />}
          <span>{prereq.line}</span>
        </p>
      </div>
    </button>
  );
}
