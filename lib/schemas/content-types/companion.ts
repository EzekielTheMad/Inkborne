import { z } from "zod";
import { monsterDataSchema } from "./monster";

export const COMPANION_PAYLOAD_MAX_BYTES = 65_536;
export const COMPANION_ROLE_LABELS = {
  mount: "Mount template", beast_form: "Beast form template", summon: "Summon template",
} as const;

/** Declared read-only template under its own content ID/version. Role labels
 * provide no character control, eligibility, source-copy or gameplay authority. */
export const companionDataSchema = z.strictObject({
  schema_version: z.literal(1),
  role: z.enum(["mount", "beast_form", "summon"]),
  stat_block: monsterDataSchema,
}).superRefine((value, context) => {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > COMPANION_PAYLOAD_MAX_BYTES) {
    context.addIssue({ code: "custom", message: "Companion data exceeds the 64 KiB UTF-8 payload budget" });
  }
});
export type CompanionData = z.infer<typeof companionDataSchema>;
