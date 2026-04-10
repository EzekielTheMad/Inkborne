"use client";

import type { NarrativeData } from "@/lib/types/narrative";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CoreIdentityFormProps {
  narrative: NarrativeData;
  onChange: (field: string, value: string) => void;
}

const FIELDS: {
  key: keyof NarrativeData;
  label: string;
  placeholder: string;
}[] = [
  {
    key: "full_name",
    label: "Full Name",
    placeholder: "Thalion Brightforge, Xera of the Twilight Marsh",
  },
  {
    key: "aliases",
    label: "Aliases / Nicknames",
    placeholder: '"The Ashen Blade", "Patches"',
  },
  {
    key: "one_liner",
    label: "One-Liner",
    placeholder: "Blacksmith's apprentice, disgraced noble, wandering scholar...",
  },
  { key: "age", label: "Age", placeholder: "27, young adult, ancient..." },
  { key: "build", label: "Build", placeholder: "Wiry, stocky, towering..." },
  {
    key: "origin",
    label: "Origin",
    placeholder: "Waterdeep, the Feywild, a traveling circus...",
  },
];

export function CoreIdentityForm({
  narrative,
  onChange,
}: CoreIdentityFormProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-accent">Core Identity</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map(({ key, label, placeholder }) => (
          <div
            key={key}
            className={
              key === "full_name" || key === "one_liner"
                ? "sm:col-span-2"
                : undefined
            }
          >
            <Label htmlFor={`narrative-${key}`} className="mb-1.5">
              {label}
            </Label>
            <Input
              id={`narrative-${key}`}
              value={(narrative[key] as string) ?? ""}
              placeholder={placeholder}
              onChange={(e) => onChange(key, e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
