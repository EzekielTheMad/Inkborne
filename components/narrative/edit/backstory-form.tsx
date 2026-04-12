"use client";

import type { JSONContent } from "@tiptap/react";
import type { NarrativeRichData } from "@/lib/types/narrative";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface BackstoryFormProps {
  narrativeRich: NarrativeRichData;
  campaignId?: string | null;
  onRichChange: (field: string, content: JSONContent) => void;
  isOwner: boolean;
}

const SECTIONS: {
  key: keyof NarrativeRichData;
  title: string;
  prompt: string;
  placeholder: string;
}[] = [
  {
    key: "backstory_origin",
    title: "Where They Came From",
    prompt:
      "Describe where your character grew up, their family, and the world that shaped them.",
    placeholder: "A small village on the edge of the Blackwood...",
  },
  {
    key: "backstory_turning_point",
    title: "The Turning Point",
    prompt:
      "What event changed everything? Why did they leave their old life behind?",
    placeholder: "The night the fires came...",
  },
  {
    key: "backstory_left_behind",
    title: "What They Left Behind",
    prompt:
      "Who or what did they leave behind? Unfinished business, regrets, people still waiting?",
    placeholder: "A letter never sent, a promise unkept...",
  },
  {
    key: "backstory_dm_notes",
    title: "What the DM Should Know",
    prompt: "Secrets, plot hooks, or anything only the DM should see.",
    placeholder: "The real reason they left town...",
  },
];

export function BackstoryForm({
  narrativeRich,
  campaignId,
  onRichChange,
  isOwner,
}: BackstoryFormProps) {
  return (
    <Accordion defaultValue={["backstory"]}>
      <AccordionItem value="backstory">
        <AccordionTrigger>
          <span className="text-sm font-semibold text-accent">Backstory</span>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-6 pt-1">
            {SECTIONS.map(({ key, title, prompt, placeholder }) => {
              // DM notes only visible to owner
              if (key === "backstory_dm_notes" && !isOwner) return null;

              return (
                <div key={key} className="space-y-2">
                  <div>
                    <h4 className="text-sm font-medium text-foreground">
                      {title}
                    </h4>
                    <p className="text-sm italic text-muted-foreground">
                      {prompt}
                    </p>
                    {key === "backstory_dm_notes" && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        (Only visible to you and the DM)
                      </p>
                    )}
                  </div>
                  <RichTextEditor
                    content={narrativeRich[key] ?? null}
                    onChange={(content) => onRichChange(key, content)}
                    placeholder={placeholder}
                    minHeight="200px"
                    campaignId={campaignId ?? undefined}
                  />
                </div>
              );
            })}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
