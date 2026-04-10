"use client";

import type { NarrativeData } from "@/lib/types/narrative";
import { Card, CardContent } from "@/components/ui/card";

interface CoreIdentityCardProps {
  narrative: NarrativeData;
}

export function CoreIdentityCard({ narrative }: CoreIdentityCardProps) {
  const { full_name, aliases, one_liner, age, build, origin } = narrative;

  const metaParts = [age, build, origin].filter(Boolean);
  const hasContent = full_name || aliases || one_liner || metaParts.length > 0;

  return (
    <Card>
      <CardContent className="space-y-1.5">
        {full_name ? (
          <h2 className="text-xl font-bold text-accent">{full_name}</h2>
        ) : (
          <h2 className="text-xl font-bold text-muted-foreground/50 italic">No name set</h2>
        )}
        {aliases && (
          <p className="text-sm italic text-muted-foreground">{aliases}</p>
        )}
        {one_liner && <p className="text-sm text-foreground">{one_liner}</p>}
        {metaParts.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {metaParts.join(" \u00b7 ")}
          </p>
        )}
        {!hasContent && (
          <p className="text-sm text-muted-foreground">
            Click Edit to add your character&apos;s identity details.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
