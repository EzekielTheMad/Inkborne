"use client";

import { useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CharacterSpell } from "@/lib/types/spells";

interface SpellRowProps {
  spell: CharacterSpell;
  /** Whether this character's class uses prepared spells (and this spell's class is a prepared caster). */
  allowPrepareToggle: boolean;
  onTogglePrepared: () => void;
  onRemove: () => void;
}

function formatSchool(school: string): string {
  if (!school) return "";
  return school.charAt(0).toUpperCase() + school.slice(1);
}

function formatComponents(components: string[] | undefined): string {
  if (!components || components.length === 0) return "";
  return components.join(", ");
}

export function SpellRow({
  spell,
  allowPrepareToggle,
  onTogglePrepared,
  onRemove,
}: SpellRowProps) {
  const [expanded, setExpanded] = useState(false);
  const data = (spell.content_definitions?.data ?? {}) as {
    level?: number;
    school?: string;
    components?: string[];
    material?: string;
    casting_time?: string;
    range?: string;
    duration?: string;
    concentration?: boolean;
    ritual?: boolean;
    description?: string;
    higher_level?: string;
  };

  const isCantrip = (data.level ?? 0) === 0;
  const school = formatSchool(data.school ?? "");
  const components = formatComponents(data.components);

  return (
    <div className="text-sm">
      <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-accent/30">
        {allowPrepareToggle && !spell.always_prepared && !isCantrip && (
          <button
            type="button"
            onClick={onTogglePrepared}
            className={cn(
              "size-4 rounded border shrink-0 flex items-center justify-center text-[10px]",
              spell.is_prepared
                ? "bg-primary border-primary text-primary-foreground"
                : "border-muted-foreground/50 hover:border-primary",
            )}
            title={spell.is_prepared ? "Unprepare" : "Prepare"}
          >
            {spell.is_prepared && "\u2713"}
          </button>
        )}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 min-w-0 text-left flex items-center gap-2"
        >
          <ChevronDown
            className={cn("size-3 text-muted-foreground transition-transform", expanded && "rotate-180")}
          />
          <span className="truncate font-medium">{spell.name}</span>
          {school && <span className="text-xs text-muted-foreground shrink-0">{school}</span>}
          {components && <span className="text-xs text-muted-foreground shrink-0">{components}</span>}
          {spell.always_prepared && (
            <Badge variant="secondary" className="text-[9px] shrink-0">
              Always
            </Badge>
          )}
          {data.ritual && (
            <Badge variant="outline" className="text-[9px] shrink-0">
              R
            </Badge>
          )}
          {data.concentration && (
            <Badge variant="outline" className="text-[9px] shrink-0">
              C
            </Badge>
          )}
        </button>

        {!spell.always_prepared && (
          <button
            type="button"
            onClick={onRemove}
            className="size-5 rounded text-muted-foreground hover:text-destructive transition-colors shrink-0"
            aria-label="Remove spell"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      {expanded && (
        <div className="border-t border-border/50 bg-card/30 px-3 py-2 space-y-1.5 text-xs">
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            {data.casting_time && (
              <div>
                <span className="text-muted-foreground">Casting time: </span>
                {data.casting_time}
              </div>
            )}
            {data.range && (
              <div>
                <span className="text-muted-foreground">Range: </span>
                {data.range}
              </div>
            )}
            {data.duration && (
              <div>
                <span className="text-muted-foreground">Duration: </span>
                {data.duration}
              </div>
            )}
            {data.material && (
              <div>
                <span className="text-muted-foreground">Material: </span>
                {data.material}
              </div>
            )}
          </div>
          {data.description && (
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {data.description}
            </p>
          )}
          {data.higher_level && (
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
              <span className="font-medium text-foreground">At Higher Levels: </span>
              {data.higher_level}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
