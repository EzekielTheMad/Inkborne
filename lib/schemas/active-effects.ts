import { z } from "zod";
import { effectSchema } from "./effects";

/**
 * Structured duration for active effects and pre-parsed spell durations
 * (`duration_structured` on spell content). Mirrors `EffectDuration` in
 * `lib/types/active-effects.ts`.
 */
export const effectDurationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("rounds"), value: z.number().int().positive() }),
  z.object({ type: z.literal("minutes"), value: z.number().int().positive() }),
  z.object({ type: z.literal("hours"), value: z.number().int().positive() }),
  z.object({ type: z.literal("until_rest") }),
  z.object({ type: z.literal("instantaneous") }),
  z.object({ type: z.literal("special") }),
]);

/**
 * Runtime active-effect entry stored in `character.state.active_effects`.
 * Typed today; enforced at the state boundary when M4's content validation
 * lands (design §9).
 */
export const activeEffectSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  source: z.enum(["spell", "feature", "item", "custom"]),
  content_id: z.uuid().nullable(),
  effects: z.array(effectSchema),
  duration: effectDurationSchema,
  concentration: z.boolean(),
  cast_at_level: z.number().int().min(0).max(9).optional(),
  applied_at: z.iso.datetime(),
  expires_at: z.iso.datetime().nullable(),
});
