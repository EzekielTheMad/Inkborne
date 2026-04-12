import { z } from "zod";
import {
  sourceRefsSchema,
  languageProfsSchema,
  toolProfsSchema,
  skillProfsSchema,
} from "./mechanical";

const idealSchema = z.object({
  text: z.string().min(1),
  alignment: z.string().default(""),
});

export const backgroundDataSchema = z.object({
  feature: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
  }),
  personality_traits: z.array(z.string()).default([]),
  ideals: z.array(idealSchema).default([]),
  bonds: z.array(z.string()).default([]),
  flaws: z.array(z.string()).default([]),
  // Phase 3 mechanical fields
  skills: skillProfsSchema,
  gold: z.number().nonnegative().optional(),
  languageProfs: languageProfsSchema,
  toolProfs: toolProfsSchema,
  equipment: z.string().default(""),
  variant: z.string().nullable().default(null),
  source_refs: sourceRefsSchema,
});
export type BackgroundData = z.infer<typeof backgroundDataSchema>;
