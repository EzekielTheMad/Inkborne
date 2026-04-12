"use client";

import type { FunTraits } from "@/lib/types/narrative";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FunTraitsCardProps {
  funTraits?: FunTraits;
}

const TRAIT_LABELS: Record<keyof FunTraits, string> = {
  favorite_food: "Favorite Food",
  least_favorite_food: "Least Favorite Food",
  hobby: "Downtime Hobby",
  zodiac: "Zodiac Sign",
};

export function FunTraitsCard({ funTraits }: FunTraitsCardProps) {
  if (!funTraits) return null;

  const entries = (Object.keys(TRAIT_LABELS) as (keyof FunTraits)[])
    .filter((key) => funTraits[key])
    .map((key) => ({ label: TRAIT_LABELS[key], value: funTraits[key]! }));

  if (entries.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-accent">Fun Traits</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {entries.map(({ label, value }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1 text-sm text-secondary-foreground"
            >
              <span className="font-medium text-muted-foreground">
                {label}:
              </span>
              {value}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
