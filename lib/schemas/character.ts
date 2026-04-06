import { z } from "zod";

export const characterSchema = z.object({
  user_id: z.string().uuid(),
  system_id: z.string().uuid(),
  campaign_id: z.string().uuid().nullable().default(null),
  name: z.string().min(1),
  visibility: z.enum(["private", "campaign", "public"]).default("private"),
  archived: z.boolean().default(false),
});
