"use client";

import type { FunTraits } from "@/lib/types/narrative";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface FunTraitsFormProps {
  funTraits?: FunTraits;
  onChange: (field: string, value: string) => void;
}

const FIELDS: { key: keyof FunTraits; label: string; placeholder: string }[] = [
  {
    key: "favorite_food",
    label: "Favorite Food",
    placeholder: "Honeyed ham, elvish waybread...",
  },
  {
    key: "least_favorite_food",
    label: "Least Favorite Food",
    placeholder: "Porridge, anything with tentacles...",
  },
  {
    key: "hobby",
    label: "Downtime Hobby",
    placeholder: "Whittling, tavern trivia, stargazing...",
  },
  {
    key: "zodiac",
    label: "Zodiac Sign",
    placeholder: "The Wanderer, Scorpio...",
  },
];

export function FunTraitsForm({ funTraits, onChange }: FunTraitsFormProps) {
  return (
    <Accordion>
      <AccordionItem value="fun-traits">
        <AccordionTrigger>
          <span className="text-sm font-semibold text-accent">Fun Traits</span>
        </AccordionTrigger>
        <AccordionContent>
          <div className="grid gap-3 sm:grid-cols-2 pt-1">
            {FIELDS.map(({ key, label, placeholder }) => (
              <div key={key}>
                <Label htmlFor={`fun-${key}`} className="mb-1.5">
                  {label}
                </Label>
                <Input
                  id={`fun-${key}`}
                  value={funTraits?.[key] ?? ""}
                  placeholder={placeholder}
                  onChange={(e) => onChange(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
