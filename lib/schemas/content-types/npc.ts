import { z } from "zod";

export const NPC_PAYLOAD_MAX_BYTES = 65_536;
const text = (max: number) => z.string().min(1).max(max).refine(value => value.trim().length > 0, "Declare nonblank text");
const ideas = () => z.array(text(500)).max(8).optional();

/** Narrative template v1. No campaign secrets, resolved relations or game mechanics. */
export const npcDataSchema = z.strictObject({
  schema_version: z.literal(1),
  description: text(8_000).optional(),
  occupation: text(120).optional(),
  personality: z.strictObject({
    personality_traits: ideas(), ideals: ideas(), bonds: ideas(), flaws: ideas(),
    motivation: text(1_000).optional(), mannerisms: text(1_000).optional(), fear: text(1_000).optional(),
  }).optional(),
  relationships: z.array(z.strictObject({
    name: text(120), relationship: text(120), description: text(1_000).optional(),
  })).max(20).optional(),
}).superRefine((value, context) => {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > NPC_PAYLOAD_MAX_BYTES) {
    context.addIssue({ code: "custom", message: "NPC data exceeds the 64 KiB UTF-8 payload budget" });
  }
});

export type NpcData = z.infer<typeof npcDataSchema>;
