"use client";

import type { CharacterChoices } from "@/lib/types/character";
import type { NarrativeData } from "@/lib/types/narrative";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface PersonalityFormProps {
  choices: CharacterChoices;
  narrative: NarrativeData;
  onChoiceChange: (field: string, value: string[]) => void;
  onNarrativeChange: (field: string, value: string) => void;
}

function TextArea({
  id,
  label,
  value,
  placeholder,
  rows,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  rows: number;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5">
        {label}
      </Label>
      <textarea
        id={id}
        value={value}
        placeholder={placeholder}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      />
    </div>
  );
}

export function PersonalityForm({
  choices,
  narrative,
  onChoiceChange,
  onNarrativeChange,
}: PersonalityFormProps) {
  return (
    <Accordion defaultValue={["personality"]}>
      <AccordionItem value="personality">
        <AccordionTrigger>
          <span className="text-sm font-semibold text-accent">
            Personality Snapshot
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4 pt-1">
            <TextArea
              id="personality-traits"
              label="Personality Traits"
              value={(choices.personality_traits ?? []).join("\n")}
              placeholder="One trait per line"
              rows={3}
              onChange={(v) =>
                onChoiceChange(
                  "personality_traits",
                  v.split("\n").filter(Boolean),
                )
              }
            />
            <TextArea
              id="motivation"
              label="Motivation"
              value={narrative.motivation ?? ""}
              placeholder="What drives them forward?"
              rows={2}
              onChange={(v) => onNarrativeChange("motivation", v)}
            />
            <TextArea
              id="ideals"
              label="Ideals"
              value={(choices.ideals ?? []).join("\n")}
              placeholder="One ideal per line"
              rows={2}
              onChange={(v) =>
                onChoiceChange("ideals", v.split("\n").filter(Boolean))
              }
            />
            <TextArea
              id="bonds"
              label="Bonds"
              value={(choices.bonds ?? []).join("\n")}
              placeholder="One bond per line"
              rows={2}
              onChange={(v) =>
                onChoiceChange("bonds", v.split("\n").filter(Boolean))
              }
            />
            <TextArea
              id="flaws"
              label="Flaws"
              value={(choices.flaws ?? []).join("\n")}
              placeholder="One flaw per line"
              rows={2}
              onChange={(v) =>
                onChoiceChange("flaws", v.split("\n").filter(Boolean))
              }
            />
            <TextArea
              id="mannerisms"
              label="Mannerisms"
              value={narrative.mannerisms ?? ""}
              placeholder="How they talk, nervous tics, catchphrases..."
              rows={2}
              onChange={(v) => onNarrativeChange("mannerisms", v)}
            />
            <TextArea
              id="fear"
              label="Fear / Secret"
              value={narrative.fear ?? ""}
              placeholder="What keeps them up at night?"
              rows={2}
              onChange={(v) => onNarrativeChange("fear", v)}
            />
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
